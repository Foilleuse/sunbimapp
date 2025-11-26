import React, { forwardRef, useImperativeHandle, useState, useMemo, useRef } from 'react';
import { StyleSheet, View, Platform, Text, Dimensions, PanResponder, ActivityIndicator } from 'react-native';
import {
  Canvas, Path, useImage, Image as SkiaImage, Group, Skia, SkPath
} from '@shopify/react-native-skia';

// ---------------------------------------------------------
// VERSION V20 - INFINITE CANVAS + FIT CONTAIN
// - Initialisation : L'image s'adapte pour être vue en entier.
// - Mouvement : Plus de limites, on peut déplacer l'image à l'infini.
// ---------------------------------------------------------

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
    
    if (Platform.OS === 'web') return <View/>;

    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    const image = useImage(imageUri);
    
    // Refs (ViewShot retiré pour le moment)
    // const viewShotRef = useRef<View>(null);

    const [paths, setPaths] = useState<DrawingPath[]>([]);
    const [redoStack, setRedoStack] = useState<DrawingPath[]>([]);
    const [currentPathObj, setCurrentPathObj] = useState<SkPath | null>(null);
    
    const transform = useRef({ scale: 1, translateX: 0, translateY: 0 });
    const [_, setTick] = useState(0); 
    const forceUpdate = () => setTick(t => t + 1);
    
    const isInitialized = useRef(false);
    const baseScaleRef = useRef(1);
    
    const mode = useRef<'NONE' | 'WAITING' | 'DRAWING' | 'ZOOMING'>('NONE');
    const timer = useRef<NodeJS.Timeout | null>(null);
    const gestureStart = useRef<any>(null);
    const lastPoint = useRef<{x: number, y: number} | null>(null);

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
      getSnapshot: async () => { return undefined; }
    }), [paths]);

    // --- INITIALISATION (FIT CONTAIN - Voir toute l'image) ---
    if (image && !isInitialized.current) {
        const w = image.width();
        const h = image.height();
        
        // On calcule le zoom pour que TOUTE l'image soit visible
        const scaleW = screenWidth / w;
        const scaleH = screenHeight / h;
        const fitScale = Math.min(scaleW, scaleH); // <--- LA DIFFÉRENCE EST ICI (Min au lieu de Max)

        baseScaleRef.current = fitScale;
        
        // On centre l'image
        const centerTx = (screenWidth - w * fitScale) / 2;
        const centerTy = (screenHeight - h * fitScale) / 2;

        transform.current = { scale: fitScale, translateX: centerTx, translateY: centerTy };
        isInitialized.current = true;
    }

    const getDistance = (t1: any, t2: any) => {
        const dx = t1.pageX - t2.pageX;
        const dy = t1.pageY - t2.pageY;
        return Math.sqrt(dx*dx + dy*dy);
    };

    const startZooming = (touches: any[]) => {
        mode.current = 'ZOOMING';
        setCurrentPathObj(null); lastPoint.current = null; forceUpdate();
        const t1 = touches[0]; const t2 = touches[1];
        const dist = getDistance(t1, t2); 
        const center = { x: (t1.pageX + t2.pageX) / 2, y: (t1.pageY + t2.pageY) / 2 };
        
        const anchorX = (center.x - transform.current.translateX) / transform.current.scale;
        const anchorY = (center.y - transform.current.translateY) / transform.current.scale;
        
        gestureStart.current = { dist, scale: transform.current.scale, focalX: center.x, focalY: center.y, imageAnchorX: anchorX, imageAnchorY: anchorY };
    };

    const distBetween = (p1: {x: number, y: number}, p2: {x: number, y: number}) => {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
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

      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        
        if (touches.length === 2 && gestureStart.current) {
            if (mode.current !== 'ZOOMING') { startZooming(touches); return; }
            
            const t1 = touches[0]; const t2 = touches[1];
            const currentDist = getDistance(t1, t2); 
            const currentCenter = { x: (t1.pageX + t2.pageX) / 2, y: (t1.pageY + t2.pageY) / 2 };
            
            const start = gestureStart.current;
            const ratio = currentDist / start.dist;
            
            let newScale = start.scale * ratio;
            newScale = Math.max(0.1, Math.min(newScale, 10)); 

            // Déplacement LIBRE (Plus de limites)
            let newTx = currentCenter.x - (start.imageAnchorX * newScale);
            let newTy = currentCenter.y - (start.imageAnchorY * newScale);
            
            transform.current.scale = newScale;
            transform.current.translateX = newTx;
            transform.current.translateY = newTy;
            forceUpdate();
        } 
        else if (mode.current === 'DRAWING' && touches.length === 1 && currentPathObj && lastPoint.current) {
            const { locationX, locationY } = evt.nativeEvent;
            const x = (locationX - transform.current.translateX) / transform.current.scale;
            const y = (locationY - transform.current.translateY) / transform.current.scale;
            
            if (distBetween(lastPoint.current, {x, y}) > 2.5) {
                const xMid = (lastPoint.current.x + x) / 2;
                const yMid = (lastPoint.current.y + y) / 2;
                currentPathObj.quadTo(lastPoint.current.x, lastPoint.current.y, xMid, yMid);
                lastPoint.current = { x, y };
                setCurrentPathObj(currentPathObj); forceUpdate();
            }
        }
      },

      onPanResponderRelease: () => {
        if (mode.current === 'DRAWING' && currentPathObj) {
            if(lastPoint.current) currentPathObj.lineTo(lastPoint.current.x, lastPoint.current.y);
            setPaths(prev => [...prev, {
                svgPath: currentPathObj.toSVGString(),
                color: strokeColor,
                width: strokeWidth, // On sauve l'épaisseur brute
                isEraser: isEraserMode
            }]);
            setRedoStack([]);
        }
        mode.current = 'NONE'; setCurrentPathObj(null); lastPoint.current = null; gestureStart.current = null;
      },
      
      onPanResponderTerminate: () => { mode.current = 'NONE'; setCurrentPathObj(null); }
    }), [strokeColor, strokeWidth, currentPathObj, screenWidth, screenHeight, image, isEraserMode]);

    if (!image) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#fff"/></View>;

    const skiaTransform = [
      { translateX: transform.current.translateX },
      { translateY: transform.current.translateY },
      { scale: transform.current.scale }
    ];
    
    const IMG_W = image.width();
    const IMG_H = image.height();

    return (
      <View style={styles.container} {...panResponder.panHandlers}>
        <Canvas style={{ flex: 1 }} pointerEvents="none">
          <Group transform={skiaTransform}>
            {/* On affiche l'image entière */}
            <SkiaImage 
                image={image} 
                x={0} y={0} 
                width={IMG_W} height={IMG_H} 
                fit="none" 
            />
            
            <Group layer={true}>
                {paths.map((p, index) => {
                   const path = Skia.Path.MakeFromSVGString(p.svgPath);
                   if (!path) return null;
                   return (
                     <Path
                       key={index} path={path} color={p.isEraser ? "#000" : p.color} style="stroke"
                       // On divise par le scale pour que l'épaisseur visuelle reste constante quand on zoome
                       strokeWidth={p.width / transform.current.scale} 
                       strokeCap="round" strokeJoin="round"
                       blendMode={p.isEraser ? "clear" : "srcOver"}
                     />
                   );
                })}
                {currentPathObj && (
                  <Path
                    path={currentPathObj} color={isEraserMode ? "#000" : strokeColor} style="stroke"
                    strokeWidth={strokeWidth / transform.current.scale} strokeCap="round" strokeJoin="round"
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
  webPlaceholder: { flex: 1, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  webText: { color: '#fff' }
});