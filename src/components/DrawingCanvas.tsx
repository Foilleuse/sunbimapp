import React, { forwardRef, useImperativeHandle, useState, useMemo, useRef } from 'react';
import { StyleSheet, View, Platform, Text, Dimensions, PanResponder, ActivityIndicator } from 'react-native';
import {
  Canvas, Path, useImage, Image as SkiaImage, Group, Skia, SkPath
} from '@shopify/react-native-skia';
import { useDrawing, DrawingPath } from '../hooks/useDrawing';

// ---------------------------------------------------------
// VERSION V19 REFACTORISÉE
// - Comportement : Carré 1:1 au centre (WYSIWYG)
// - Logique : Déportée dans useDrawing
// - Données : getPaths renvoie l'objet complet
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

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ imageUri, strokeColor, strokeWidth, isEraserMode }, ref) => {
    
    if (Platform.OS === 'web') return <View/>;

    const { width: screenWidth } = Dimensions.get('window');
    const VIEW_SIZE = screenWidth; // Carré
    const image = useImage(imageUri);
    
    // --- HOOK (CERVEAU) ---
    const { paths, addPath, undo, redo, clear } = useDrawing();

    // --- ÉTATS LOCAUX (INTERACTION) ---
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

    // --- API EXPOSÉE ---
    useImperativeHandle(ref, () => ({
      clearCanvas: () => { clear(); setCurrentPathObj(null); },
      undo: undo,
      redo: redo,
      getPaths: () => paths, // Renvoie bien les objets complets
      getSnapshot: async () => undefined 
    }), [paths, undo, redo, clear]);

    // --- INITIALISATION V19 (CARRÉ COVER) ---
    if (image && !isInitialized.current) {
        const w = image.width();
        const h = image.height();
        
        const scaleW = VIEW_SIZE / w;
        const scaleH = VIEW_SIZE / h;
        const startScale = Math.max(scaleW, scaleH); // Cover

        baseScaleRef.current = startScale; 
        
        const centerTx = (VIEW_SIZE - w * startScale) / 2;
        const centerTy = (VIEW_SIZE - h * startScale) / 2;

        transform.current = { scale: startScale, translateX: centerTx, translateY: centerTy };
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
        // Centre relatif à la vue (haut de page, donc coords écran ok)
        const center = { x: (t1.pageX + t2.pageX) / 2, y: (t1.pageY + t2.pageY) / 2 };
        
        const anchorX = (center.x - transform.current.translateX) / transform.current.scale;
        const anchorY = (center.y - transform.current.translateY) / transform.current.scale;
        
        gestureStart.current = { dist, scale: transform.current.scale, focalX: center.x, focalY: center.y, imageAnchorX: anchorX, imageAnchorY: anchorY };
    };

    const distBetween = (p1: {x: number, y: number}, p2: {x: number, y: number}) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

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
            
            let newScale = Math.max(baseScaleRef.current, Math.min(start.scale * ratio, 10)); 

            let newTx = currentCenter.x - (start.imageAnchorX * newScale);
            let newTy = currentCenter.y - (start.imageAnchorY * newScale);
            
            // Clamping Carré V19
            const imgW = image.width() * newScale;
            const imgH = image.height() * newScale;

            if (imgW >= VIEW_SIZE) newTx = Math.max(VIEW_SIZE - imgW, Math.min(0, newTx));
            else newTx = (VIEW_SIZE - imgW) / 2;

            if (imgH >= VIEW_SIZE) newTy = Math.max(VIEW_SIZE - imgH, Math.min(0, newTy));
            else newTy = (VIEW_SIZE - imgH) / 2;
            
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
        if (timer.current) clearTimeout(timer.current);
        if (mode.current === 'DRAWING' && currentPathObj) {
            if(lastPoint.current) currentPathObj.lineTo(lastPoint.current.x, lastPoint.current.y);
            
            // AJOUT VIA LE HOOK
            addPath({
                svgPath: currentPathObj.toSVGString(),
                color: strokeColor,
                width: strokeWidth / transform.current.scale, // Épaisseur relative (WYSIWYG)
                isEraser: isEraserMode
            });
        }
        mode.current = 'NONE'; setCurrentPathObj(null); lastPoint.current = null;
      },
      onPanResponderTerminate: () => { mode.current = 'NONE'; setCurrentPathObj(null); }
    }), [strokeColor, strokeWidth, currentPathObj, screenWidth, image, isEraserMode, addPath]); 

    if (!image) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#fff"/></View>;

    const skiaTransform = [
      { translateX: transform.current.translateX },
      { translateY: transform.current.translateY },
      { scale: transform.current.scale }
    ];
    
    // Dimensions natives pour fit="none"
    const IMG_W = image.width();
    const IMG_H = image.height();

    return (
      <View style={styles.container}>
        <View 
            style={{ width: VIEW_SIZE, height: VIEW_SIZE, backgroundColor: '#000', overflow: 'hidden' }}
            {...panResponder.panHandlers}
        >
            <Canvas style={{ flex: 1 }}>
            <Group transform={skiaTransform}>
                
                {/* Image RAW non croppée par Skia, gérée par notre matrice */}
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
                        strokeWidth={p.width} strokeCap="round" strokeJoin="round"
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
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  webPlaceholder: { flex: 1, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  webText: { color: '#fff' }
});