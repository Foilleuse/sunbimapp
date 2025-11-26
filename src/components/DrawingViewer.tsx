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

  // 2. LOGIQUE MATRICE
  const displayLogic = useMemo(() => {
      const m = Skia.Matrix();
      if (!image) return { matrix: m, scale: 1 };
      
      const NATIVE_SIZE = image.height();
      if (NATIVE_SIZE === 0) return { matrix: m, scale: 1 };

      // CAS A : ZOOM AUTOMATIQUE
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

                      const translateX = (viewerSize - bounds.width * focusScale) / 2 - bounds.x * focusScale;
                      const translateY = (viewerSize - bounds.height * focusScale) / 2 - bounds.y * focusScale;

                      m.translate(translateX, translateY);
                      m.scale(focusScale, focusScale);
                      
                      // Note : ici le scale sert au groupe entier, donc aux traits aussi
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
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }

  const SQUARE_SIZE = image.height();

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        
        {/* LE GROUPE APPLIQUE LE ZOOM À TOUT LE MONDE (IMAGE + TRAITS) */}
        <Group matrix={displayLogic.matrix}>
          
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={SQUARE_SIZE} height={SQUARE_SIZE}
                fit="cover"
              />
          )}
          
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!p || !p.svgPath) return null;
             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 // --- CORRECTION FINALE ---
                 // On utilise la largeur native enregistrée. C'est tout.
                 // Puisque le <Group> au-dessus est zoomé/dézoomé,
                 // cette épaisseur sera zoomée/dézoomée automatiquement avec l'image.
                 // Si l'image devient toute petite, le trait devient tout fin.
                 // Si l'image devient géante, le trait devient épais.
                 const width = p.width || 15; // Valeur brute
                 
                 return (
                   <Path
                     key={index}
                     path={path}
                     color={p.isEraser ? "#000000" : (p.color || "#000000")}
                     style="stroke"
                     strokeWidth={width} // <--- PLUS AUCUN CALCUL ICI
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