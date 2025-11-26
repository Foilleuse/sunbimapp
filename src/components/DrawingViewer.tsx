import React, { useMemo, useEffect } from 'react';
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

export const DrawingViewer: React.FC<DrawingViewerProps> = ({ 
  imageUri, 
  canvasData, 
  viewerSize, 
  transparentMode = false,
  animated = false,
  startVisible = true,
  autoCenter = false
}) => {
  
  const image = useImage(imageUri || "https://via.placeholder.com/1000"); 

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
  }, [animated, startVisible, imageUri]);

  // 1. Parsing
  const safePaths = useMemo(() => {
    let data = [];
    if (Array.isArray(canvasData)) data = canvasData;
    else if (typeof canvasData === 'string') {
        try { data = JSON.parse(canvasData); } catch (e) { data = []; }
    }
    return data;
  }, [canvasData]);

  // 2. LOGIQUE D'AFFICHAGE
  const displayLogic = useMemo(() => {
      const m = Skia.Matrix();
      if (!image) return { matrix: m, scale: 1 };
      
      const NATIVE_SIZE = image.height();
      if (NATIVE_SIZE === 0) return { matrix: m, scale: 1 };

      // CAS A : ZOOM AUTOMATIQUE (Animation Fin)
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
                      
                      // On calcule le zoom
                      const focusScale = Math.min(targetSize / Math.max(bounds.width, bounds.height), 4);

                      // On centre
                      const translateX = (viewerSize - bounds.width * focusScale) / 2 - bounds.x * focusScale;
                      const translateY = (viewerSize - bounds.height * focusScale) / 2 - bounds.y * focusScale;

                      m.translate(translateX, translateY);
                      m.scale(focusScale, focusScale);
                      
                      return { matrix: m, scale: focusScale };
                  }
              }
          } catch (e) {}
      }

      // CAS B : STANDARD (Feed/Galerie)
      const simpleScale = viewerSize / NATIVE_SIZE;
      m.scale(simpleScale, simpleScale);
      
      return { matrix: m, scale: simpleScale };

  }, [image, viewerSize, autoCenter, safePaths]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }

  const SQUARE_SIZE = image.height();

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        <Group matrix={displayLogic.matrix}>
          
          {/* IMAGE */}
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={SQUARE_SIZE} height={SQUARE_SIZE}
                fit="cover"
              />
          )}
          
          {/* DESSINS */}
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!p || !p.svgPath) return null;

             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 // --- CORRECTION DÉFINITIVE DE L'ÉPAISSEUR ---
                 // On utilise la largeur enregistrée (p.width).
                 // C'est tout. Pas de division, pas de multiplication.
                 // Le Groupe (Group matrix) gère déjà le zoom de tout le monde.
                 
                 // (On garde juste une sécurité "|| 10" pour les vieux dessins sans épaisseur)
                 const naturalWidth = p.width || 15; 

                 return (
                   <Path
                     key={index}
                     path={path}
                     color={p.isEraser ? "#000000" : (p.color || "#000000")}
                     style="stroke"
                     strokeWidth={naturalWidth} 
                     strokeCap="round"
                     strokeJoin="round"
                     blendMode={p.isEraser ? "clear" : "srcOver"}
                     start={0}
                     end={progress} 
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
  container: { backgroundColor: 'transparent' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});