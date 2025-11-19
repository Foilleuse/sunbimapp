import React, { useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Path, Skia, TouchInfo, useTouchHandler } from '@shopify/react-native-skia';
import { colors, DrawingColor } from '../theme/colors';

interface DrawingCanvasProps {
  width: number;
  height: number;
  currentColor: DrawingColor;
  isEraser: boolean;
  onClearCanvas?: () => void;
}

interface PathData {
  path: string;
  color: string;
  strokeWidth: number;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  width,
  height,
  currentColor,
  isEraser,
}) => {
  const [paths, setPaths] = useState<PathData[]>([]);
  const [currentPath, setCurrentPath] = useState<typeof Skia.Path | null>(null);

  const onTouch = useTouchHandler({
    onStart: (touchInfo: TouchInfo) => {
      const { x, y } = touchInfo;
      const newPath = Skia.Path.Make();
      newPath.moveTo(x, y);
      setCurrentPath(newPath);
    },
    onActive: (touchInfo: TouchInfo) => {
      const { x, y } = touchInfo;
      if (currentPath) {
        currentPath.lineTo(x, y);
        setCurrentPath(currentPath.copy());
      }
    },
    onEnd: () => {
      if (currentPath) {
        const pathData: PathData = {
          path: currentPath.toSVGString(),
          color: isEraser ? colors.white : colors.drawing[currentColor],
          strokeWidth: isEraser ? 20 : 4,
        };
        setPaths([...paths, pathData]);
        setCurrentPath(null);
      }
    },
  });

  const clearCanvas = () => {
    setPaths([]);
    setCurrentPath(null);
  };

  React.useImperativeHandle(
    React.useRef(),
    () => ({
      clear: clearCanvas,
      getPaths: () => paths,
    }),
    [paths]
  );

  return (
    <View style={[styles.container, { width, height }]}>
      <Canvas style={{ width, height }} onTouch={onTouch}>
        {paths.map((pathData, index) => {
          const skPath = Skia.Path.MakeFromSVGString(pathData.path);
          if (!skPath) return null;
          return (
            <Path
              key={`path-${index}`}
              path={skPath}
              color={pathData.color}
              style="stroke"
              strokeWidth={pathData.strokeWidth}
              strokeJoin="round"
              strokeCap="round"
            />
          );
        })}
        {currentPath && (
          <Path
            path={currentPath}
            color={isEraser ? colors.white : colors.drawing[currentColor]}
            style="stroke"
            strokeWidth={isEraser ? 20 : 4}
            strokeJoin="round"
            strokeCap="round"
          />
        )}
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default DrawingCanvas;
