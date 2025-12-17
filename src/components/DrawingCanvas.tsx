import React, { forwardRef, useImperativeHandle, useState, useMemo, useRef } from 'react';
import { StyleSheet, View, Platform, Dimensions, PanResponder, ActivityIndicator } from 'react-native';
import {
  Canvas, Path, useImage, Image as SkiaImage, Group, Skia, SkPath, Blur
} from '@shopify/react-native-skia';
import { getStroke } from 'perfect-freehand';

interface DrawingCanvasProps {
  imageUri: string;
  strokeColor: string;
  strokeWidth: number;
  onClear?: () => void;
  isEraserMode?: boolean;
  blurRadius?: number;
}

export interface DrawingCanvasRef {
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
  getPaths: () => DrawingPath[];
  getSnapshot: () => Promise<string | undefined>;
}

// Nous enrichissons l'interface pour inclure les points (JSON)
export interface DrawingPath {
  points: number[][]; // Les points bruts [x, y, pressure]
  svgPath: string;    // Le chemin SVG généré (contour)
  color: string;
  width: number;
  isEraser?: boolean;
  isFilled?: boolean; // Indicateur pour savoir si on doit 'fill' ou 'stroke' (utile pour la rétrocompatibilité)
}

// Fonction utilitaire pour convertir le tableau de points généré par perfect-freehand en chemin SVG
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

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ imageUri, strokeColor, strokeWidth, isEraserMode, blurRadius = 0 }, ref) => {
    if (Platform.OS === 'web') return <View />;

    // Dimensions de l'écran (Viewport)
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    
    // --- SURFACE DE DESSIN (PAPIER 3:4) ---
    const PAPER_WIDTH = screenWidth;
    const PAPER_HEIGHT = screenWidth * (4/3); // Ratio 3:4

    const image = useImage(imageUri);

    const [paths, setPaths] = useState<DrawingPath[]>([]);
    const [redoStack, setRedoStack] = useState<DrawingPath[]>([]);
    
    // État pour le trait en cours de tracé
    const [currentPoints, setCurrentPoints] = useState<number[][] | null>(null);
    
    // Transform pour le zoom/pan
    const transform = useRef({ scale: 1, translateX: 0, translateY: 0 });
    const [_, setTick] = useState(0);
    const forceUpdate = () => setTick(t => t + 1);

    const isInitialized = useRef(false);
    const baseScaleRef = useRef(1);

    const mode = useRef<'NONE' | 'DRAWING' | 'ZOOMING'>('NONE');
    const gestureStart = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      clearCanvas: () => { setPaths([]); setRedoStack([]); setCurrentPoints(null); },
      undo: () => {
        setPaths(prev => {
          if (prev.length === 0) return prev;
          const newPaths = [...prev];
          const removed = newPaths.pop();
          if (removed) setRedoStack(s => [...s, removed]);
          return newPaths;
        });
      },
      redo: () => {
        setRedoStack(prev => {
          if (prev.length === 0) return prev;
          const newStack = [...prev];
          const res = newStack.pop();
          if (res) setPaths(p => [...p, res]);
          return newStack;
        });
      },
      getPaths: () => paths,
      getSnapshot: async () => undefined
    }), [paths]);

    // --- INITIALISATION DU ZOOM ---
    if (image && !isInitialized.current) {
      const heightScale = screenHeight / PAPER_HEIGHT;
      const initialScale = Math.max(1, heightScale);
      
      baseScaleRef.current = initialScale;
      
      const scaledWidth = PAPER_WIDTH * initialScale;
      const tx = (screenWidth - scaledWidth) / 2;
      const ty = 0; 
      
      transform.current = { scale: initialScale, translateX: tx, translateY: ty };
      isInitialized.current = true;
    }

    // --- GESTES ---
    const getDistance = (t1: any, t2: any) => {
      const dx = t1.pageX - t2.pageX;
      const dy = t1.pageY - t2.pageY;
      return Math.sqrt(dx * dx + dy * dy);
    };
    
    const getCenter = (t1: any, t2: any) => ({ 
      x: (t1.pageX + t2.pageX) / 2, 
      y: (t1.pageY + t2.pageY) / 2 
    });

    const startZooming = (touches: any[]) => {
      mode.current = 'ZOOMING';
      setCurrentPoints(null); 
      
      const t1 = touches[0]; const t2 = touches[1];
      const dist = getDistance(t1, t2); 
      const center = getCenter(t1, t2);
      
      const anchorX = (center.x - transform.current.translateX) / transform.current.scale;
      const anchorY = (center.y - transform.current.translateY) / transform.current.scale;
      
      gestureStart.current = { dist, scale: transform.current.scale, focalX: center.x, focalY: center.y, imageAnchorX: anchorX, imageAnchorY: anchorY };
    };

    const panResponder = useMemo(() => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          startZooming(touches);
        } else if (touches.length === 1) {
          mode.current = 'DRAWING';
          const { locationX, locationY } = evt.nativeEvent;
          // Conversion des coordonnées écran -> coordonnées papier (canvas)
          const x = (locationX - transform.current.translateX) / transform.current.scale;
          const y = (locationY - transform.current.translateY) / transform.current.scale;
          
          // Initialisation d'un nouveau trait avec le premier point
          // Format [x, y, pressure]
          setCurrentPoints([[x, y, 0.5]]);
        }
      },

      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;

        // --- GESTION DU ZOOM / PAN ---
        if (touches.length === 2) {
            if (mode.current !== 'ZOOMING') startZooming(touches);
            const t1 = touches[0]; const t2 = touches[1];
            const currentDist = getDistance(t1, t2); const currentCenter = getCenter(t1, t2);
            const start = gestureStart.current;
            if (!start) return;

            const ratio = currentDist / start.dist;
            let newScale = start.scale * ratio;
            newScale = Math.max(baseScaleRef.current, Math.min(newScale, baseScaleRef.current * 5));

            let newTx = currentCenter.x - (start.imageAnchorX * newScale);
            let newTy = currentCenter.y - (start.imageAnchorY * newScale);

            const width = PAPER_WIDTH * newScale;
            const height = PAPER_HEIGHT * newScale;
            
            if (width > screenWidth) newTx = Math.min(0, Math.max(screenWidth - width, newTx));
            else newTx = (screenWidth - width) / 2;

            if (height > screenHeight) newTy = Math.min(0, Math.max(screenHeight - height, newTy));
            else newTy = (screenHeight - height) / 2;

            transform.current = { scale: newScale, translateX: newTx, translateY: newTy };
            forceUpdate();
            return;
        }

        // --- GESTION DU DESSIN (Perfect Freehand) ---
        if (mode.current === 'DRAWING' && touches.length === 1 && currentPoints) {
          const { locationX, locationY } = evt.nativeEvent;
          const x = (locationX - transform.current.translateX) / transform.current.scale;
          const y = (locationY - transform.current.translateY) / transform.current.scale;
          
          // On ajoute simplement le point brut, perfect-freehand fera le lissage
          const newPoint = [x, y, 0.5]; // On pourrait utiliser evt.nativeEvent.force si disponible
          setCurrentPoints(prev => prev ? [...prev, newPoint] : [newPoint]);
        }
      },

      onPanResponderRelease: () => {
        if (mode.current === 'DRAWING' && currentPoints && currentPoints.length > 0) {
          // 1. Générer le contour final du trait
          const options = {
            size: strokeWidth / baseScaleRef.current, // Taille ajustée à l'échelle de base
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.5,
            easing: (t: number) => t,
            simulatePressure: true,
            last: true, // Indique que le trait est fini
          };
          
          const outlinePoints = getStroke(currentPoints, options);
          const svgPathData = getSvgPathFromStroke(outlinePoints);

          // 2. Sauvegarder le résultat final
          setPaths(prev => [...prev, {
            points: currentPoints, // On garde les points bruts (JSON)
            svgPath: svgPathData,  // On garde le SVG généré pour l'affichage facile
            color: strokeColor,
            width: strokeWidth,
            isEraser: isEraserMode,
            isFilled: true // Important : C'est une forme pleine, pas un trait
          }]);
          
          setRedoStack([]);
        }
        mode.current = 'NONE'; setCurrentPoints(null); gestureStart.current = null;
      },
      onPanResponderTerminate: () => { mode.current = 'NONE'; setCurrentPoints(null); }
    }), [strokeColor, strokeWidth, currentPoints, screenWidth, screenHeight, image, isEraserMode]);

    if (!image) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#fff" /></View>;

    const skiaTransform = [
      { translateX: transform.current.translateX },
      { translateY: transform.current.translateY },
      { scale: transform.current.scale }
    ];

    // Calcul du path en temps réel pour le trait en cours
    let currentSvgPath = "";
    if (currentPoints && currentPoints.length > 0) {
        const options = {
            size: strokeWidth / baseScaleRef.current,
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.5,
            easing: (t: number) => t,
            simulatePressure: true,
            last: false,
        };
        const outline = getStroke(currentPoints, options);
        currentSvgPath = getSvgPathFromStroke(outline);
    }
    const currentSkiaPath = currentSvgPath ? Skia.Path.MakeFromSVGString(currentSvgPath) : null;

    return (
      <View style={{ width: screenWidth, height: screenHeight, backgroundColor: 'black', overflow: 'hidden' }} {...panResponder.panHandlers}>
        <Canvas style={{ flex: 1 }} pointerEvents="none">
          <Group transform={skiaTransform}>
            
            <Group clip={{ x: 0, y: 0, width: PAPER_WIDTH, height: PAPER_HEIGHT }}>
              <SkiaImage 
                  image={image} 
                  x={0} y={0} 
                  width={PAPER_WIDTH} 
                  height={PAPER_HEIGHT} 
                  fit="cover" 
              >
                {blurRadius > 0 && <Blur blur={blurRadius} />}
              </SkiaImage>
              
              <Group layer={true}>
                {paths.map((p, index) => {
                  const path = Skia.Path.MakeFromSVGString(p.svgPath);
                  if (!path) return null;
                  
                  // Si c'est un path "filled" (perfect-freehand), on utilise style="fill" (par défaut)
                  // Si c'est un ancien path (retro-compatibilité), on utiliserait style="stroke"
                  const isFilled = p.isFilled ?? false; // Par défaut false pour les anciens dessins si pas spécifié

                  // Note : p.width est déjà intégré dans la géométrie du SVG pour perfect-freehand
                  
                  return (
                    <Path 
                        key={index} 
                        path={path} 
                        color={p.isEraser ? "#000" : p.color} 
                        style={isFilled ? "fill" : "stroke"} 
                        strokeWidth={isFilled ? 0 : (p.width / baseScaleRef.current)} // Ignoré si fill
                        strokeCap="round" 
                        strokeJoin="round" 
                        blendMode={p.isEraser ? "clear" : "srcOver"} 
                    />
                  );
                })}

                {/* Trait en cours de dessin */}
                {currentSkiaPath && (
                  <Path 
                    path={currentSkiaPath} 
                    color={isEraserMode ? "#000" : strokeColor} 
                    style="fill" // Perfect Freehand est toujours un fill
                    blendMode={isEraserMode ? "clear" : "srcOver"} 
                  />
                )}
              </Group>
            </Group>

          </Group>
        </Canvas>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
});