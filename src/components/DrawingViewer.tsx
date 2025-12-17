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
    
    // CORRECTION CRITIQUE : Si on doit animer (startVisible=false), on initialise currentPath à null pour être sûr qu'il ne s'affiche pas
    const [currentPath, setCurrentPath] = useState<SkPath | null>(() => {
        if (!startVisible) return null; // Invisible au départ si on anime
        
        // Si startVisible=true, on affiche tout de suite le chemin final
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

        // Si l'animation n'a pas encore atteint ce trait, on le cache
        if (currentProgress <= start) {
            if (currentPath !== null) setCurrentPath(null);
        } 
        // Si l'animation a dépassé ce trait, on affiche le trait final
        else if (currentProgress >= end) {
            try {
                if (pathData.svgPath) {
                    const finalPath = Skia.Path.MakeFromSVGString(pathData.svgPath);
                    // On ne met à jour que si ce n'est pas déjà le final path (pour éviter re-render)
                    // Note: Skia object comparison is not direct, but setting it again is safe-ish
                    if (finalPath) setCurrentPath(finalPath);
                }
            } catch (e) { console.warn("Error creating final path", e); }
        } 
        // Si on est en train de tracer ce trait
        else {
            const localProgress = (currentProgress - start) / (end - start);
            const pointsCount = Math.floor(pathData.points.length * localProgress);
            
            // On s'assure d'avoir assez de points pour getStroke
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
            // On ne lance le calcul que si l'animation est active (startVisible=false)
            if (!startVisible) {
                runOnJS(updatePathOnJS)(val);
            }
        },
        [progress, pathData, startVisible]
    );

    const opacity = useDerivedValue(() => {
        // Si startVisible est true, opacité à 1 tout de suite
        if (startVisible) return 1;
        
        // Pour les nouveaux paths "filled" (avec points), la visibilité est gérée par currentPath (qui est null au début)
        // Donc on peut laisser l'opacité à 1, car null ne s'affiche pas.
        if (isFilled && pathData.points) return 1; 
        
        // Pour les anciens paths "stroke" (sans points), on utilise l'opacité pour les révéler
        // car on ne peut pas recalculer leur géométrie partielle.
        const threshold = index / totalCount;
        return progress.value > threshold ? 1 : 0;
    });

    // Fallback d'affichage :
    // 1. currentPath (calculé dynamiquement ou null)
    // 2. Si startVisible=true et pas de currentPath encore, on essaie de charger le SVG statique
    const displayPath = currentPath || 
        (startVisible && !isFilled && pathData.svgPath ? (() => {
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

    // Initialisation : on commence à 0 si on doit animer, sinon 1
    const progress = useSharedValue(startVisible ? 1 : 0);
    
    useEffect(() => {
        if (animated && !startVisible) {
            // On force le reset à 0 avant de lancer l'animation
            progress.value = 0;
            progress.value = withTiming(1, {
                duration: 3500, 
                easing: Easing.linear
            });
        } else {
            progress.value = 1;
        }
    }, [animated, startVisible]); 

    const validPaths = useMemo(() => {
        if (!Array.isArray(canvasData)) return [];
        return canvasData.filter(p => p && (p.svgPath || (p.points && p.points.length > 0)));
    }, [canvasData]);

    const scaleTransform = useMemo(() => {
        if (autoCenter && validPaths.length > 0) {
            // Centrage auto désactivé pour la galerie (car géré par layout externe)
            // Mais dispo si besoin pour d'autres vues
            return { translateX: 0, translateY: 0, scale: 1 }; 
        }
        // Mise à l'échelle standard pour adapter le canvas original à la vue cible
        const scale = targetWidth / screenWidth;
        return { translateX: 0, translateY: 0, scale }; 
    }, [validPaths, autoCenter, targetWidth, screenWidth]);

    
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