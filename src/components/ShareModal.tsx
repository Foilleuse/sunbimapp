import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Modal, Dimensions, TouchableOpacity, PixelRatio } from 'react-native';
import { Canvas, Rect, LinearGradient as SkiaGradient, vec, useImage, Image as SkiaImage, Group, Blur, Mask, Paint } from "@shopify/react-native-skia";
import { X } from 'lucide-react-native';
import { DrawingViewer } from './DrawingViewer';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';

interface ShareModalProps {
    visible: boolean;
    onClose: () => void;
    drawing: any;
}

// --- COMPOSANT BACKGROUND : MIROIR + FLOU + FONDU ÉTENDU ---
// Copié pour l'autonomie du composant et garantir le même rendu
const MirroredBackground = ({ uri, width, height, top }: { uri: string, width: number, height: number, top: number }) => {
    const image = useImage(uri);
    
    if (!image) return null;

    const bottom = top + height;
    const BLUR_RADIUS = 25; 

    // 🔥 CORRECTION BORDS BLANCS
    const EXTRA_WIDTH = 100;
    const bgWidth = width + EXTRA_WIDTH;
    const bgX = -EXTRA_WIDTH / 2;

    return (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <Group layer={<Paint><Blur blur={BLUR_RADIUS} /></Paint>}>
                <SkiaImage image={image} x={bgX} y={top} width={bgWidth} height={height} fit="cover" />
                <Group origin={vec(width / 2, top)} transform={[{ scaleY: -1 }]}>
                    <SkiaImage image={image} x={bgX} y={top} width={bgWidth} height={height} fit="cover" />
                </Group>
                <Group origin={vec(width / 2, bottom)} transform={[{ scaleY: -1 }]}>
                    <SkiaImage image={image} x={bgX} y={top} width={bgWidth} height={height} fit="cover" />
                </Group>
            </Group>

            <Mask
                mode="luminance"
                mask={
                    <Rect x={0} y={top} width={width} height={height}>
                        <SkiaGradient
                            start={vec(0, top)}
                            end={vec(0, bottom)}
                            colors={["black", "white", "white", "black"]}
                            positions={[0, 0.2, 0.8, 1]}
                        />
                    </Rect>
                }
            >
                <SkiaImage
                    image={image}
                    x={0} y={top} width={width} height={height}
                    fit="cover"
                />
            </Mask>
        </Canvas>
    );
};

export const ShareModal: React.FC<ShareModalProps> = ({ visible, onClose, drawing }) => {
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    const fullScreenImageUri = useMemo(() => {
        if (!drawing?.cloud_image_url) return null;
        const w = Math.round(screenWidth * PixelRatio.get());
        const h = Math.round(w * (4/3)); 
        return getOptimizedImageUrl(drawing.cloud_image_url, w, h);
    }, [drawing?.cloud_image_url, screenWidth]);

    if (!drawing) return null;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={false}
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={styles.container}>
                {/* Background étendu sur tout l'écran */}
                {drawing.cloud_image_url && (
                    <MirroredBackground 
                        uri={fullScreenImageUri || drawing.cloud_image_url}
                        width={screenWidth}
                        height={screenHeight} 
                        top={0} 
                    />
                )}

                {/* Zone de dessin centrée */}
                <View style={styles.centeredContent}>
                    {/* On calcule la taille maximale possible pour l'image tout en gardant le ratio 3:4 */}
                    {(() => {
                        const maxWidth = screenWidth;
                        const maxHeight = screenHeight;
                        
                        // On cherche à faire rentrer un rectangle 3:4 dans l'écran
                        // Priorité à la largeur pour remplir l'écran si possible
                        let finalW = maxWidth;
                        let finalH = finalW * (4/3);

                        // Si ça dépasse en hauteur, on réduit
                        if (finalH > maxHeight) {
                            finalH = maxHeight;
                            finalW = finalH * (3/4);
                        }

                        return (
                            <View style={{ width: finalW, height: finalH }}>
                                <DrawingViewer
                                    imageUri={fullScreenImageUri || drawing.cloud_image_url}
                                    canvasData={drawing.canvas_data}
                                    viewerSize={finalW}
                                    viewerHeight={finalH}
                                    transparentMode={true} // Transparent pour laisser voir le background mirroir
                                    animated={true} // Animation active comme demandé
                                    startVisible={false}
                                    autoCenter={false}
                                />
                            </View>
                        );
                    })()}
                </View>

                {/* Bouton fermeture discret en haut à droite pour pouvoir sortir */}
                <TouchableOpacity 
                    style={styles.closeBtn} 
                    onPress={onClose}
                    hitSlop={20}
                >
                    <X color="rgba(255,255,255,0.6)" size={32} />
                </TouchableOpacity>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black', // Fond noir par défaut au cas où
    },
    centeredContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeBtn: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 100,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 25,
    }
});