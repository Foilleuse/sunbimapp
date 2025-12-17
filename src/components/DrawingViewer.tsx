import React, { useEffect, useRef, useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions, PixelRatio, Platform } from 'react-native';
import { Canvas, Path, useImage, Image as SkiaImage, Skia, Group } from '@shopify/react-native-skia';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing, runOnJS, useDerivedValue } from 'react-native-reanimated';

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

// Composant interne pour gérer l'animation d'un chemin individuel
// Cela permet d'optimiser le rendu si nécessaire, mais ici on va gérer l'affichage global
const AnimatedPath = ({ path, color, width, isEraser, isFilled, index, progress, totalCount }: any) => {
    // Calcul de l'opacité ou de la visibilité basé sur le progrès global
    // Si progress (0..1) * totalCount > index, alors ce trait doit être visible.
    
    // Note: Dans le contexte Skia React Native, utiliser des valeurs dérivées complexes dans une boucle map
    // peut être lourd. Une approche simple est d'utiliser un opacité animée.
    
    // ASTUCE: Pour simuler le tracé, on peut simplement switcher l'opacité de 0 à 1 quand c'est le tour du trait.
    // Le trait apparaît "pop", ce qui est moins fluide que le tracé progressif, mais c'est le mieux pour des fills.
    // Pour améliorer, on pourrait faire un fade-in rapide.
    
    const opacity = useDerivedValue(() => {
        const threshold = index / totalCount;
        const nextThreshold = (index + 1) / totalCount;
        
        if (progress.value > threshold) {
            // Le trait est en cours d'apparition ou déjà apparu
            // On peut faire un fade-in rapide entre threshold et threshold + petit epsilon
             return 1;
        }
        return 0;
    });

    return (
        <Path
            path={path}
            color={isEraser ? "#000" : color} // La couleur noire pour l'effaceur sera gérée par blendMode
            style={isFilled ? "fill" : "stroke"}
            strokeWidth={isFilled ? 0 : width}
            strokeCap="round"
            strokeJoin="round"
            blendMode={isEraser ? "clear" : "srcOver"}
            opacity={opacity}
        />
    );
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

        const scaleX = (targetWidth * 0.9) / drawingWidth;
        const scaleY = (targetHeight * 0.9) / drawingHeight;
        const scale = Math.min(scaleX, scaleY, 1); 

        const translateX = (targetWidth / 2) - (centerX * scale);
        const translateY = (targetHeight / 2) - (centerY * scale);

        return { translateX, translateY, scale };

    }, [skiaPaths, autoCenter, targetWidth, targetHeight]);

    
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
                        
                        const isFilled = p.isFilled ?? false; 
                        
                        return (
                            <AnimatedPath
                                key={index}
                                path={p.skiaPath}
                                color={p.isEraser ? (transparentMode ? "transparent" : "#000") : p.color}
                                width={p.width}
                                isEraser={p.isEraser}
                                isFilled={isFilled}
                                index={index}
                                totalCount={skiaPaths.length}
                                progress={progress}
                            />
                        );
                    })}
                </Group>
            </Canvas>
        </View>
    );
};

const styles = StyleSheet.create({});