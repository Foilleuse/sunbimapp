import React, { forwardRef, useImperativeHandle, useState, useMemo, useRef } from 'react';
import { StyleSheet, View, Platform, Text, Dimensions, PanResponder, ActivityIndicator } from 'react-native';
import {
  Canvas, Path, useImage, Image as SkiaImage, Group, Skia, SkPath
} from '@shopify/react-native-skia';
import { captureRef } from 'react-native-view-shot';

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
  getPaths: () => string[];
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
    
    if (Platform.OS === 'web') {
      return <View style={styles.webPlaceholder}><Text style={styles.webText}>Mobile Only</Text></View>;
    }

    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    const image = useImage(imageUri);
    
    // Ref pour la capture d'écran
    const viewShotRef = useRef<View>(null);

    const [paths, setPaths] = useState<DrawingPath[]>([]);
    const [redoStack, setRedoStack] = useState<DrawingPath[]>([]);
    const [currentPathObj, setCurrentPathObj] = useState<SkPath | null>(null);
    
    const transform = useRef({ scale: 1, translateX: 0, translateY: 0 });
    const [_, setTick] = useState(0); 
    const forceUpdate = () => setTick(t => t + 1);
    
    const isInitialized = useRef(false);
    const baseScaleRef = useRef(1);
    const squareSizeRef = useRef<number>(1000); 
    
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
      getPaths: () => paths.map(p => p.svgPath),
      
      // --- SNAPSHOT ASYNC ---
      getSnapshot: async () => {
          try {
              console.log("📸 Capture via ViewShot...");
              const result = await captureRef(viewShotRef, {
                  format: "png",
                  quality: 0.8,
                  result: "base64"
              });
              return result;
          } catch (error) {
              console.error("❌ Erreur ViewShot", error);
              return undefined;
          }
      }
    }));

    // --- INITIALISATION ---
    if (image && !isInitialized.current) {
        const SIZE = image.height(); 
        squareSizeRef.current = SIZE;
        const fitScale = screenHeight / SIZE;
        baseScaleRef.current = fitScale;
        const visualWidth = SIZE * fitScale;
        const centerTx = (screenWidth - visualWidth) / 2;
        transform.current = { scale: fitScale, translateX: centerTx, translateY: 0 };
        isInitialized.current = true;
    }

    // --- GESTIONNAIRE TACTILE ---
    const getDistance = (t1: any, t2: any) => {
        const dx = t1.pageX - t2.pageX;
        const dy = t1.pageY - t2.pageY;
        return Math.sqrt(dx*dx + dy*dy);
    };
    const getCenter = (t1: any, t2: any) => ({ x: (t1.pageX+t2.pageX)/2, y: (t1.pageY+t2.pageY)/2 });

    const startZooming = (touches: any[]) => {
        mode.current = 'ZOOMING';
        setCurrentPathObj(null); lastPoint.current = null; forceUpdate();
        const t1 = touches[0]; const t2 = touches[1];
        const dist = getDistance(t1, t2); const center = getCenter(t1, t2);
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
        if (touches.length === 2 && mode.current !== 'ZOOMING') {
            startZooming(touches); return;
        }

        if (mode.current === 'DRAWING' && touches.length === 1 && currentPathObj && lastPoint.current) {
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
        } else if (mode.current === 'ZOOMING' && touches.length === 2 && gestureStart.current) {
            const t1 = touches[0]; const t2 = touches[1];
            const currentDist = getDistance(t1, t2); const currentCenter = getCenter(t1, t2);
            const start = gestureStart.current;
            const ratio = currentDist / start.dist;
            const SIZE = squareSizeRef.current;
            const baseScale = screenHeight / SIZE;
            let newScale = start.scale * ratio;
            newScale = Math.max(baseScale, Math.min(newScale, baseScale * 5));
            let newTx = currentCenter.x - (start.imageAnchorX * newScale);
            let newTy = currentCenter.y - (start.imageAnchorY * newScale);
            const currentVisualSize = SIZE * newScale;
            if (currentVisualSize <= screenWidth) newTx = (screenWidth - currentVisualSize) / 2;
            else newTx = Math.min(0, Math.max(screenWidth - currentVisualSize, newTx));
            if (currentVisualSize <= screenHeight) newTy = (screenHeight - currentVisualSize) / 2;
            else newTy = Math.min(0, Math.max(screenHeight - currentVisualSize, newTy));
            transform.current.scale = newScale;
            transform.current.translateX = newTx;
            transform.current.translateY = newTy;
            forceUpdate();
        }
      },

      onPanResponderRelease: () => {
        if (timer.current) clearTimeout(timer.current);
        if (mode.current === 'DRAWING' && currentPathObj) {
            if(lastPoint.current) currentPathObj.lineTo(lastPoint.current.x, lastPoint.current.y);
            setPaths(prev => [...prev, {
                svgPath