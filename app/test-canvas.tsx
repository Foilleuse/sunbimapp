import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity } from 'react-native';
import { Canvas, Path, Skia, SkPath } from '@shopify/react-native-skia';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Point {
  x: number;
  y: number;
}

export default function TestCanvasScreen() {
  const [paths, setPaths] = useState<SkPath[]>([]);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

  const onTouchStart = useCallback((x: number, y: number) => {
    setCurrentPoints([{ x, y }]);
  }, []);

  const onTouchMove = useCallback((x: number, y: number) => {
    setCurrentPoints((prev) => [...prev, { x, y }]);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (currentPoints.length > 0) {
      const path = Skia.Path.Make();
      path.moveTo(currentPoints[0].x, currentPoints[0].y);
      for (let i = 1; i < currentPoints.length; i++) {
        path.lineTo(currentPoints[i].x, currentPoints[i].y);
      }
      setPaths((prev) => [...prev, path]);
      setCurrentPoints([]);
    }
  }, [currentPoints]);

  const handleClear = () => {
    setPaths([]);
    setCurrentPoints([]);
  };

  const createCurrentPath = (): SkPath | null => {
    if (currentPoints.length === 0) return null;
    const path = Skia.Path.Make();
    path.moveTo(currentPoints[0].x, currentPoints[0].y);
    for (let i = 1; i < currentPoints.length; i++) {
      path.lineTo(currentPoints[i].x, currentPoints[i].y);
    }
    return path;
  };

  const currentPath = createCurrentPath();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Test Canvas Minimal (No GH/Reanimated)</Text>
        <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <Canvas
        style={styles.canvas}
        onTouchStart={(evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          onTouchStart(locationX, locationY);
        }}
        onTouchMove={(evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          onTouchMove(locationX, locationY);
        }}
        onTouchEnd={onTouchEnd}
      >
        {paths.map((path, index) => (
          <Path
            key={`path-${index}`}
            path={path}
            color="black"
            style="stroke"
            strokeWidth={4}
            strokeCap="round"
            strokeJoin="round"
          />
        ))}
        {currentPath && (
          <Path
            path={currentPath}
            color="red"
            style="stroke"
            strokeWidth={4}
            strokeCap="round"
            strokeJoin="round"
          />
        )}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  canvas: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 100,
  },
});
