import React, { forwardRef, useImperativeHandle, useState, useMemo, useRef } from 'react';
import { StyleSheet, View, Platform, Dimensions, PanResponder, ActivityIndicator } from 'react-native';
import {
  Canvas, Path, useImage, Image as SkiaImage, Group, Skia, SkPath, BlurMask
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

    // Dimensions de l'écran (Viewport)
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    
    // --- SURFACE DE DESSIN (PAPIER 3:4) ---
    const PAPER_WIDTH = screenWidth;
    const PAPER_HEIGHT = screenWidth * (4/3); // Ratio 3:4

    const image = useImage(imageUri);

    const [paths, setPaths] = useState<DrawingPath[]>([]);
    const [redoStack, setRedoStack] = useState<DrawingPath[]>([]);
    const [currentPathObj, setCurrentPathObj] = useState<SkPath | null>(null);
    
    // Transform
    const transform = useRef({ scale: 1, translateX: 0, translateY: 0 });
    const [_, setTick] = useState(0);
    const forceUpdate = () => setTick(t => t + 1);

    const isInitialized = useRef(false);
    const baseScaleRef = useRef(1);

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
      setCurrentPathObj(null); 
      lastPoint.current = null;
      
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
          const x = (locationX - transform.current.translateX) / transform.current.scale;
          const y = (locationY - transform.current.translateY) / transform.current.scale;
          const newPath = Skia.Path.Make(); newPath.moveTo(x, y);
          setCurrentPathObj(newPath); lastPoint.current = { x, y };
        }
      },

      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;

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

        if (mode.current === 'DRAWING' && touches.length === 1 && currentPathObj && lastPoint.current) {
          const { locationX, locationY } = evt.nativeEvent;
          const x = (locationX - transform.current.translateX) / transform.current.scale;
          const y = (locationY - transform.current.translateY) / transform.current.scale;
          const xMid = (lastPoint.current.x + x) / 2;
          const yMid = (lastPoint.current.y + y) / 2;
          currentPathObj.quadTo(lastPoint.current.x, lastPoint.current.y, xMid, yMid);
          lastPoint.current = { x, y };
          setCurrentPathObj(currentPathObj); forceUpdate();
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
        mode.current = 'NONE'; setCurrentPathObj(null); lastPoint.current = null; gestureStart.current = null;
      },
      onPanResponderTerminate: () => { mode.current = 'NONE'; setCurrentPathObj(null); }
    }), [strokeColor, strokeWidth, currentPathObj, screenWidth, screenHeight, image, isEraserMode]);

    if (!image) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#fff" /></View>;

    const skiaTransform = [
      { translateX: transform.current.translateX },
      { translateY: transform.current.translateY },
      { scale: transform.current.scale }
    ];

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
              />
              
              <Group layer={true}>
                {paths.map((p, index) => {
                  const path = Skia.Path.MakeFromSVGString(p.svgPath);
                  if (!path) return null;
                  const adjustedWidth = p.width / baseScaleRef.current;
                  return (
                    <Path key={index} path={path} color={p.isEraser ? "#000" : p.color} style="stroke" strokeWidth={adjustedWidth} strokeCap="round" strokeJoin="round" blendMode={p.isEraser ? "clear" : "srcOver"}>
                        {/* EFFET PLUME : Blur léger sur chaque trait */}
                        <BlurMask blur={1} style="normal" />
                    </Path>
                  );
                })}
                {currentPathObj && (
                  <Path path={currentPathObj} color={isEraserMode ? "#000" : strokeColor} style="stroke" strokeWidth={strokeWidth / baseScaleRef.current} strokeCap="round" strokeJoin="round" blendMode={isEraserMode ? "clear" : "srcOver"}>
                        {/* EFFET PLUME : Blur léger sur le trait en cours */}
                        <BlurMask blur={1} style="normal" />
                  </Path>
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