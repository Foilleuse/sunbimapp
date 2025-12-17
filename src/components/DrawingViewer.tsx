import React, { useEffect, useRef, useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions, PixelRatio, Platform } from 'react-native';
import { Canvas, Path, useImage, Image as SkiaImage, Skia, Group } from '@shopify/react-native-skia';
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
const AnimatedPath = ({ pathData, index, progress, totalCount }: { pathData: DrawingPath, index: number, progress: Animated.SharedValue<number>, totalCount: number }) => {
    const [currentPath, setCurrentPath] = useState(pathData.isFilled ? Skia.Path.MakeFromSVGString("") : Skia.Path.MakeFromSVGString(pathData.svgPath));
    const isFilled = pathData.isFilled ?? false;

    // Si c'est un trait "ancien format" (stroke simple), on utilise l'opacité
    // Si c'est un trait "perfect-freehand" (fill), on recalcule le path
    
    useAnimatedReaction(
        () => progress.value,
        (currentProgress) => {
            if (!pathData.points || !isFilled) return;

            // Calcul de la fenêtre de temps pour ce trait spécifique
            // Chaque trait a une portion de l'animation globale (1 / totalCount)
            const start = index / totalCount;
            const end = (index + 1) / totalCount;
            
            if (currentProgress < start) {
                // Pas encore commencé
                if (currentPath !== null) runOnJS(setCurrentPath)(null);
            } else if (currentProgress >= end) {
                // Terminé -> Afficher le path final complet (optimisation)
                // On ne recalcule plus, on met le path final SVG stocké
                // Attention : il faut que le SVG stocké soit valide.
                const finalPath = Skia.Path.MakeFromSVGString(pathData.svgPath);
                runOnJS(setCurrentPath)(finalPath);
            } else {
                // En cours de tracé
                // On normalise le progrès pour ce trait (0 à 1)
                const localProgress = (currentProgress - start) / (end - start);
                
                // On prend une sous-section des points
                const pointsCount = Math.floor(pathData.points.length * localProgress);
                const currentPoints = pathData.points.slice(0, Math.max(2, pointsCount)); // Au moins 2 points pour un trait

                if (currentPoints.length > 1) {
                    const options = {
                        size: pathData.width,
                        thinning: 0.37,
                        smoothing: 0.47,
                        streamline: 0.81,
                        easing: (t: number) => t,
                        start: { taper: 5, cap: true },
                        end: { taper: 5, cap: true },
                        simulatePressure: true,
                        last: false, // En cours de tracé
                    };
                    const outline = getStroke(currentPoints, options);
                    const svg = getSvgPathFromStroke(outline);
                    const skiaPath = Skia.Path.MakeFromSVGString(svg);
                    runOnJS(setCurrentPath)(skiaPath);
                }
            }
        },
        [progress, pathData]
    );

    // Rendu pour les anciens traits (Stroke simple sans points JSON)
    // On utilise l'opacité pour les faire apparaitre "pop"
    const opacity = useDerivedValue(() => {
        if (isFilled && pathData.points) return 1; // Géré par le path dynamique ci-dessus

        const threshold = index / totalCount;
        return progress.value > threshold ? 1 : 0;
    });

    if (!currentPath && isFilled) return null;

    // Fallback pour ancien format (si pas de path dynamique encore)
    const displayPath = currentPath || (pathData.svgPath ? Skia.Path.MakeFromSVGString(pathData.svgPath) : null);
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

    // --- GESTION DE L'ANIMATION ---
    const progress = useSharedValue(startVisible ? 1 : 0);
    
    useEffect(() => {
        if (animated && !startVisible) {
            progress.value = 0;
            progress.value = withTiming(1, {
                duration: 3500, // Un peu plus lent pour apprécier le tracé (3.5s)
                easing: Easing.linear
            });
        } else {
            progress.value = 1;
        }
    }, [animated, startVisible]); 

    // On prépare les données (plus besoin de pré-calculer les skiaPaths ici car AnimatedPath le fait)
    // Mais on a besoin de filtrer les données valides
    const validPaths = useMemo(() => {
        return canvasData.filter(p => p.svgPath || (p.points && p.points.length > 0));
    }, [canvasData]);

    const scaleTransform = useMemo(() => {
        if (!autoCenter || validPaths.length === 0) return { translateX: 0, translateY: 0, scale: 1 };
        
        // Calcul simplifié des bounds (approximatif pour le centrage)
        // Pour être précis, il faudrait parser tous les SVG, ce qui est lourd.
        // On va supposer que le centrage n'est pas critique pour l'instant ou utiliser une bbox simple si points dispos.
        return { translateX: 0, translateY: 0, scale: 1 }; 
        
        // TODO: Réimplémenter un calcul de bounds léger si nécessaire
    }, [validPaths, autoCenter]);

    
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
                    transform={[
                        { translateX: scaleTransform.translateX },
                        { translateY: scaleTransform.translateY },
                        { scale: scaleTransform.scale }
                    ]}
                >
                    {validPaths.map((p, index) => (
                        <AnimatedPath
                            key={index}
                            pathData={p}
                            index={index}
                            totalCount={validPaths.length}
                            progress={progress}
                        />
                    ))}
                </Group>
            </Canvas>
        </View>
    );
};

const styles = StyleSheet.create({});