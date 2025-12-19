import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions, PixelRatio, Platform } from 'react-native';
import { Canvas, Path, useImage, Image as SkiaImage, Skia, Group, SkPath } from '@shopify/react-native-skia';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing, runOnJS, useDerivedValue, useAnimatedReaction } from 'react-native-reanimated';
import { getStroke } from 'perfect-freehand';

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

// Fonction utilitaire (dupliquée de DrawingCanvas pour être autonome)
function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );
  d.push("Z");
  return d.join(" ");
}

// Composant interne pour gérer l'animation d'un chemin individuel
const AnimatedPath = ({ pathData, index, progress, totalCount, startVisible }: { pathData: DrawingPath, index: number, progress: Animated.SharedValue<number>, totalCount: number, startVisible: boolean }) => {
    
    // RESTAURATION : Initialisation standard (sans forcer null si !startVisible)
    const [currentPath, setCurrentPath] = useState<SkPath | null>(() => {
        // Si filled (nouveau), on attend l'animation sauf si points manquants
        if (pathData.isFilled && pathData.points) return null;
        
        // Fallback immédiat ou ancien format
        try {
            if (pathData.svgPath && pathData.svgPath.length > 0) {
                return Skia.Path.MakeFromSVGString(pathData.svgPath);
            }
        } catch (e) {
            console.warn("Failed to create initial path", e);
        }
        return null;
    });

    const isFilled = pathData.isFilled ?? false;

    // Cette fonction s'exécute sur le JS Thread pour éviter les crashs Worklet/UI
    const updatePathOnJS = (currentProgress: number) => {
        if (!pathData.points || !isFilled) return;

        const start = index / totalCount;
        const end = (index + 1) / totalCount;

        if (currentProgress < start) {
            if (currentPath !== null) setCurrentPath(null);
        } else if (currentProgress >= end) {
            try {
                if (pathData.svgPath) {
                    const finalPath = Skia.Path.MakeFromSVGString(pathData.svgPath);
                    if (finalPath) setCurrentPath(finalPath);
                }
            } catch (e) { console.warn("Error creating final path", e); }
        } else {
            const localProgress = (currentProgress - start) / (end - start);
            const pointsCount = Math.floor(pathData.points.length * localProgress);
            
            const currentPoints = pathData.points.slice(0, Math.max(2, pointsCount));

            if (currentPoints.length > 1) {
                try {
                    const options = {
                        size: pathData.width,
                        thinning: 0.37,
                        smoothing: 0.47,
                        streamline: 0.81,
                        easing: (t: number) => t,
                        start: { taper: 5, cap: true },
                        end: { taper: 5, cap: true },
                        simulatePressure: true,
                        last: false,
                    };
                    const outline = getStroke(currentPoints, options);
                    const svg = getSvgPathFromStroke(outline);
                    
                    if (svg && svg.length > 0) {
                        const skiaPath = Skia.Path.MakeFromSVGString(svg);
                        if (skiaPath) setCurrentPath(skiaPath);
                    }
                } catch (e) {
                   // Silence errors during animation frame to prevent spam/crash
                }
            }
        }
    };

    useAnimatedReaction(
        () => progress.value,
        (val) => {
            runOnJS(updatePathOnJS)(val);
        },
        [progress, pathData]
    );

    const opacity = useDerivedValue(() => {
        if (isFilled && pathData.points) return 1; 
        const threshold = index / totalCount;
        return progress.value > threshold ? 1 : 0;
    });

    const displayPath = currentPath || 
        (!isFilled && pathData.svgPath ? (() => {
            try { return Skia.Path.MakeFromSVGString(pathData.svgPath); } catch(e) { return null; }
        })() : null);

    if (!displayPath) return null;

    return (
        <Path
            path={displayPath}
            color={pathData.isEraser ? "#000" : pathData.color}
            style={isFilled ? "fill" : "stroke"}
            strokeWidth={isFilled ? 0 : pathData.width}
            strokeCap="round"
            strokeJoin="round"
            blendMode={pathData.isEraser ? "clear" : "srcOver"}
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
    const targetHeight = viewerHeight || targetWidth * (4/3); 
    
    const image = useImage(imageUri);

    const progress = useSharedValue(startVisible ? 1 : 0);
    
    useEffect(() => {
        if (animated && !startVisible) {
            progress.value = 0;
            // Animation : Durée ajustée à 2500ms
            progress.value = withTiming(1, {
                duration: 2500, 
                easing: Easing.linear
            });
        } else {
            progress.value = 1;
        }
    }, [animated, startVisible]); 

    // 🔥 LOGIQUE DE NORMALISATION/DÉNORMALISATION CORRIGÉE POUR GALERIES
    const validPaths = useMemo(() => {
        if (!Array.isArray(canvasData)) return [];
        
        return canvasData
            .filter(p => p && (p.svgPath || (p.points && p.points.length > 0)))
            .map(p => {
                // 1. Détection du type de données
                // Si x <= 1.5, on considère que c'est normalisé (0-1)
                const isNormalized = p.points && p.points.length > 0 && p.points[0][0] <= 1.5;

                let localPoints: number[][] = [];
                let localWidth: number = p.width;

                if (isNormalized && p.points) {
                    // CAS A : Dessin Normalisé -> On multiplie par la taille cible
                    localPoints = p.points.map(([x, y, pressure]) => [
                        x * targetWidth,
                        y * targetHeight,
                        pressure
                    ]);
                    localWidth = p.width * targetWidth; // L'épaisseur est aussi relative
                } else if (!isNormalized && p.points) {
                    // CAS B : Dessin en Pixels (Legacy)
                    // On doit le redimensionner pour qu'il rentre dans la vignette
                    // Hypothèse : Le dessin en pixels a été fait sur un écran de largeur 'screenWidth'
                    const scaleRatio = targetWidth / screenWidth;
                    
                    localPoints = p.points.map(([x, y, pressure]) => [
                        x * scaleRatio,
                        y * scaleRatio,
                        pressure
                    ]);
                    localWidth = p.width * scaleRatio;
                } else {
                    // CAS C : Pas de points (Vieux SVG pur) -> On ne peut pas facilement le redimensionner ici
                    // Il s'affichera tel quel (risque de crop en vignette)
                    return p;
                }

                // 2. Régénération du SVG à partir des points redimensionnés
                // Cela garantit que le dessin s'affiche correctement à n'importe quelle échelle
                const options = {
                    size: localWidth,
                    thinning: 0.37,
                    smoothing: 0.47,
                    streamline: 0.81,
                    easing: (t: number) => t,
                    start: { taper: 5, cap: true },
                    end: { taper: 5, cap: true },
                    simulatePressure: true,
                    last: false,
                };
                
                const outline = getStroke(localPoints, options);
                const newSvgPath = getSvgPathFromStroke(outline);

                return {
                    ...p,
                    points: localPoints,
                    svgPath: newSvgPath,
                    width: localWidth,
                    isFilled: true // On force le mode fill car on a recalculé le contour
                };
            });
    }, [canvasData, targetWidth, targetHeight, screenWidth]);

    const scaleTransform = useMemo(() => {
        // On a normalisé les points ci-dessus, donc on affiche à l'échelle 1:1
        return { translateX: 0, translateY: 0, scale: 1 }; 
    }, []);

    
    return (
        <View style={{ width: targetWidth, height: targetHeight, overflow: 'hidden' }}>
            <Canvas style={{ flex: 1 }}>
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

                <Group 
                    layer={true}
                    transform={[
                        { translateX: scaleTransform.translateX },
                        { translateY: scaleTransform.translateY },
                        { scale: scaleTransform.scale }
                    ]}
                >
                    {validPaths.map((p, index) => (
                        <AnimatedPath
                            key={`${index}-${p.points ? 'filled' : 'stroke'}`}
                            pathData={p}
                            index={index}
                            totalCount={validPaths.length}
                            progress={progress}
                            startVisible={startVisible} 
                        />
                    ))}
                </Group>
            </Canvas>
        </View>
    );
};

const styles = StyleSheet.create({});