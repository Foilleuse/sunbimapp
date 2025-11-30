import React, { forwardRef, useImperativeHandle, useState, useMemo, useRef } from 'react';
import { StyleSheet, View, Platform, Dimensions, PanResponder } from 'react-native';
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

    // --- DIMENSIONS PLEIN ECRAN ---
    // On utilise les dimensions réelles de l'écran pour les limites du zoom
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
      // Transition immédiate vers le mode ZOOM
      mode.current = 'ZOOMING';
      // On annule le trait en cours s'il y en avait un (évite les traits accidentels)
      setCurrentPathObj(null); 
      lastPoint.current = null;
      
      const t1 = touches[0]; 
      const t2 = touches[1];
      const dist = getDistance(t1, t2); 
      const center = getCenter(t1, t2);
      
      // On calcule le point d'ancrage dans l'image (coordonnées locales)
      const anchorX = (center.x - transform.current.translateX) / transform.current.scale;
      const anchorY = (center.y - transform.current.translateY) / transform.current.scale;
      
      gestureStart.current = { 
        dist, 
        scale: transform.current.scale, 
        focalX: center.x, 
        focalY: center.y, 
        imageAnchorX: anchorX, 
        imageAnchorY: anchorY 
      };
      
      forceUpdate();
    };

    const panResponder = useMemo(() => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        
        if (touches.length === 2) {
          // Démarrage direct à 2 doigts
          startZooming(touches);
        } else if (touches.length === 1) {
          // Démarrage dessin 1 doigt
          mode.current = 'DRAWING';
          const { locationX, locationY } = evt.nativeEvent;
          // Conversion coordonnées écran -> coordonnées dessin (zoom/pan inversé)
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

        // DÉTECTION DYNAMIQUE DU ZOOM
        // Si on a 2 doigts mais qu'on n'est pas encore en mode ZOOM (ex: on vient d'ajouter un 2e doigt)
        if (touches.length === 2 && mode.current !== 'ZOOMING') {
          startZooming(touches);
          return;
        }

        if (mode.current === 'DRAWING' && touches.length === 1 && currentPathObj && lastPoint.current) {
          // --- LOGIQUE DESSIN ---
          const { locationX, locationY } = evt.nativeEvent;
          const x = (locationX - transform.current.translateX) / transform.current.scale;
          const y = (locationY - transform.current.translateY) / transform.current.scale;
          
          // Lissage simple (QuadTo)
          const xMid = (lastPoint.current.x + x) / 2;
          const yMid = (lastPoint.current.y + y) / 2;
          currentPathObj.quadTo(lastPoint.current.x, lastPoint.current.y, xMid, yMid);
          
          lastPoint.current = { x, y };
          setCurrentPathObj(currentPathObj); 
          forceUpdate();

        } else if (mode.current === 'ZOOMING' && touches.length === 2 && gestureStart.current) {
          // --- LOGIQUE ZOOM & PAN AVEC BORDURES ---
          const t1 = touches[0]; 
          const t2 = touches[1];
          const currentDist = getDistance(t1, t2); 
          const currentCenter = getCenter(t1, t2);
          const start = gestureStart.current;

          // 1. Calcul du nouveau scale
          const ratio = currentDist / start.dist;
          let newScale = start.scale * ratio;
          // Limites du zoom : Min x1 (taille écran), Max x5
          newScale = Math.max(1, Math.min(newScale, 5));

          // 2. Calcul du nouveau Pan (Translate)
          // L'idée est de garder le point sous les doigts (anchor) au même endroit visuel
          let newTx = currentCenter.x - (start.imageAnchorX * newScale);
          let newTy = currentCenter.y - (start.imageAnchorY * newScale);

          // 3. Application des BORDURES (Clamping)
          // On ne peut pas déplacer l'image plus loin que ses propres bords
          // Max X/Y est toujours 0 (bord gauche/haut collé au bord écran)
          // Min X/Y est (TailleEcran - TailleImageZoomée) (bord droit/bas collé au bord écran)
          
          const maxTx = 0;
          const minTx = screenWidth - (screenWidth * newScale);
          const maxTy = 0;
          const minTy = screenHeight - (screenHeight * newScale);

          if (newScale <= 1) {
             // Si on est dézoomé ou à taille réelle, on centre ou on colle à 0
             newTx = 0;
             newTy = 0;
          } else {
             // Sinon on contraint
             newTx = Math.min(maxTx, Math.max(minTx, newTx));
             newTy = Math.min(maxTy, Math.max(minTy, newTy));
          }

          // Mise à jour de la transformation
          transform.current.scale = newScale;
          transform.current.translateX = newTx;
          transform.current.translateY = newTy;
          forceUpdate();
        }
      },

      onPanResponderRelease: () => {
        if (mode.current === 'DRAWING' && currentPathObj && lastPoint.current) {
          // Finalisation du trait
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
        
        // Petit ressort si on a relâché avec un scale < 1 (sécurité)
        if (transform.current.scale < 1) {
            transform.current = { scale: 1, translateX: 0, translateY: 0 };
            forceUpdate();
        }
      },
      
      onPanResponderTerminate: () => { 
          mode.current = 'NONE'; 
          setCurrentPathObj(null); 
      }
    }), [strokeColor, strokeWidth, currentPathObj, screenWidth, screenHeight, image, isEraserMode]);

    if (!image) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#fff" /></View>;

    // Matrice de transformation Skia
    const skiaTransform = [
      { translateX: transform.current.translateX },
      { translateY: transform.current.translateY },
      { scale: transform.current.scale }
    ];

    return (
      <View style={styles.container} {...panResponder.panHandlers}>
        <Canvas style={{ flex: 1 }} pointerEvents="none">
          {/* Groupe Global : Tout ce qui est dedans suit le zoom/pan */}
          <Group transform={skiaTransform}>
            
            {/* L'image remplit l'écran (Plein écran) */}
            <SkiaImage 
                image={image} 
                x={0} y={0} 
                width={screenWidth} 
                height={screenHeight} 
                fit="cover" 
            />
            
            {/* Les traits suivent l'image */}
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
                  strokeWidth={strokeWidth} strokeCap="round" strokeJoin="round"
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