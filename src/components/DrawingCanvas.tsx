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

    // --- DIMENSIONS PLEIN ÉCRAN ---
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    
    // On utilise toute la hauteur disponible
    const CANVAS_HEIGHT = screenHeight; 
    // Ratio de l'écran pour adapter la zone de dessin
    const SCREEN_RATIO = screenHeight / screenWidth;

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
      // On utilise la hauteur de l'image comme base de référence
      const BASE_SIZE = image.height();
      squareSizeRef.current = BASE_SIZE;
      
      // On calcule l'échelle pour que l'image remplisse la largeur de l'écran initialement
      const fitScale = screenWidth / BASE_SIZE; 
      
      baseScaleRef.current = fitScale;
      
      transform.current = { scale: fitScale, translateX: 0, translateY: 0 };
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
      mode.current = 'ZOOMING';
      setCurrentPathObj(null); 
      lastPoint.current = null;
      
      const t1 = touches[0]; 
      const t2 = touches[1];
      const dist = getDistance(t1, t2); 
      const center = getCenter(t1, t2);
      
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

        if (touches.length === 2) {
            if (mode.current !== 'ZOOMING') {
                startZooming(touches);
            }
            
            const t1 = touches[0]; 
            const t2 = touches[1];
            const currentDist = getDistance(t1, t2); 
            const currentCenter = getCenter(t1, t2);
            const start = gestureStart.current;
            
            if (!start) return;

            // 1. Zoom
            const ratio = currentDist / start.dist;
            let newScale = start.scale * ratio;
            newScale = Math.max(baseScaleRef.current, Math.min(newScale, baseScaleRef.current * 5));

            // 2. Pan
            let newTx = currentCenter.x - (start.imageAnchorX * newScale);
            let newTy = currentCenter.y - (start.imageAnchorY * newScale);

            // 3. CLAMPING (Adapté Plein Écran)
            const width = squareSizeRef.current * newScale;
            // Hauteur adaptée au ratio de l'écran
            const height = (squareSizeRef.current * SCREEN_RATIO) * newScale;
            
            const minTx = screenWidth - width;
            const maxTx = 0;
            const minTy = CANVAS_HEIGHT - height; 
            const maxTy = 0;

            if (width > screenWidth) {
                newTx = Math.min(maxTx, Math.max(minTx, newTx));
            } else {
                newTx = (screenWidth - width) / 2; 
            }

            if (height > CANVAS_HEIGHT) {
                newTy = Math.min(maxTy, Math.max(minTy, newTy));
            } else {
                newTy = (CANVAS_HEIGHT - height) / 2; 
            }

            transform.current = { scale: newScale, translateX: newTx, translateY: newTy };
            forceUpdate();
            return;
        }

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
          currentPathObj.lineTo(lastPoint.current.x, lastPoint.current.y);
          setPaths(prev => [...prev, {
            svgPath: currentPathObj.toSVGString(),
            color: strokeColor,
            width: strokeWidth,
            isEraser: isEraserMode
          }]);
          setRedoStack([]);
        }
        mode.current = 'NONE'; 
        setCurrentPathObj(null); 
        lastPoint.current = null; 
        gestureStart.current = null;
      },
      
      onPanResponderTerminate: () => { 
          mode.current = 'NONE'; 
          setCurrentPathObj(null); 
      }
    }), [strokeColor, strokeWidth, currentPathObj, screenWidth, CANVAS_HEIGHT, image, isEraserMode, SCREEN_RATIO]);

    if (!image) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#fff" /></View>;

    const skiaTransform = [
      { translateX: transform.current.translateX },
      { translateY: transform.current.translateY },
      { scale: transform.current.scale }
    ];
    // Base de référence (Largeur virtuelle)
    const DISPLAY_SIZE = squareSizeRef.current;

    return (
      <View style={{ width: screenWidth, height: CANVAS_HEIGHT, backgroundColor: 'black', overflow: 'hidden' }} {...panResponder.panHandlers}>
        <Canvas style={{ flex: 1 }} pointerEvents="none">
          <Group transform={skiaTransform}>
            {/* L'image remplit la zone plein écran (Ratio écran) */}
            <SkiaImage 
                image={image} 
                x={0} y={0} 
                width={DISPLAY_SIZE} 
                height={DISPLAY_SIZE * SCREEN_RATIO} 
                fit="cover" 
            />
            <Group layer={true}>
              {paths.map((p, index) => {
                const path = Skia.Path.MakeFromSVGString(p.svgPath);
                if (!path) return null;
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
  loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
});