import React, { useMemo, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { Canvas, Path, Image as SkiaImage, useImage, Group, Skia, SkPath } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';

interface DrawingViewerProps {
  imageUri: string;
  canvasData: any; 
  viewerSize: number;
  viewerHeight?: number; 
  transparentMode?: boolean;
  animated?: boolean;
  startVisible?: boolean;
  autoCenter?: boolean; 
}

const getSkiaPath = (svgString: string): SkPath | null => {
    try {
        return Skia.Path.MakeFromSVGString(svgString);
    } catch {
        return null;
    }
};

const DrawingViewerContent: React.FC<DrawingViewerProps> = ({ 
  imageUri, 
  canvasData, 
  viewerSize, 
  viewerHeight,
  transparentMode = false,
  animated = false,
  startVisible = true,
  autoCenter = false
}) => {
  
  const image = useImage(imageUri); 
  const [isReady, setIsReady] = useState(false); 
  
  const progress = useSharedValue(animated ? 0 : (startVisible ? 1 : 0));
  const opacity = useSharedValue(animated ? 0 : 1);

  // --- DIMENSIONS DE REFERENCE ---
  const SCREEN_WIDTH = Dimensions.get('window').width;
  
  const REF_PAPER_W = SCREEN_WIDTH;
  const REF_PAPER_H = SCREEN_WIDTH * (4/3);

  const TARGET_W = viewerSize;
  const TARGET_H = viewerHeight || (viewerSize * (4/3));

  useEffect(() => {
    if (animated) {
        progress.value = 0;
        opacity.value = 0;

        // 1. Fade In plus long (600ms) pour être bien visible
        opacity.value = withTiming(1, { duration: 600 });

        // 2. Animation du tracé (Lineaire, 2200ms)
        progress.value = withTiming(1, { 
            duration: 2200, 
            easing: Easing.linear 
        });
    } else {
        progress.value = startVisible ? 1 : 0;
        opacity.value = 1;
    }
    const timer = setTimeout(() => setIsReady(true), 50);
    return () => clearTimeout(timer);
  }, [animated, startVisible]);

  const skiaPaths = useMemo(() => {
    let rawData = [];
    if (Array.isArray(canvasData)) rawData = canvasData;
    else if (typeof canvasData === 'string') {
        try { rawData = JSON.parse(canvasData); } catch (e) { rawData = []; }
    }

    return rawData.map((p: any) => ({
        ...p,
        skPath: p.svgPath ? getSkiaPath(p.svgPath) : null
    })).filter((p: any) => p.skPath !== null);
  }, [canvasData]);

  const transforms = useMemo(() => {
      if (!image) return [];
      
      // 1. Zoom Auto
      if (autoCenter && skiaPaths.length > 0) {
          const combinedPath = Skia.Path.Make();
          skiaPaths.forEach((p: any) => combinedPath.addPath(p.skPath));
          const bounds = combinedPath.getBounds();
          
          if (bounds.width > 10 && bounds.height > 10) {
              const padding = 40;
              const focusScale = Math.min((TARGET_W - padding) / Math.max(bounds.width, bounds.height), 5);
              
              const tx = (TARGET_W - bounds.width * focusScale) / 2 - bounds.x * focusScale;
              const ty = (TARGET_H - bounds.height * focusScale) / 2 - bounds.y * focusScale;

              return [{ translateX: tx }, { translateY: ty }, { scale: focusScale }];
          }
      }

      // 2. Mode STANDARD
      const scale = TARGET_W / REF_PAPER_W;

      const scaledW = REF_PAPER_W * scale;
      const scaledH = REF_PAPER_H * scale;
      
      const translateX = (TARGET_W - scaledW) / 2;
      const translateY = (TARGET_H - scaledH) / 2;

      return [{ translateX }, { translateY }, { scale }];

  }, [image, TARGET_W, TARGET_H, REF_PAPER_W, REF_PAPER_H, autoCenter, skiaPaths]);

  if (!image) {
    if (transparentMode) return <View style={{width: TARGET_W, height: TARGET_H}} />;
    return <View style={styles.loading}><ActivityIndicator color="#000" /></View>;
  }

  return (
    <View style={[styles.container, {width: TARGET_W, height: TARGET_H, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        <Group transform={transforms}>
          
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={REF_PAPER_W} 
                height={REF_PAPER_H} 
                fit="cover" 
              />
          )}
          
          {isReady && (
            <Group layer={true} opacity={opacity}> 
            {skiaPaths.map((p: any, index: number) => (
              <Path
                key={index}
                path={p.skPath}
                color={p.isEraser ? "#000000" : (p.color || "#000000")}
                style="stroke"
                strokeWidth={p.width || 15}
                strokeCap="round"
                strokeJoin="round"
                blendMode={p.isEraser ? "clear" : "srcOver"}
                start={0}
                end={progress} 
              />
            ))}
            </Group>
          )}
        </Group>
      </Canvas>
    </View>
  );
};

export const DrawingViewer: React.FC<DrawingViewerProps> = (props) => {
  return (
    <DrawingViewerContent 
      key={props.animated ? 'anim-mode' : 'static-mode'} 
      {...props} 
    />
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: 'transparent' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});