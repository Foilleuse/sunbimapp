import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Dimensions, PixelRatio, StatusBar, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import { Canvas, Rect, LinearGradient as SkiaGradient, vec, useImage, Image as SkiaImage, Group, Blur, Mask, Paint } from "@shopify/react-native-skia";
import { DrawingViewer } from './DrawingViewer';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
// Import du module d'enregistrement d'écran
import RecordScreen from 'react-native-record-screen';
// Pour partager la vidéo (nécessite react-native-share si dispo, sinon on utilisera l'API Share de RN de base si possible, mais Share de RN ne gère pas toujours bien les fichiers vidéo sur Android sans content:// URI)
// NOTE : Le package.json mentionne "expo-sharing", donc on utilisera expo-sharing.
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';

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

    // Durée de l'animation du dessin (doit correspondre à celle dans DrawingViewer)
    const DRAWING_ANIMATION_DURATION = 3000; 
    // Délai avant le début de l'animation (ex: 1s)
    const ANIMATION_START_DELAY = 1000;
    // Délai après la fin de l'animation pour couper l'enregistrement (ex: 1s)
    const RECORDING_END_BUFFER = 1000;

    // Gestion de l'animation et de l'enregistrement
    useEffect(() => {
        let startTimer: NodeJS.Timeout;
        let stopTimer: NodeJS.Timeout;

        const startRecordingSequence = async () => {
            if (visible && drawing) {
                // 1. Démarrer l'enregistrement dès l'ouverture
                try {
                    // console.log("Début enregistrement...");
                    // Amélioration de la qualité : bitrate élevé, fps 60, dimensions réelles
                    // Note: Sur iOS, react-native-record-screen utilise ReplayKit qui a ses propres contraintes.
                    // Sur Android, on peut spécifier width/height/bitrate.
                    
                    const widthPx = Math.round(screenWidth * PixelRatio.get());
                    const heightPx = Math.round(screenHeight * PixelRatio.get());
                    
                    const res = await RecordScreen.startRecording({ 
                        mic: false,
                        width: widthPx, // Utilisation des pixels réels pour la résolution native (Android)
                        height: heightPx, // (Android)
                        bitrate: 20000000, // 20 Mbps pour très haute qualité (Android)
                        fps: 60 // (Android)
                    });
                    // console.log("Enregistrement démarré", res);
                } catch (e) {
                    console.warn("Erreur démarrage enregistrement:", e);
                }

                setAnimationReady(false);
                
                // 2. Lancer l'animation après le délai défini
                startTimer = setTimeout(() => {
                    setAnimationReady(true); // Déclenche l'animation dans DrawingViewer

                    // 3. Arrêter l'enregistrement après (Durée animation + Buffer de fin)
                    stopTimer = setTimeout(async () => {
                        try {
                            // console.log("Fin enregistrement...");
                            const res = await RecordScreen.stopRecording();
                            // console.log("Vidéo enregistrée:", res);
                            
                            if (res?.result?.outputURL) {
                                const videoUri = res.result.outputURL;
                                
                                // Vérifier si le partage est possible
                                if (await Sharing.isAvailableAsync()) {
                                    await Sharing.shareAsync(videoUri, {
                                        mimeType: 'video/mp4',
                                        dialogTitle: 'Partager mon dessin Sunbim',
                                        UTI: 'public.movie' // Pour iOS
                                    });
                                } else {
                                    Alert.alert("Erreur", "Le partage n'est pas disponible sur cet appareil");
                                }
                            }
                            
                            // Fermer la modale après l'action de partage (optionnel)
                            // onClose(); 
                        } catch (e) {
                            console.warn("Erreur arrêt enregistrement:", e);
                            Alert.alert("Erreur", "Impossible d'enregistrer la vidéo");
                        }
                    }, DRAWING_ANIMATION_DURATION + RECORDING_END_BUFFER);

                }, ANIMATION_START_DELAY);
            } else {
                setAnimationReady(false);
                // Si la modale se ferme, on s'assure d'arrêter l'enregistrement s'il est en cours
                // RecordScreen.stopRecording().catch(() => {}); 
            }
        };

        startRecordingSequence();

        return () => {
            clearTimeout(startTimer);
            clearTimeout(stopTimer);
            // Sécurité : arrêter l'enregistrement si on ferme la modale prématurément ou quitte le composant
            RecordScreen.stopRecording().catch(() => {});
        };
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
                {/* Positionné dynamiquement au-dessus de l'image */}
                <View style={[styles.headerBar, { top: geometry.topPosition - 90 }]}>
                    <View style={styles.titleContainer}>
                        <Text style={styles.headerText}>nyola</Text>
                        <Text style={styles.headerSubtitle}>And you, what do you see ?</Text>
                    </View>
                </View>

                {/* 4. INFOS (Sous la photo) */}
                {/* Remonté un peu plus haut pour être plus proche de l'image */}
                <View style={[styles.infoContainer, { top: geometry.topPosition + geometry.imgHeight - 30 }]}>
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
    // Suppression du paddingTop fixe pour le positionnement dynamique
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center', 
    alignItems: 'center',
    position: 'absolute', // Flottant
    // top est défini dynamiquement
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
    color: '#ffffffff', 
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 2, height: 2 }, 
    textShadowRadius: 0,
    lineHeight: 34,
  },
  headerSubtitle: {
      fontSize: 14, 
      fontWeight: '600',
      color: 'rgba(255,255,255,0.7)', 
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