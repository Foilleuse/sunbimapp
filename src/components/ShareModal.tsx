import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Dimensions, TouchableOpacity, PixelRatio, Pressable, ScrollView } from 'react-native';
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
const MirroredBackground = ({ uri, width, height, top }: { uri: string, width: number, height: number, top: number }) => {
    const image = useImage(uri);
    
    if (!image) return null;

    const bottom = top + height;
    const BLUR_RADIUS = 25; 

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
    const [animationReady, setAnimationReady] = useState(false);

    // Initialisation de l'animation comme dans DrawingDetailModal
    useEffect(() => {
        if (visible && drawing) {
            setAnimationReady(false);
            const timer = setTimeout(() => {
                setAnimationReady(true);
            }, 500); 
            return () => clearTimeout(timer);
        } else {
            setAnimationReady(false);
        }
    }, [visible, drawing]);

    // Optimisation de l'image de fond et centrale
    const optimizedModalImageUri = useMemo(() => {
        if (!drawing?.cloud_image_url) return null;
        const w = Math.round(screenWidth * PixelRatio.get());
        const h = Math.round(w * (4/3));
        return getOptimizedImageUrl(drawing.cloud_image_url, w, h);
    }, [drawing, screenWidth]);

    if (!drawing) return null;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={false}
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={styles.modalContainer}>
                
                {/* FOND MIROIR GLOBAL */}
                <MirroredBackground 
                    uri={optimizedModalImageUri || drawing.cloud_image_url}
                    width={screenWidth}
                    height={screenWidth * (4/3)}
                    top={60} 
                />

                <ScrollView 
                    contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header avec bouton fermer - Hauteur fixe 60 pour alignement */}
                    <View style={[styles.header, { height: 60, paddingVertical: 0, paddingTop: 10, paddingHorizontal: 15, backgroundColor: 'transparent', width: '100%', justifyContent: 'center' }]}> 
                        <TouchableOpacity onPress={onClose} style={styles.closeBtnTransparent} hitSlop={15}>
                            <X color="#FFF" size={28} />
                        </TouchableOpacity>
                    </View>

                    {/* Zone Image + Dessin */}
                    <View style={{ width: screenWidth, alignItems: 'center' }}> 
                        <View style={{ width: screenWidth, aspectRatio: 3/4, backgroundColor: 'transparent', marginTop: 0 }}>
                            <View style={{ flex: 1 }}>
                                {animationReady ? (
                                    <DrawingViewer
                                        imageUri={optimizedModalImageUri || drawing.cloud_image_url} 
                                        canvasData={drawing.canvas_data}
                                        viewerSize={screenWidth} 
                                        viewerHeight={screenWidth * (4/3)} 
                                        transparentMode={true} 
                                        startVisible={false} 
                                        animated={true}
                                        autoCenter={false} 
                                    />
                                ) : (
                                    <View style={{ width: '100%', height: '100%' }} /> 
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Pas d'infoCard ni de réactions ici, juste l'image pure */}
                    
                </ScrollView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: '#000' }, // Fond noir par défaut
  header: { alignItems: 'flex-end', borderBottomWidth: 0, borderColor: '#eee' }, 
  closeBtnTransparent: { padding: 5, backgroundColor: 'transparent' },
});