import React, { forwardRef, useImperativeHandle, useState, useMemo, useRef } from 'react';
import { StyleSheet, View, Platform, Dimensions, PanResponder, ActivityIndicator } from 'react-native';
import {
  Canvas, Path, useImage, Image as SkiaImage, Group, Skia, SkPath
} from '@shopify/react-native-skia';

interface DrawingCanvasProps {
  imageUri: string;
  strokeColor: string;
  strokeWidth: number;
  onClear?: () => void;
  isEraserMode?: boolean;
}

export interface DrawingCanvasRef {
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
  getPaths: () => DrawingPath[];
  getSnapshot: () => Promise<string | undefined>;
}

interface DrawingPath {
  svgPath: string;
  color: string;
  width: number;
  isEraser?: boolean;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ imageUri, strokeColor, strokeWidth, isEraserMode }, ref) => {
    if (Platform.OS === 'web') return <View />;

    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    const image = useImage(imageUri);

    const [paths, setPaths] = useState<DrawingPath[]>([]);
    const [redoStack, setRedoStack] = useState<DrawingPath[]>([]);
    const [currentPathObj, setCurrentPathObj] = useState<SkPath | null>(null);
    
    // État de la transformation (Zoom/Pan)
    const transform = useRef({ scale: 1, translateX: 0, translateY: 0 });
    
    // Force update pour rafraîchir le Canvas Skia sans re-render React complet
    const [_, setTick] = useState(0);
    const forceUpdate = () => setTick(t => t + 1);

    const isInitialized = useRef(false);
    const baseScaleRef = useRef(1);
    const squareSizeRef = useRef<number>(1000); 

    const mode = useRef<'NONE' | 'DRAWING' | 'ZOOMING'>('NONE');
    const gestureStart = useRef<any>(null);
    const lastPoint = useRef<{ x: number, y: number } | null>(null);

    useImperativeHandle(ref, () => ({
      clearCanvas: () => { setPaths([]); setRedoStack([]); setCurrentPathObj(null); },
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

    // --- INITIALISATION ---
    if (image && !isInitialized.current) {
      const SIZE = image.height();
      squareSizeRef.current = SIZE;
      
      // On calcule l'échelle pour que l'image COUVRE l'écran (Fit Height généralement pour portrait)
      const fitScale = screenHeight / SIZE; 
      
      baseScaleRef.current = fitScale;
      
      // On centre horizontalement
      const visualWidth = SIZE * fitScale;
      const centerTx = (screenWidth - visualWidth) / 2;
      
      transform.current = { scale: fitScale, translateX: centerTx, translateY: 0 };
      isInitialized.current = true;
    }

    // --- OUTILS GESTES ---
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
      // Passage immédiat en mode ZOOM
      mode.current = 'ZOOMING';
      // Annulation du trait en cours s'il y en a un (pour éviter de dessiner en zoomant)
      setCurrentPathObj(null); 
      lastPoint.current = null;
      
      const t1 = touches[0]; 
      const t2 = touches[1];
      const dist = getDistance(t1, t2); 
      const center = getCenter(t1, t2);
      
      // Point d'ancrage local dans l'image
      const anchorX = (center.x - transform.current.translateX) / transform.current.scale;
      const anchorY = (center.y - transform.current.translateY) / transform.current.scale;
      
      gestureStart.current = { 
        dist, 
        scale: transform.current.scale, 
        focalX: center.x, 
        focalY: center.y, 
        imageAnchorX: anchorX, 
        imageAnchorY: anchorY,
      };
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
          // Conversion écran -> dessin
          const x = (locationX - transform.current.translateX) / transform.current.scale;
          const y = (locationY - transform.current.translateY) / transform.current.scale;
          
          const newPath = Skia.Path.Make(); 
          newPath.moveTo(x, y);
          setCurrentPathObj(newPath); 
          lastPoint.current = { x, y };
        }
      },

      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;

        // DÉTECTION DYNAMIQUE : Si 2 doigts apparaissent, on force le mode ZOOM
        if (touches.length === 2) {
            if (mode.current !== 'ZOOMING') {
                startZooming(touches);
            }
            
            // --- LOGIQUE ZOOM ---
            const t1 = touches[0]; 
            const t2 = touches[1];
            const currentDist = getDistance(t1, t2); 
            const currentCenter = getCenter(t1, t2);
            const start = gestureStart.current;
            
            if (!start) return;

            // 1. Calcul du nouveau scale
            const ratio = currentDist / start.dist;
            let newScale = start.scale * ratio;
            // Limites : Min = BaseScale (Plein écran), Max = 5x
            newScale = Math.max(baseScaleRef.current, Math.min(newScale, baseScaleRef.current * 5));

            // 2. Calcul du nouveau Translate (Pan)
            // On veut que le point sous les doigts reste visuellement fixe
            let newTx = currentCenter.x - (start.imageAnchorX * newScale);
            let newTy = currentCenter.y - (start.imageAnchorY * newScale);

            // 3. CLAMPING (Bordures strictes)
            const width = squareSizeRef.current * newScale;
            const height = squareSizeRef.current * newScale;
            
            // Min/Max pour ne pas voir de noir sur les bords
            const minTx = screenWidth - width;
            const maxTx = 0;
            const minTy = screenHeight - height;
            const maxTy = 0;

            // Si l'image est plus large que l'écran, on clamp. Sinon on centre.
            if (width > screenWidth) {
                newTx = Math.min(maxTx, Math.max(minTx, newTx));
            } else {
                newTx = (screenWidth - width) / 2; 
            }

            if (height > screenHeight) {
                newTy = Math.min(maxTy, Math.max(minTy, newTy));
            } else {
                newTy = (screenHeight - height) / 2; 
            }

            transform.current = { scale: newScale, translateX: newTx, translateY: newTy };
            forceUpdate();
            return;
        }

        // --- LOGIQUE DESSIN (1 DOIGT) ---
        if (mode.current === 'DRAWING' && touches.length === 1 && currentPathObj && lastPoint.current) {
          const { locationX, locationY } = evt.nativeEvent;
          const x = (locationX - transform.current.translateX) / transform.current.scale;
          const y = (locationY - transform.current.translateY) / transform.current.scale;
          
          const xMid = (lastPoint.current.x + x) / 2;
          const yMid = (lastPoint.current.y + y) / 2;
          currentPathObj.quadTo(lastPoint.current.x, lastPoint.current.y, xMid, yMid);
          
          lastPoint.current = { x, y };
          setCurrentPathObj(currentPathObj); 
          forceUpdate();
        }
      },

      onPanResponderRelease: () => {
        if (mode.current === 'DRAWING' && currentPathObj && lastPoint.current) {
          // Fin du trait
          currentPathObj.lineTo(lastPoint.current.x, lastPoint.current.y);
          setPaths(prev => [...prev, {
            svgPath: currentPathObj.toSVGString(),
            color: strokeColor,
            width: strokeWidth,
            isEraser: isEraserMode
          }]);
          setRedoStack([]);
        }
        // Reset complet
        mode.current = 'NONE'; 
        setCurrentPathObj(null); 
        lastPoint.current = null; 
        gestureStart.current = null;
      },
      
      onPanResponderTerminate: () => { 
          mode.current = 'NONE'; 
          setCurrentPathObj(null); 
      }
    }), [strokeColor, strokeWidth, currentPathObj, screenWidth, screenHeight, image, isEraserMode]);

    if (!image) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#fff" /></View>;

    const skiaTransform = [
      { translateX: transform.current.translateX },
      { translateY: transform.current.translateY },
      { scale: transform.current.scale }
    ];
    const DISPLAY_SIZE = squareSizeRef.current;

    return (
      <View style={styles.container} {...panResponder.panHandlers}>
        <Canvas style={{ flex: 1 }} pointerEvents="none">
          <Group transform={skiaTransform}>
            <SkiaImage image={image} x={0} y={0} width={DISPLAY_SIZE} height={DISPLAY_SIZE} fit="cover" />
            <Group layer={true}>
              {paths.map((p, index) => {
                const path = Skia.Path.MakeFromSVGString(p.svgPath);
                if (!path) return null;
                // Ajustement de l'épaisseur du trait selon le zoom de base pour garder la cohérence visuelle
                const adjustedWidth = p.width / baseScaleRef.current;
                return (
                  <Path
                    key={index} path={path} color={p.isEraser ? "#000" : p.color} style="stroke"
                    strokeWidth={adjustedWidth} strokeCap="round" strokeJoin="round"
                    blendMode={p.isEraser ? "clear" : "srcOver"}
                  />
                );
              })}
              {currentPathObj && (
                <Path
                  path={currentPathObj} color={isEraserMode ? "#000" : strokeColor} style="stroke"
                  strokeWidth={strokeWidth / baseScaleRef.current} strokeCap="round" strokeJoin="round"
                  blendMode={isEraserMode ? "clear" : "srcOver"}
                />
              )}
            </Group>
          </Group>
        </Canvas>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black', overflow: 'hidden' },
  loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
});