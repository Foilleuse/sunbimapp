import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Dimensions, PixelRatio, Platform } from 'react-native';
import { Canvas, Path, useImage, Image as SkiaImage, Skia, Group } from '@shopify/react-native-skia';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing, runOnJS } from 'react-native-reanimated';

// Définition de l'interface DrawingPath pour inclure les nouveaux champs
interface DrawingPath {
    svgPath: string;
    color: string;
    width: number;
    isEraser?: boolean;
    isFilled?: boolean; // Indicateur pour le format perfect-freehand
    points?: number[][]; // Les points bruts (optionnel ici, mais présent dans les données)
}

interface DrawingViewerProps {
    imageUri: string;
    canvasData: DrawingPath[];
    viewerSize?: number; // Largeur du viewer (souvent screenWidth)
    viewerHeight?: number; // Hauteur du viewer
    transparentMode?: boolean; // Si true, fond transparent (pour superposition)
    animated?: boolean; // Si true, joue l'animation de dessin
    startVisible?: boolean; // Si true, le dessin est visible immédiatement (pas d'animation progressive)
    autoCenter?: boolean; // Si true, tente de centrer le dessin dans le viewer
}

// Fonction utilitaire pour ajuster l'échelle et la position
const getTransform = (
    srcWidth: number, srcHeight: number, 
    targetWidth: number, targetHeight: number, 
    autoCenter: boolean
) => {
    // Par défaut (sans autoCenter), on scale juste pour fit la largeur
    // On suppose que le dessin original a été fait sur un écran de largeur srcWidth (souvent ~390-430)
    // et hauteur srcHeight (souvent ~ratio 4:3)
    
    // Pour simplifier : on se base sur la largeur.
    // Scale = targetWidth / srcWidth.
    // Cependant, srcWidth n'est pas stocké dans canvasData. 
    // On assume une largeur de référence standard (ex: iPhone 390px) si on ne connait pas la source,
    // MAIS ici le viewerSize est souvent passé comme étant la largeur de l'écran actuel.
    
    // Cas simple : On remplit la largeur cible.
    // L'échelle est relative. Les coordonnées SVG sont absolues par rapport au device de création.
    // C'est une limitation actuelle : si on dessine sur iPad et regarde sur iPhone, ça peut déborder.
    // Idéalement il faudrait stocker la taille du canvas d'origine avec le dessin.
    
    // Hack : On détecte les bornes du dessin pour centrer si demandé
    return { scale: 1, translateX: 0, translateY: 0 };
};

