import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Dimensions, View, Text } from 'react-native';
import { Canvas, Path, Skia, SkPath } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, runOnJS } from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DrawingCanvasProps {
  isDrawingEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  onClear: () => void;
}

export interface DrawingCanvasRef {
  clearCanvas: () => void;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
  isDrawingEnabled,
  strokeColor,
  strokeWidth,
}, ref) => {
  const [completedPaths, setCompletedPaths] = useState<Array<{ path: SkPath; color: string; width: number }>>([]);
  const currentPath = useSharedValue<SkPath>(Skia.Path.Make());

  const clearCanvas = () => {
    currentPath.value = Skia.Path.Make();
    setCompletedPaths([]);
  };

  const addCompletedPath = (path: SkPath, color: string, width: number) => {
    setCompletedPaths((prev) => [...prev, { path, color, width }]);
  };

  useImperativeHandle(ref, () => ({
    clearCanvas,
  }));

  const pan = Gesture.Pan()
    .enabled(isDrawingEnabled)
    .onStart((e) => {
      const newPath = Skia.Path.Make();
      newPath.moveTo(e.x, e.y);
      currentPath.value = newPath;
    })
    .onUpdate((e) => {
      const path = currentPath.value;
      path.lineTo(e.x, e.y);
      currentPath.value = path.copy();
    })
    .onEnd(() => {
      const finishedPath = currentPath.value.copy();
      runOnJS(addCompletedPath)(finishedPath, strokeColor, strokeWidth);
      currentPath.value = Skia.Path.Make();
    });

  return (
    <View style={styles.canvasContainer} pointerEvents={isDrawingEnabled ? 'auto' : 'box-none'}>
      {isDrawingEnabled && (
        <View style={styles.debugBanner}>
          <Text style={styles.debugText}>
            Mode Dessin | Traits: {completedPaths.length}
          </Text>
        </View>
      )}
      <GestureDetector gesture={pan}>
        <View style={styles.gestureContainer}>
          <Canvas style={styles.canvas}>
            {completedPaths.map((pathData, index) => (
              <Path
                key={`path-${index}`}
                path={pathData.path}
                color={pathData.color}
                style="stroke"
                strokeWidth={pathData.width}
                strokeCap="round"
                strokeJoin="round"
              />
            ))}
            <Path
              path={currentPath}
              color={strokeColor}
              style="stroke"
              strokeWidth={strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            />
          </Canvas>
        </View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  canvasContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  gestureContainer: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  canvas: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  debugBanner: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 150, 255, 0.8)',
    padding: 10,
    borderRadius: 5,
    zIndex: 100,
  },
  debugText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
