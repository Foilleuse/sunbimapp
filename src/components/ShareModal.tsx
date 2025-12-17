import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Dimensions, PixelRatio, StatusBar, Text, TouchableOpacity } from 'react-native';
import { Canvas, Rect, LinearGradient as SkiaGradient, vec, useImage, Image as SkiaImage, Group, Blur, Mask, Paint } from "@shopify/react-native-skia";
import { DrawingViewer } from './DrawingViewer';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
import { SafeAreaView } from 'react-native-safe-area-context';
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

    // Calculs de géométrie pour alignement parfait
    const geometry = useMemo(() => {
        const imgWidth = screenWidth;
        const imgHeight = screenWidth * (4/3);
        // Centrage vertical exact
        const topPosition = (screenHeight - imgHeight) / 2;
        
        return { imgWidth, imgHeight, topPosition };
    }, [screenWidth, screenHeight]);

    // Optimisation de l'image
    const optimizedModalImageUri = useMemo(() => {
        if (!drawing?.cloud_image_url) return null;
        const w = Math.round(geometry.imgWidth * PixelRatio.get());
        const h = Math.round(geometry.imgHeight * PixelRatio.get());
        return getOptimizedImageUrl(drawing.cloud_image_url, w, h);
    }, [drawing, geometry]);

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
            <StatusBar hidden={true} />
            
            <View style={styles.modalContainer}>
                
                {/* 1. BACKGROUND MIROIR (Positionné via `top`) */}
                <MirroredBackground 
                    uri={optimizedModalImageUri || drawing.cloud_image_url}
                    width={geometry.imgWidth}
                    height={geometry.imgHeight}
                    top={geometry.topPosition} 
                />

                {/* 2. DESSIN/PHOTO (Positionné absolument au même endroit que le background pour alignement) */}
                <View style={[styles.drawingLayer, { 
                    top: geometry.topPosition, 
                    width: geometry.imgWidth, 
                    height: geometry.imgHeight 
                }]}>
                    {animationReady ? (
                        <DrawingViewer
                            imageUri={optimizedModalImageUri || drawing.cloud_image_url} 
                            canvasData={drawing.canvas_data}
                            viewerSize={geometry.imgWidth} 
                            viewerHeight={geometry.imgHeight} 
                            transparentMode={true} 
                            startVisible={false} 
                            animated={true}
                            autoCenter={false} 
                        />
                    ) : (
                        // Placeholder transparent pendant le délai
                        <View style={{ width: '100%', height: '100%' }} /> 
                    )}
                </View>

                {/* 3. HEADER "nyola" STYLE SUNBIMHEADER */}
                {/* On garde la structure headerBar mais transparent et positionné en haut */}
                <View style={styles.headerBar}>
                    <View style={styles.titleContainer}>
                        <Text style={styles.headerText}>nyola</Text>
                        <Text style={styles.headerSubtitle}>And you, what do you see ?</Text>
                    </View>
                </View>

                {/* 4. INFOS (Sous la photo) */}
                <View style={[styles.infoContainer, { top: geometry.topPosition + geometry.imgHeight + 20 }]}>
                    <Text style={styles.drawingTitle} numberOfLines={1}>
                        {drawing.label || "Sans titre"}
                    </Text>
                    <Text style={styles.authorName}>
                        {author?.display_name || "Anonyme"}
                    </Text>
                </View>

            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
  modalContainer: { 
      flex: 1, 
      backgroundColor: '#000',
  },
  drawingLayer: {
      position: 'absolute',
      left: 0,
      // Top, Width, Height sont définis dynamiquement
  },
  // --- NOUVEAUX STYLES HEADER INSPIRÉS DE SUNBIMHEADER ---
  headerBar: {
    width: '100%',
    backgroundColor: 'transparent', 
    paddingTop: 60, // Marge top similaire au SunbimHeader
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center', 
    alignItems: 'center',
    position: 'absolute', // Flottant
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  titleContainer: {
      alignItems: 'center',
  },
  headerText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffffff', // Blanc comme demandé (transparent text hack ou juste blanc ?) -> Le code référence utilisait #ffffffff (blanc opaque)
    // On garde le blanc opaque pour que ça soit visible sur le fond sombre/image
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 2, height: 2 }, 
    textShadowRadius: 0,
    lineHeight: 34,
  },
  headerSubtitle: {
      fontSize: 14, // Un peu plus petit que le titre
      fontWeight: '600',
      color: 'rgba(255,255,255,0.7)', // Style "whiteSubText" ou similaire
      marginTop: 2,
      fontStyle: 'italic',
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
  },
  
  infoContainer: {
      position: 'absolute',
      width: '100%',
      alignItems: 'center',
      paddingHorizontal: 20,
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
  }
});