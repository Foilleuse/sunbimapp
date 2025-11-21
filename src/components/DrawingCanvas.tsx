import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Path, Skia, SkPath } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DrawingPath {
  path: SkPath;
  color: string;
  strokeWidth: number;
}

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
  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState<SkPath | null>(null);
  const [, forceUpdate] = useState(0);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .enabled(!isDrawingEnabled)
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .enabled(!isDrawingEnabled)
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const drawGesture = Gesture.Pan()
    .enabled(isDrawingEnabled)
    .onStart((e) => {
      const newPath = Skia.Path.Make();
      newPath.moveTo(e.x, e.y);
      setCurrentPath(newPath);
    })
    .onUpdate((e) => {
      if (currentPath) {
        currentPath.lineTo(e.x, e.y);
        forceUpdate((v) => v + 1);
      }
    })
    .onEnd(() => {
      if (currentPath) {
        const pathCopy = currentPath.copy();
        setPaths((prev) => [
          ...prev,
          {
            path: pathCopy,
            color: strokeColor,
            strokeWidth: strokeWidth,
          },
        ]);
        setCurrentPath(null);
      }
    });

  const composedGesture = Gesture.Race(
    Gesture.Simultaneous(panGesture, pinchGesture),
    drawGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  useImperativeHandle(ref, () => ({
    clearCanvas: () => {
      setPaths([]);
      setCurrentPath(null);
    },
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.canvasContainer, animatedStyle]}>
        <Canvas style={styles.canvas}>
          {paths.map((pathData, index) => (
            <Path
              key={index}
              path={pathData.path}
              color={pathData.color}
              style="stroke"
              strokeWidth={pathData.strokeWidth}
              strokeJoin="round"
              strokeCap="round"
            />
          ))}
          {currentPath && (
            <Path
              path={currentPath}
              color={strokeColor}
              style="stroke"
              strokeWidth={strokeWidth}
              strokeJoin="round"
              strokeCap="round"
            />
          )}
        </Canvas>
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  canvasContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  canvas: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});