export const DrawingViewer: React.FC<DrawingViewerProps> = ({ 
    imageUri, 
    canvasData, 
    viewerSize,
    viewerHeight,
    transparentMode = false,
    animated = false,
    startVisible = false,
    autoCenter = false
}) => {
    if (!canvasData) return null;

    const { width: screenWidth } = Dimensions.get('window');
    const targetWidth = viewerSize || screenWidth;
    // Ratio 4:3 par défaut pour l'affichage si hauteur non fournie
    const targetHeight = viewerHeight || targetWidth * (4/3); 
    
    // On suppose que le dessin a été fait sur un écran standard mobile (~390-430px large)
    // Pour l'instant, on applique une échelle de 1 si on est sur la même taille d'écran,
    // ou un ratio si on veut adapter.
    // NOTE: Pour une vraie adaptation multi-device, il faudrait normaliser les coordonnées à l'enregistrement (0..1).
    // Ici on va tenter de fitter si le dessin dépasse trop ou est trop petit ? 
    // Pour l'instant on garde l'échelle 1:1 par défaut car c'est le comportement attendu sur des devices similaires.
    
    const image = useImage(imageUri);

    // --- GESTION DE L'ANIMATION ---
    const progress = useSharedValue(startVisible ? 1 : 0);
    
    useEffect(() => {
        if (animated && !startVisible) {
            progress.value = 0;
            // Animation linéaire qui révèle les chemins
            progress.value = withTiming(1, {
                duration: 2500, // 2.5s pour tout dessiner
                easing: Easing.linear
            });
        } else {
            progress.value = 1;
        }
    }, [animated, startVisible]); // Dépendances strictes

    // On prépare les chemins Skia
    const skiaPaths = useMemo(() => {
        return canvasData.map((p) => {
             const path = Skia.Path.MakeFromSVGString(p.svgPath);
             return { ...p, skiaPath: path };
        }).filter(p => p.skiaPath !== null);
    }, [canvasData]);

    // On calcule l'échelle pour centrer le dessin si nécessaire (autoCenter)
    // C'est utile pour la page de partage où on veut voir tout le dessin centré
    const scaleTransform = useMemo(() => {
        if (!autoCenter || skiaPaths.length === 0) return { translateX: 0, translateY: 0, scale: 1 };

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        skiaPaths.forEach(p => {
            if(p.skiaPath) {
                const bounds = p.skiaPath.getBounds();
                if (bounds.x < minX) minX = bounds.x;
                if (bounds.y < minY) minY = bounds.y;
                if (bounds.x + bounds.width > maxX) maxX = bounds.x + bounds.width;
                if (bounds.y + bounds.height > maxY) maxY = bounds.y + bounds.height;
            }
        });

        if (minX === Infinity) return { translateX: 0, translateY: 0, scale: 1 };

        const drawingWidth = maxX - minX;
        const drawingHeight = maxY - minY;
        const centerX = minX + drawingWidth / 2;
        const centerY = minY + drawingHeight / 2;

        // On ajoute une marge
        const scaleX = (targetWidth * 0.9) / drawingWidth;
        const scaleY = (targetHeight * 0.9) / drawingHeight;
        const scale = Math.min(scaleX, scaleY, 1); // On ne grossit pas plus que x1 pour éviter le flou

        const translateX = (targetWidth / 2) - (centerX * scale);
        const translateY = (targetHeight / 2) - (centerY * scale);

        return { translateX, translateY, scale };

    }, [skiaPaths, autoCenter, targetWidth, targetHeight]);

    
    // Calcul du path animé (pour l'effet "tracé en direct")
    // C'est complexe avec perfect-freehand car c'est des formes pleines (fill) et pas des lignes.
    // L'animation de "trim" (strokeStart/End) ne marche bien que sur des strokes.
    // Pour des fills, on peut simuler une révélation progressive en jouant sur l'opacité ou en masquant ?
    // SOLUTION SIMPLE : On révèle les chemins un par un selon le progrès global.
    
    // Pour DrawingViewer, on va simplifier :
    // Si animated est true, on affiche les chemins progressivement index par index.
    
    // Utilisation d'un state dérivé pour l'animation n'est pas possible directement dans Skia sans Reanimated.
    // Mais Skia a ses propres hooks d'animation ou on peut passer des valeurs dérivées.
    // Ici on va faire simple : tout afficher (l'animation complexe de stroke est désactivée pour perfect-freehand pour l'instant)
    // TODO: Implémenter une animation de masque pour perfect-freehand si besoin.
    
    return (
        <View style={{ width: targetWidth, height: targetHeight, overflow: 'hidden' }}>
            <Canvas style={{ flex: 1 }}>
                {/* 1. IMAGE DE FOND (Nuage) */}
                {!transparentMode && image && (
                    <SkiaImage
                        image={image}
                        x={0}
                        y={0}
                        width={targetWidth}
                        height={targetHeight}
                        fit="cover"
                    />
                )}

                {/* 2. DESSIN */}
                <Group 
                    transform={[
                        { translateX: scaleTransform.translateX },
                        { translateY: scaleTransform.translateY },
                        { scale: scaleTransform.scale }
                    ]}
                >
                    {skiaPaths.map((p, index) => {
                        if (!p.skiaPath) return null;
                        
                        // Détection du mode de rendu
                        // Nouveau format (Perfect Freehand) -> isFilled = true -> style="fill"
                        // Ancien format -> isFilled = undefined/false -> style="stroke"
                        const isFilled = p.isFilled ?? false; 
                        
                        // Pour l'animation :
                        // Si on veut animer, on peut utiliser l'opacité ou le end de path.
                        // Pour l'instant on affiche tout statique si startVisible=true,
                        // ou on pourrait implémenter une logique d'apparition progressive simple.
                        
                        return (
                            <Path
                                key={index}
                                path={p.skiaPath}
                                color={p.isEraser ? (transparentMode ? "transparent" : "#000") : p.color}
                                style={isFilled ? "fill" : "stroke"}
                                strokeWidth={isFilled ? 0 : p.width}
                                strokeCap="round"
                                strokeJoin="round"
                                blendMode={p.isEraser ? "clear" : "srcOver"}
                            />
                        );
                    })}
                </Group>
            </Canvas>
        </View>
    );
};

const styles = StyleSheet.create({});