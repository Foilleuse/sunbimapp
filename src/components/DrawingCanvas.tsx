import React, { forwardRef, useImperativeHandle, useState, useMemo, useRef } from 'react';
import { StyleSheet, View, Dimensions, PanResponder, GestureResponderEvent } from 'react-native';
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
}

interface DrawingPath {
  svgPath: string;
  color: string;
  width: number;
  isEraser?: boolean;
}

// État de la transformation (Zoom/Pan)
interface Transform {
  translateX: number;
  translateY: number;
  scale: number;
}

const distance = (event: GestureResponderEvent) => {
  const dx = event.nativeEvent.touches[0].pageX - event.nativeEvent.touches[1].pageX;
  const dy = event.nativeEvent.touches[0].pageY - event.nativeEvent.touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
};

const center = (event: GestureResponderEvent) => {
  return {
    x: (event.nativeEvent.touches[0].pageX + event.nativeEvent.touches[1].pageX) / 2,
    y: (event.nativeEvent.touches[0].pageY + event.nativeEvent.touches[1].pageY) / 2,
  };
};

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ imageUri, strokeColor, strokeWidth, isEraserMode }, ref) => {
    
    // --- DIMENSIONS PLEIN ECRAN ---
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    const CANVAS_WIDTH = screenWidth;
    const CANVAS_HEIGHT = screenHeight;

    const image = useImage(imageUri);
    const [paths, setPaths] = useState<DrawingPath[]>([]);
    const [history, setHistory] = useState<DrawingPath[][]>([]);
    const [currentPathObj, setCurrentPathObj] = useState<SkPath | null>(null);

    // État du Zoom/Pan
    const [transform, setTransform] = useState<Transform>({ translateX: 0, translateY: 0, scale: 1 });
    
    // Refs pour la gestion des gestes sans re-render intempestifs
    const transformRef = useRef<Transform>({ translateX: 0, translateY: 0, scale: 1 });
    const initialGestureRef = useRef<{ scale: number; dist: number; center: { x: number; y: number } } | null>(null);
    const isDrawingRef = useRef(false);

    useImperativeHandle(ref, () => ({
      clearCanvas: () => {
        setPaths([]);
        setHistory([]);
      },
      undo: () => {
        setPaths((current) => {
          if (current.length === 0) return current;
          const newPaths = current.slice(0, -1);
          setHistory(prev => [...prev, current]); 
          return newPaths;
        });
      },
      redo: () => {
        setHistory((currentHistory) => {
          if (currentHistory.length === 0) return currentHistory;
          const nextState = currentHistory[currentHistory.length - 1];
          setPaths(nextState);
          return currentHistory.slice(0, -1);
        });
      },
      getPaths: () => paths, 
    }));

    // Fonction pour convertir les coordonnées écran -> coordonnées dessin (monde)
    const toWorldPoint = (x: number, y: number) => {
      const { translateX, translateY, scale } = transformRef.current;
      return {
        x: (x - translateX) / scale,
        y: (y - translateY) / scale,
      };
    };

    const panResponder = useMemo(() => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        
        if (touches.length === 1) {
          // --- MODE DESSIN (1 DOIGT) ---
          isDrawingRef.current = true;
          const { locationX, locationY } = evt.nativeEvent;
          const worldPoint = toWorldPoint(locationX, locationY);
          
          const newPath = Skia.Path.Make();
          newPath.moveTo(worldPoint.x, worldPoint.y);
          setCurrentPathObj(newPath);
        
        } else if (touches.length === 2) {
          // --- MODE ZOOM/PAN (2 DOIGTS) ---
          isDrawingRef.current = false;
          setCurrentPathObj(null); // Annule le trait en cours si on pose un 2e doigt
          
          const dist = distance(evt);
          const c = center(evt);
          initialGestureRef.current = {
            scale: transformRef.current.scale,
            dist: dist,
            center: c,
          };
        }
      },

      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;

        if (touches.length === 1 && isDrawingRef.current && currentPathObj) {
          // --- DESSIN ---
          const { locationX, locationY } = evt.nativeEvent;
          const worldPoint = toWorldPoint(locationX, locationY);
          currentPathObj.lineTo(worldPoint.x, worldPoint.y);
          setCurrentPathObj(currentPathObj.copy()); // Force refresh
        
        } else if (touches.length === 2 && initialGestureRef.current) {
          // --- ZOOM & PAN ---
          const dist = distance(evt);
          const c = center(evt);
          const initial = initialGestureRef.current;

          // 1. Calcul du nouveau scale
          const newScale = Math.max(1, Math.min(5, initial.scale * (dist / initial.dist))); // Min zoom x1, Max x5

          // 2. Calcul du nouveau translate (Pan)
          // On déplace l'image pour que le point sous les doigts reste sous les doigts
          // (Logique simplifiée pour la fluidité)
          const dx = c.x - initial.center.x;
          const dy = c.y - initial.center.y;
          
          // On applique la différence à la position précédente (approximatif mais fluide)
          // Pour un zoom centré parfait, il faudrait recalculer via la matrice inverse, 
          // mais cette implémentation suffit pour une bonne UX mobile.
          const newTx = transformRef.current.translateX + dx / 10; // Amortissement
          const newTy = transformRef.current.translateY + dy / 10;

          // Mise à jour de la ref (pour le dessin immédiat)
          transformRef.current = {
             translateX: transformRef.current.translateX + (c.x - initial.center.x),
             translateY: transformRef.current.translateY + (c.y - initial.center.y),
             scale: newScale
          };
          
          // Mise à jour de l'état (pour le rendu visuel)
          setTransform({...transformRef.current});
          
          // On met à jour la ref initiale pour le prochain mouvement relatif
          initialGestureRef.current = {
             ...initial,
             center: c
          };
        }
      },

      onPanResponderRelease: () => {
        isDrawingRef.current = false;
        initialGestureRef.current = null;

        if (currentPathObj) {
          const svgString = currentPathObj.toSVGString();
          setPaths(current => [...current, {
            svgPath: svgString,
            color: strokeColor,
            width: strokeWidth,
            isEraser: isEraserMode
          }]);
          setHistory([]); 
          setCurrentPathObj(null);
        }
      },
    }), [currentPathObj, strokeColor, strokeWidth, isEraserMode]); // Dépendances importantes

    if (!image) return <View style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: '#EEE' }} />;

    // Construction de la matrice Skia pour l'affichage
    const skiaMatrix = Skia.Matrix();
    skiaMatrix.translate(transform.translateX, transform.translateY);
    skiaMatrix.scale(transform.scale, transform.scale);

    return (
      <View style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: 'black', overflow: 'hidden' }}>
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
          <Canvas style={{ flex: 1 }}>
            {/* GROUPE GLOBAL : Applique le Zoom/Pan à TOUT (Image + Traits)
                C'est la clé pour que les traits suivent l'image.
            */}
            <Group matrix={skiaMatrix}>
                <SkiaImage 
                    image={image} 
                    x={0} y={0} 
                    width={CANVAS_WIDTH} 
                    height={CANVAS_HEIGHT} 
                    fit="cover" 
                />
                
                <Group layer={true}>
                {paths.map((p, index) => {
                    const path = Skia.Path.MakeFromSVGString(p.svgPath);
                    if (!path) return null;
                    return (
                    <Path
                        key={index}
                        path={path}
                        color={p.isEraser ? "#000000" : p.color}
                        style="stroke"
                        strokeWidth={p.width}
                        strokeCap="round"
                        strokeJoin="round"
                        blendMode={p.isEraser ? "clear" : "srcOver"}
                    />
                    );
                })}
                {currentPathObj && (
                    <Path
                    path={currentPathObj}
                    color={isEraserMode ? "#000000" : strokeColor}
                    style="stroke"
                    strokeWidth={strokeWidth}
                    strokeCap="round"
                    strokeJoin="round"
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