import React, { useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Path, Skia, SkPath, TouchInfo, useTouchHandler } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Point {
  x: number;
  y: number;
}

interface DrawingPath {
  path: SkPath;
  color: string;
  strokeWidth: number;
}

interface DrawingCanvasProps {
  enabled: boolean;
  color: string;
  strokeWidth: number;
  onClear: () => void;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  enabled,
  color,
  strokeWidth,
}) => {
  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState<SkPath | null>(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const onDrawingStart = (touchInfo: TouchInfo) => {
    if (!enabled) return;

    const { x, y } = touchInfo;
    const path = Skia.Path.Make();
    path.moveTo(x, y);
    setCurrentPath(path);
  };

  const onDrawingActive = (touchInfo: TouchInfo) => {
    if (!enabled || !currentPath) return;

    const { x, y } = touchInfo;
    currentPath.lineTo(x, y);
    setCurrentPath(currentPath.copy());
  };

  const onDrawingEnd = () => {
    if (!enabled || !currentPath) return;

    setPaths((prevPaths) => [
      ...prevPaths,
      {
        path: currentPath.copy(),
        color,
        strokeWidth,
      },
    ]);
    setCurrentPath(null);
  };

  const touchHandler = useTouchHandler({
    onStart: onDrawingStart,
    onActive: onDrawingActive,
    onEnd: onDrawingEnd,
  });

  const pinchGesture = Gesture.Pinch()
    .enabled(!enabled)
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .enabled(!enabled)
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.canvasContainer, animatedStyle]}>
        <Canvas
          style={styles.canvas}
          onTouch={enabled ? touchHandler : undefined}
        >
          {paths.map((item, index) => (
            <Path
              key={index}
              path={item.path}
              color={item.color}
              style="stroke"
              strokeWidth={item.strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            />
          ))}
          {currentPath && (
            <Path
              path={currentPath}
              color={color}
              style="stroke"
              strokeWidth={strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            />
          )}
        </Canvas>
      </Animated.View>
    </GestureDetector>
  );
};

export const clearCanvas = (
  setPaths: React.Dispatch<React.SetStateAction<DrawingPath[]>>
) => {
  setPaths([]);
};

const styles = StyleSheet.create({
  canvasContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  canvas: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});
