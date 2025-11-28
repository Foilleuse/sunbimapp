import React, { useMemo, useEffect, memo } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Canvas, Path, Image as SkiaImage, useImage, Group, Skia } from '@shopify/react-native-skia';
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

// Fonction pour demander une image plus légère à Supabase si c'est une miniature
const getOptimizedUrl = (url: string, size: number) => {
    if (!url) return "";
    // Si c'est une miniature (moins de 300px), on demande une version réduite
    if (size < 300 && url.includes('supabase.co')) {
        // On ajoute les paramètres de transformation Supabase
        return `${url}?width=400&resize=cover&quality=60`;
    }
    return url;
};

// On définit le composant, mais on ne l'exporte pas tout de suite
const DrawingViewerComponent: React.FC<DrawingViewerProps> = ({ 
  imageUri, 
  canvasData, 
  viewerSize, 
  transparentMode = false,
  animated = false,
  startVisible = true,
  autoCenter = false
}) => {
  
  // Optimisation URL
  const optimizedUri = useMemo(() => getOptimizedUrl(imageUri, viewerSize), [imageUri, viewerSize]);
  const image = useImage(optimizedUri || "https://via.placeholder.com/1000"); 

  const progress = useSharedValue(startVisible ? 1 : 0);

  useEffect(() => {
    if (animated) {
        progress.value = 0;
        progress.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) });
    } else if (!startVisible) {
        progress.value = 0; 
    } else {
        progress.value = 1;
    }
  }, [animated, startVisible, imageUri]); // Dépendances strictes

  const safePaths = useMemo(() => {
    let data = [];
    if (Array.isArray(canvasData)) data = canvasData;
    else if (typeof canvasData === 'string') {
        try { data = JSON.parse(canvasData); } catch (e) { data = []; }
    }
    return data;
  }, [canvasData]);

  const displayLogic = useMemo(() => {
      const m = Skia.Matrix();
      if (!image) return { matrix: m, scale: 1 };
      
      const NATIVE_SIZE = image.height();
      if (NATIVE_SIZE === 0) return { matrix: m, scale: 1 };

      // CAS A : ZOOM AUTO
      if (autoCenter && safePaths.length > 0) {
          try {
              const combinedPath = Skia.Path.Make();
              let valid = false;
              safePaths.forEach(p => {
                  if (p.svgPath) {
                      const path = Skia.Path.MakeFromSVGString(p.svgPath);
                      if (path) { combinedPath.addPath(path); valid = true; }
                  }
              });
              if (valid) {
                  const bounds = combinedPath.getBounds();
                  if (bounds.width > 10 && bounds.height > 10) {
                      const padding = 40;
                      const targetSize = viewerSize - padding;
                      const focusScale = Math.min(targetSize / Math.max(bounds.width, bounds.height), 5);
                      const tx = (viewerSize - bounds.width * focusScale) / 2 - bounds.x * focusScale;
                      const ty = (viewerSize - bounds.height * focusScale) / 2 - bounds.y * focusScale;
                      m.translate(tx, ty);
                      m.scale(focusScale, focusScale);
                      return { matrix: m, scale: focusScale };
                  }
              }
          } catch (e) {}
      }

      // CAS B : STANDARD
      const fitScale = viewerSize / NATIVE_SIZE;
      m.scale(fitScale, fitScale);
      return { matrix: m, scale: fitScale };

  }, [image, viewerSize, autoCenter, safePaths]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    // Loader allégé (simple vue grise) pour éviter de surcharger le thread JS
    return <View style={[styles.loading, {width: viewerSize, height: viewerSize}]} />;
  }

  const SQUARE_SIZE = image.height();

  return (
    <View style={{width: viewerSize, height: viewerSize, overflow: 'hidden'}}>
      <Canvas style={{ flex: 1 }}>
        <Group matrix={displayLogic.matrix}>
          {!transparentMode && (
              <SkiaImage image={image} x={0} y={0} width={SQUARE_SIZE} height={SQUARE_SIZE} fit="cover" />
          )}
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!p || !p.svgPath) return null;
             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 const width = p.width || 10; 
                 return (
                   <Path
                     key={index} path={path} color={p.isEraser ? "#000000" : (p.color || "#000000")}
                     style="stroke" strokeWidth={width} strokeCap="round" strokeJoin="round"
                     blendMode={p.isEraser ? "clear" : "srcOver"} start={0} end={progress} 
                   />
                 );
             } catch (e) { return null; }
          })}
          </Group>
        </Group>
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  loading: { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' }
});

// --- OPTIMISATION FINALE ---
// React.memo empêche le re-rendu si les props n'ont pas changé.
// C'est vital pour les performances de la FlatList.
export const DrawingViewer = memo(DrawingViewerComponent, (prev, next) => {
    return (
        prev.imageUri === next.imageUri &&
        prev.viewerSize === next.viewerSize &&
        prev.transparentMode === next.transparentMode &&
        prev.animated === next.animated &&
        prev.startVisible === next.startVisible
        // On ne compare pas canvasData en profondeur car c'est couteux, 
        // on assume que si l'ID change, le composant parent changera.
    );
});