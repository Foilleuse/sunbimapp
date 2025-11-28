import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Canvas, Path, Image as SkiaImage, useImage, Group, Skia, SkPath } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';

interface DrawingViewerProps {
  imageUri: string;
  canvasData: any; 
  viewerSize: number;
  transparentMode?: boolean;
  animated?: boolean;
  startVisible?: boolean;
  autoCenter?: boolean; 
}

// On sort le parsing pour éviter de le refaire dans le render
const getSkiaPath = (svgString: string): SkPath | null => {
    try {
        return Skia.Path.MakeFromSVGString(svgString);
    } catch {
        return null;
    }
};

export const DrawingViewer: React.FC<DrawingViewerProps> = ({ 
  imageUri, 
  canvasData, 
  viewerSize, 
  transparentMode = false,
  animated = false,
  startVisible = true,
  autoCenter = false
}) => {
  
  // Optimisation Image: On utilise une clé unique pour éviter le scintillement
  const image = useImage(imageUri); 
  const progress = useSharedValue(startVisible ? 1 : 0);

  useEffect(() => {
    if (animated) {
        progress.value = 0;
        progress.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) });
    } else {
        // Si on change startVisible, on met à jour immédiatement sans animation
        progress.value = startVisible ? 1 : 0;
    }
  }, [animated, startVisible]); // Retrait de imageUri des dépendances pour éviter reset

  // 1. Parsing & Memoization des Paths (C'EST ICI LE GAIN DE PERF)
  // On transforme les strings en objets Skia une seule fois par changement de données
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

  // 2. Logique Matrice (Zoom/Centrage)
  const matrixTransform = useMemo(() => {
      const m = Skia.Matrix();
      if (!image) return m;
      
      const NATIVE_SIZE = image.height();
      if (NATIVE_SIZE === 0) return m;

      // CAS A : ZOOM AUTOMATIQUE
      if (autoCenter && skiaPaths.length > 0) {
          const combinedPath = Skia.Path.Make();
          skiaPaths.forEach((p: any) => combinedPath.addPath(p.skPath));
          
          const bounds = combinedPath.getBounds();
          if (bounds.width > 10 && bounds.height > 10) {
              const padding = 40;
              const targetSize = viewerSize - padding;
              const focusScale = Math.min(targetSize / Math.max(bounds.width, bounds.height), 5);

              const translateX = (viewerSize - bounds.width * focusScale) / 2 - bounds.x * focusScale;
              const translateY = (viewerSize - bounds.height * focusScale) / 2 - bounds.y * focusScale;

              m.translate(translateX, translateY);
              m.scale(focusScale, focusScale);
              return m;
          }
      }

      // CAS B : STANDARD (Fit Cover/Contain)
      const fitScale = viewerSize / NATIVE_SIZE;
      m.scale(fitScale, fitScale);
      return m;

  }, [image, viewerSize, autoCenter, skiaPaths]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#000" /></View>;
  }

  const SQUARE_SIZE = image.height();

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        <Group matrix={matrixTransform}>
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={SQUARE_SIZE} height={SQUARE_SIZE}
                fit="cover"
              />
          )}
          
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
        </Group>
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: 'transparent' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});