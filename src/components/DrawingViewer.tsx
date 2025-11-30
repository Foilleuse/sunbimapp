import React, { useMemo, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Canvas, Path, Image as SkiaImage, useImage, Group, Skia, SkPath } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';

interface DrawingViewerProps {
  imageUri: string;
  canvasData: any; 
  viewerSize: number;
  viewerHeight?: number; // <--- NOUVELLE PROP OPTIONNELLE
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
  viewerHeight, // <--- On récupère la hauteur personnalisée
  transparentMode = false,
  animated = false,
  startVisible = true,
  autoCenter = false
}) => {
  
  const image = useImage(imageUri); 
  const [isReady, setIsReady] = useState(false); 
  const progress = useSharedValue(animated ? 0 : (startVisible ? 1 : 0));

  // --- CALCUL HAUTEUR ---
  // Si viewerHeight est fourni (Index), on l'utilise.
  // Sinon (Feed/Gallery), on utilise le ratio 3:4.
  const VIEW_HEIGHT = viewerHeight || (viewerSize * (4/3));

  useEffect(() => {
    if (animated) {
        progress.value = 0;
        progress.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) });
    } else {
        progress.value = startVisible ? 1 : 0;
    }
    setIsReady(true);
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

  const matrixTransform = useMemo(() => {
      const m = Skia.Matrix();
      if (!image) return m;
      
      const NATIVE_HEIGHT = image.height();
      if (NATIVE_HEIGHT === 0) return m;

      // Logique Auto-Center pour le Replay
      if (autoCenter && skiaPaths.length > 0) {
          const combinedPath = Skia.Path.Make();
          skiaPaths.forEach((p: any) => combinedPath.addPath(p.skPath));
          
          const bounds = combinedPath.getBounds();
          if (bounds.width > 10 && bounds.height > 10) {
              const padding = 40;
              const targetSize = viewerSize - padding;
              const focusScale = Math.min(targetSize / Math.max(bounds.width, bounds.height), 5);

              const translateX = (viewerSize - bounds.width * focusScale) / 2 - bounds.x * focusScale;
              const translateY = (VIEW_HEIGHT - bounds.height * focusScale) / 2 - bounds.y * focusScale;

              m.translate(translateX, translateY);
              m.scale(focusScale, focusScale);
              return m;
          }
      }

      // Mode Fit Cover : Remplir la zone définie
      // L'échelle doit être suffisante pour couvrir viewerSize ET VIEW_HEIGHT
      const scaleX = viewerSize / image.width();
      const scaleY = VIEW_HEIGHT / image.height();
      const scale = Math.max(scaleX, scaleY); // On prend le max pour couvrir (cover)

      m.scale(scale, scale);
      return m;

  }, [image, viewerSize, VIEW_HEIGHT, autoCenter, skiaPaths]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: VIEW_HEIGHT}} />;
    return <View style={styles.loading}><ActivityIndicator color="#000" /></View>;
  }

  return (
    <View style={[styles.container, {width: viewerSize, height: VIEW_HEIGHT, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        <Group matrix={matrixTransform}>
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={image.width()} 
                height={image.height()} 
                fit="cover" 
              />
          )}
          
          {isReady && (
            <Group layer={true}> 
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