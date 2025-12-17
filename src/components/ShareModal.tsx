import React, { useMemo } from 'react';
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
// Identique à celui du feed pour garantir la cohérence visuelle
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

    // Calcul des dimensions pour l'image centrale en respectant le ratio 3:4 (comme sur le feed)
    // On veut qu'elle soit aussi grande que possible, mais sans dépasser l'écran.
    const { viewerWidth, viewerHeight } = useMemo(() => {
        // Ratio cible 3:4 (largeur / hauteur)
        const targetRatio = 3 / 4; 
        
        // On part de la largeur maximale possible (largeur écran)
        let w = screenWidth;
        // On calcule la hauteur théorique correspondant à cette largeur pour respecter le ratio 3:4
        let h = w / targetRatio; // = w * (4/3)

        // Si la hauteur calculée dépasse la hauteur de l'écran, on est contraint par la hauteur.
        // On ajuste alors la hauteur à la hauteur de l'écran, et on recalcule la largeur.
        if (h > screenHeight) {
            h = screenHeight;
            w = h * targetRatio;
        }

        // On arrondit pour éviter les demi-pixels
        return { viewerWidth: Math.floor(w), viewerHeight: Math.floor(h) };
    }, [screenWidth, screenHeight]);


    // Optimisation de l'image de fond (plein écran)
    const backgroundUri = useMemo(() => {
        if (!drawing?.cloud_image_url) return null;
        const w = Math.round(screenWidth * PixelRatio.get());
        // On prend une hauteur arbitraire assez grande pour le fond flouté, ou screenHeight
        const h = Math.round(screenHeight * PixelRatio.get()); 
        return getOptimizedImageUrl(drawing.cloud_image_url, w, h);
    }, [drawing?.cloud_image_url, screenWidth, screenHeight]);

    // Optimisation de l'image centrale (format 3:4 exact)
    const centerImageUri = useMemo(() => {
        if (!drawing?.cloud_image_url) return null;
        const w = Math.round(viewerWidth * PixelRatio.get());
        const h = Math.round(viewerHeight * PixelRatio.get());
        return getOptimizedImageUrl(drawing.cloud_image_url, w, h);
    }, [drawing?.cloud_image_url, viewerWidth, viewerHeight]);


    if (!drawing) return null;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={false} // Fond opaque (noir par défaut dans le style container)
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={styles.container}>
                {/* 1. Background étendu sur tout l'écran (flouté via MirroredBackground) */}
                {drawing.cloud_image_url && (
                    <MirroredBackground 
                        uri={backgroundUri || drawing.cloud_image_url}
                        width={screenWidth}
                        height={screenHeight} 
                        top={0} 
                    />
                )}

                {/* 2. Zone de dessin centrée (Image nette + Dessin) */}
                <View style={styles.centeredContent}>
                    {/* Conteneur avec taille explicite 3:4 */}
                    <View style={{ width: viewerWidth, height: viewerHeight, overflow: 'hidden' }}>
                        <DrawingViewer
                            imageUri={centerImageUri || drawing.cloud_image_url}
                            canvasData={drawing.canvas_data}
                            viewerSize={viewerWidth}
                            viewerHeight={viewerHeight}
                            transparentMode={false} // 🔥 CORRECTION : false pour afficher l'image du nuage dans le viewer (cadre net)
                            // Si transparentMode est true, on verrait à travers, donc le flou derrière (pas ce qu'on veut pour le cadre central)
                            // En mettant false, DrawingViewer affiche l'imageUri en fond, créant le cadre net 3:4.
                            animated={true}
                            startVisible={false}
                            autoCenter={false}
                        />
                    </View>
                </View>

                {/* Bouton fermeture discret */}
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
        backgroundColor: 'black',
    },
    centeredContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeBtn: {
        position: 'absolute',
        top: 60, // Ajusté pour safe area environ
        right: 20,
        zIndex: 100,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 25,
    }
});