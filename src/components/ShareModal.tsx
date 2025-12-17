import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Dimensions, PixelRatio, StatusBar, Text, TouchableOpacity } from 'react-native';
import { Canvas, Rect, LinearGradient as SkiaGradient, vec, useImage, Image as SkiaImage, Group, Blur, Mask, Paint } from "@shopify/react-native-skia";
import { DrawingViewer } from './DrawingViewer';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
import { X } from 'lucide-react-native';

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

    // Initialisation de l'animation
    useEffect(() => {
        if (visible && drawing) {
            setAnimationReady(false);
            const timer = setTimeout(() => {
                setAnimationReady(true);
            }, 1000); 
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

    const author = drawing?.users;

    if (!drawing) return null;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={false}
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            {/* Masque la barre de statut */}
            <StatusBar hidden={true} />
            
            <View style={styles.modalContainer}>
                
                {/* FOND MIROIR GLOBAL */}
                <MirroredBackground 
                    uri={optimizedModalImageUri || drawing.cloud_image_url}
                    width={screenWidth}
                    height={screenWidth * (4/3)}
                    top={(screenHeight - (screenWidth * (4/3))) / 2} 
                />

                {/* Contenu centré */}
                <View style={styles.centeredContent}>
                    {/* Zone Image + Dessin */}
                    <View style={{ width: screenWidth, alignItems: 'center' }}> 
                        <View style={{ width: screenWidth, aspectRatio: 3/4, backgroundColor: 'transparent' }}>
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

                    {/* INFOS DU DESSIN (Titre + Auteur) PLACÉES JUSTE SOUS LA PHOTO */}
                    <View style={styles.infoContainer}>
                        <Text style={styles.drawingTitle} numberOfLines={1}>
                            {drawing.label || "Sans titre"}
                        </Text>
                        <Text style={styles.authorName}>
                            {author?.display_name || "Anonyme"}
                        </Text>
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
  modalContainer: { 
      flex: 1, 
      backgroundColor: '#000',
      justifyContent: 'center', 
      alignItems: 'center'      
  },
  centeredContent: {
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
  },
  // Style ajusté pour placer les infos sous la photo avec un espace
  infoContainer: {
      marginTop: 20, // Espace sous la photo
      alignItems: 'center',
      paddingHorizontal: 20,
      width: '100%',
  },
  drawingTitle: { 
      fontSize: 26, 
      fontWeight: '900', 
      color: '#FFF', 
      letterSpacing: -0.5, 
      textAlign: 'center',
      marginBottom: 5,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
  },
  authorName: { 
      fontSize: 16, 
      fontWeight: '600', 
      color: 'rgba(255,255,255,0.8)', 
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
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