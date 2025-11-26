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

  // --- MOTEUR D'ANIMATION ---
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
  }, [animated, startVisible]);

  // 1. PARSING
  const safePaths = useMemo(() => {
    let data = [];
    if (Array.isArray(canvasData)) data = canvasData;
    else if (typeof canvasData === 'string') {
        try { data = JSON.parse(canvasData); } catch (e) { data = []; }
    }
    return data;
  }, [canvasData]);

  // 2. CALCUL DE LA MATRICE UNIFIÉE
  const matrix = useMemo(() => {
      const m = Skia.Matrix();
      if (!image) return m;
      const NATIVE_H = image.height();
      const NATIVE_W = image.width();
      if (NATIVE_H === 0) return m;

      // --- CAS A : ANIMATION ZOOMÉE (Centrage sur le dessin) ---
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
                      const focusScale = Math.min(targetSize / Math.max(bounds.width, bounds.height), 3); // Max zoom x3

                      const translateX = (viewerSize - bounds.width * focusScale) / 2 - bounds.x * focusScale;
                      const translateY = (viewerSize - bounds.height * focusScale) / 2 - bounds.y * focusScale;

                      m.translate(translateX, translateY);
                      m.scale(focusScale, focusScale);
                      return m;
                  }
              }
          } catch (e) {}
      }

      // --- CAS B : MODE STANDARD (Feed / Galerie) ---
      // On veut afficher un carré centré de l'image (H x H)
      
      // 1. Facteur de zoom pour que la Hauteur Native devienne la Hauteur Écran
      const fitScale = viewerSize / NATIVE_H;
      
      // 2. Calcul du décalage pour centrer horizontalement
      // On veut que le centre de l'image native soit au centre de l'écran
      // offset = (LargeurNative - HauteurNative) / 2
      const cropOffsetX = (NATIVE_W - NATIVE_H) / 2;

      // 3. Application de la matrice (Ordre inverse des opérations mathématiques)
      // On scale tout
      m.scale(fitScale, fitScale);
      // On décale vers la gauche pour centrer le crop
      m.translate(-cropOffsetX, 0);
      
      return m;

  }, [image, viewerSize, autoCenter, safePaths]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }

  // Facteur d'échelle actuel (approximatif pour l'épaisseur)
  const currentScale = matrix.get()[0] || 1;

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        {/* TOUT LE MONDE DANS LE MÊME GROUPE -> SYNCHRO PARFAITE */}
        <Group matrix={matrix}>
          
          {/* IMAGE DE FOND */}
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={image.width()} height={image.height()}
                fit="none" // On laisse la matrice gérer le placement
              />
          )}
          
          {/* DESSINS */}
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!p || !p.svgPath) return null;
             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 const baseWidth = p.width || 6;
                 const adjustedWidth = (baseWidth / currentScale) * 0.65; 
                 
                 return (
                   <Path
                     key={index}
                     path={path}
                     color={p.isEraser ? "#000000" : (p.color || "#000000")}
                     style="stroke"
                     strokeWidth={adjustedWidth} 
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