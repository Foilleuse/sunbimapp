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
        const targetRatio = 3 / 4;
        
        // Essayer de remplir la largeur
        let w = screenWidth;
        let h = w / targetRatio; // h = w * (4/3)

        // Si la hauteur dépasse l'écran, on limite par la hauteur
        if (h > screenHeight) {
            h = screenHeight;
            w = h * targetRatio;
        }

        return { viewerWidth: w, viewerHeight: h };
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
                    <View style={{ width: viewerWidth, height: viewerHeight }}>
                        <DrawingViewer
                            imageUri={centerImageUri || drawing.cloud_image_url}
                            canvasData={drawing.canvas_data}
                            viewerSize={viewerWidth}
                            viewerHeight={viewerHeight}
                            transparentMode={true} // IMPORTANT: true pour voir le MirroredBackground derrière?
                            // ATTENTION: Si transparentMode=true, on voit le fond flou à travers le dessin.
                            // Si on veut voir l'image NETTE sous le dessin (comme sur le feed), il faut :
                            // Soit transparentMode=false (DrawingViewer affiche l'image)
                            // Soit transparentMode=true ET on affiche l'image nette ici manuellement.
                            // Comme DrawingViewer gère bien l'affichage de l'image avec 'resizeMode="cover"',
                            // le plus simple est de mettre transparentMode={false} pour avoir l'image nette DANS le viewer.
                            // MAIS le MirroredBackground du feed utilise un Mask pour fondre les bords haut/bas.
                            // Ici, on est en mode "plein écran" ou "focus".
                            // Si on veut EXACTEMENT comme le feed (image nette au centre qui se fond dans le flou),
                            // alors le MirroredBackground s'en occupe déjà (partie "PREMIER-PLAN").
                            // DANS CE CAS : le MirroredBackground affiche DÉJÀ l'image nette au centre (si on lui passe les bonnes dims).
                            // SAUF QUE MirroredBackground prend 'width' et 'height' de l'écran ici.
                            // Donc il affiche l'image nette sur TOUT l'écran avec un masque haut/bas.
                            
                            // Si on veut le rectangle 3:4 spécifique visible au centre par dessus le flou :
                            // Option A : Le MirroredBackground fait tout le travail de fond. On met juste le dessin par dessus (transparentMode=true).
                            // Cela veut dire que l'image "nette" est celle du background.
                            // Si le ratio de l'écran n'est pas 3:4, l'image de fond sera cropée différemment de l'image 3:4 attendue.
                            
                            // Option B (Recommandée pour "comme sur le feed") :
                            // On garde le MirroredBackground pour l'ambiance.
                            // On affiche le DrawingViewer avec transparentMode={false} (donc avec l'image) au centre, format 3:4.
                            // Cela crée un "cadre" net 3:4 au centre, par dessus le fond flou.
                             
                            animated={true}
                            startVisible={false}
                            autoCenter={false}
                            // On force transparentMode={false} pour voir l'image nette 3:4 DANS le cadre
                            // (contrairement au feed où on superpose parfois sur un fond global)
                            // Ici on veut être sûr de voir l'image cadrée 3:4.
                            // Essayons transparentMode={false} pour avoir l'image 3:4 explicite.
                            // Si le background derrière est visible sur les bords (si écran > 3:4), c'est parfait.
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