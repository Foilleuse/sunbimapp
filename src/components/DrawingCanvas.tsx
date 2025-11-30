import React, { forwardRef, useImperativeHandle, useState, useMemo, useRef } from 'react';
import { StyleSheet, View, Platform, Dimensions, PanResponder } from 'react-native';
import {
  Canvas, Path, useImage, Image as SkiaImage, Group, Skia, SkPath
} from '@shopify/react-native-skia';

// ---------------------------------------------------------
// VERSION 3:4 - PORTRAIT
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
}

interface DrawingPath {
  svgPath: string;
  color: string;
  width: number;
  isEraser?: boolean;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ imageUri, strokeColor, strokeWidth, isEraserMode }, ref) => {
    
    // --- DIMENSIONS 3:4 ---
    const { width: screenWidth } = Dimensions.get('window');
    // On force le format Portrait 3:4 (Hauteur = Largeur * 1.33)
    const CANVAS_WIDTH = screenWidth;
    const CANVAS_HEIGHT = screenWidth * (4 / 3);

    const image = useImage(imageUri);
    const [paths, setPaths] = useState<DrawingPath[]>([]);
    const [history, setHistory] = useState<DrawingPath[][]>([]);
    const [currentPathObj, setCurrentPathObj] = useState<SkPath | null>(null);

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

    const panResponder = useMemo(() => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const newPath = Skia.Path.Make();
        newPath.moveTo(locationX, locationY);
        setCurrentPathObj(newPath);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (currentPathObj) {
          currentPathObj.lineTo(locationX, locationY);
          // Force update pour l'affichage temps réel (astuce simple)
          setCurrentPathObj(currentPathObj.copy());
        }
      },
      onPanResponderRelease: () => {
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
    }), [currentPathObj, strokeColor, strokeWidth, isEraserMode]);

    if (!image) return <View style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: '#EEE' }} />;

    return (
      <View style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: 'black', overflow: 'hidden' }}>
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
          <Canvas style={{ flex: 1 }}>
            {/* L'image de fond remplit la zone 3:4 */}
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
          </Canvas>
        </View>
      </View>
    );
  }
);
