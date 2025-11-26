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
  autoCenter?: boolean; // <--- L'option pour l'animation centrée
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

  // 2. CALCUL DE LA MATRICE (Position & Zoom)
  const displayLogic = useMemo(() => {
      const m = Skia.Matrix();
      
      // Par défaut, si pas d'image, scale 1
      if (!image) return { matrix: m, scale: 1 };
      
      const NATIVE_SIZE = image.height();
      if (NATIVE_SIZE === 0) return { matrix: m, scale: 1 };

      // Echelle standard (Feed/Galerie)
      const fitScale = viewerSize / NATIVE_SIZE;

      // --- MODE AUTO-CENTER (Pour l'animation de fin uniquement) ---
      if (autoCenter && safePaths.length > 0) {
          try {
              const combinedPath = Skia.Path.Make();
              let hasPaths = false;
              safePaths.forEach(p => {
                  if (p.svgPath) {
                      const path = Skia.Path.MakeFromSVGString(p.svgPath);
                      if (path) { combinedPath.addPath(path); hasPaths = true; }
                  }
              });

              if (hasPaths) {
                  const bounds = combinedPath.getBounds();
                  // Si le dessin a une taille correcte
                  if (bounds.width > 10 && bounds.height > 10) {
                      const padding = 40;
                      const targetSize = viewerSize - padding;
                      
                      // On calcule le zoom pour remplir l'écran avec le DESSIN
                      const focusScale = Math.min(targetSize / Math.max(bounds.width, bounds.height), 5); // Max zoom x5

                      // On centre le dessin dans le viewer
                      const tx = (viewerSize - bounds.width * focusScale) / 2 - bounds.x * focusScale;
                      const ty = (viewerSize - bounds.height * focusScale) / 2 - bounds.y * focusScale;

                      m.translate(tx, ty);
                      m.scale(focusScale, focusScale);
                      
                      // ON RENVOIE CETTE ÉCHELLE SPÉCIALE
                      return { matrix: m, scale: focusScale };
                  }
              }
          } catch (e) {}
      }

      // --- MODE STANDARD (Feed/Galerie) ---
      // On cale l'image sur le coin haut-gauche et on resize
      m.scale(fitScale, fitScale);
      return { matrix: m, scale: fitScale };

  }, [image, viewerSize, autoCenter, safePaths]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }

  // Dimensions pour l'image de fond
  const SQUARE_SIZE = image.height();

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        <Group matrix={displayLogic.matrix}>
          
          {/* IMAGE DE FOND (Seulement si pas en mode AutoCenter, car AutoCenter décalerait l'image) */}
          {!transparentMode && !autoCenter && (
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
                 
                 // --- MAGIE DE L'ÉPAISSEUR ---
                 const baseWidth = p.width || 6;
                 
                 // On divise par l'échelle actuelle (qu'elle soit standard ou zoomée)
                 // Résultat : Le trait garde toujours la même épaisseur VISUELLE (environ 4-5px sur l'écran)
                 // peu importe le niveau de zoom.
                 const adjustedWidth = (baseWidth / displayLogic.scale) * 0.7; 
                 
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