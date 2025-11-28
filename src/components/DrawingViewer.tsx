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

const DrawingViewerComponent: React.FC<DrawingViewerProps> = ({ 
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

  const safePaths = useMemo(() => {
    let data = [];
    if (Array.isArray(canvasData)) data = canvasData;
    else if (typeof canvasData === 'string') {
        try { data = JSON.parse(canvasData); } catch (e) { data = []; }
    }
    return data;
  }, [canvasData]);

  // --- LE CALCUL DE PRÉCISION ---
  const displayLogic = useMemo(() => {
      const m = Skia.Matrix();
      if (!image) return { matrix: m, scale: 1 };
      
      const IMG_W = image.width();
      const IMG_H = image.height();
      
      if (IMG_W === 0 || IMG_H === 0) return { matrix: m, scale: 1 };

      // 1. MODE ANIMATION (Zoom sur le dessin)
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
                      // On zoome pour que le DESSIN remplisse l'écran (max x4)
                      const focusScale = Math.min(targetSize / Math.max(bounds.width, bounds.height), 4);

                      // On centre le dessin
                      const tx = (viewerSize - bounds.width * focusScale) / 2 - bounds.x * focusScale;
                      const ty = (viewerSize - bounds.height * focusScale) / 2 - bounds.y * focusScale;

                      m.translate(tx, ty);
                      m.scale(focusScale, focusScale);
                      return { matrix: m, scale: focusScale };
                  }
              }
          } catch (e) {}
      }

      // 2. MODE STANDARD (Feed/Galerie) : "COVER" MANUEL
      // On veut que l'image remplisse le viewerSize (carré)
      // On calcule le ratio nécessaire pour la largeur et la hauteur
      const scaleW = viewerSize / IMG_W;
      const scaleH = viewerSize / IMG_H;
      
      // Pour faire un "Cover", on prend le plus GRAND des deux ratios
      const scale = Math.max(scaleW, scaleH);

      // On calcule la taille finale de l'image une fois zoomée
      const targetW = IMG_W * scale;
      const targetH = IMG_H * scale;

      // On centre : (TailleEcran - TailleImage) / 2
      const dx = (viewerSize - targetW) / 2;
      const dy = (viewerSize - targetH) / 2;

      m.translate(dx, dy);
      m.scale(scale, scale);

      return { matrix: m, scale: scale };

  }, [image, viewerSize, autoCenter, safePaths]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }

  const IMG_W = image.width();
  const IMG_H = image.height();

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        {/* GROUPE UNIQUE : Image et Traits bougent ensemble */}
        <Group matrix={displayLogic.matrix}>
          
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={IMG_W} height={IMG_H}
                fit="none" // IMPORTANT : On désactive l'auto-layout de Skia, c'est notre matrice qui gère
              />
          )}
          
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!p || !p.svgPath) return null;
             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 // COMPENSATION ÉPAISSEUR
                 // On divise par le scale pour que le trait garde une taille humaine à l'écran
                 const baseWidth = p.width || 10;
                 // Facteur 0.6 pour affiner le rendu
                 const adjustedWidth = (baseWidth / displayLogic.scale) * 0.6; 
                 
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
                     start={0} end={progress} 
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

export const DrawingViewer = memo(DrawingViewerComponent);