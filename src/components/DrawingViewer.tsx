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
  autoCenter?: boolean; // Option pour l'index
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

  // --- LE CERVEAU DU POSITIONNEMENT ---
  const displayLogic = useMemo(() => {
      const m = Skia.Matrix();
      
      // Sécurité de base
      if (!image) return { matrix: m, scale: 1 };
      const IMG_H = image.height();
      if (IMG_H === 0) return { matrix: m, scale: 1 };

      // --- MODE A : AUTO-CENTER (Pour l'animation de fin sur l'Index) ---
      // On ignore l'image, on veut juste que le DESSIN remplisse l'écran blanc
      if (autoCenter && safePaths.length > 0) {
          try {
              const combinedPath = Skia.Path.Make();
              let hasPath = false;
              safePaths.forEach(p => {
                  if (p.svgPath) {
                      const path = Skia.Path.MakeFromSVGString(p.svgPath);
                      if (path) { combinedPath.addPath(path); hasPath = true; }
                  }
              });

              if (hasPath) {
                  const bounds = combinedPath.getBounds();
                  // On vérifie que le dessin n'est pas minuscule (évite division par zéro)
                  if (bounds.width > 10 && bounds.height > 10) {
                      const padding = 40;
                      const targetSize = viewerSize - padding;
                      // Zoom max x4 pour pas que ça pixelise trop
                      const focusScale = Math.min(targetSize / Math.max(bounds.width, bounds.height), 4);
                      
                      const tx = (viewerSize - bounds.width * focusScale) / 2 - bounds.x * focusScale;
                      const ty = (viewerSize - bounds.height * focusScale) / 2 - bounds.y * focusScale;

                      m.translate(tx, ty);
                      m.scale(focusScale, focusScale);
                      return { matrix: m, scale: focusScale };
                  }
              }
          } catch (e) {
              console.log("Erreur AutoCenter, repli sur standard");
          }
      }

      // --- MODE B : STANDARD (Feed / Galerie) ---
      // On veut que l'image soit calée parfaitement (Hauteur Image = Hauteur Viewer)
      // C'est ce qui garantit que le dessin est au bon endroit sur la photo.
      
      const fitScale = viewerSize / IMG_H;
      m.scale(fitScale, fitScale);
      
      return { matrix: m, scale: fitScale };

  }, [image, viewerSize, autoCenter, safePaths]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }

  // Dimensions natives pour l'affichage de l'image
  const IMG_W = image.width();
  const IMG_H = image.height();

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        <Group matrix={displayLogic.matrix}>
          
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={IMG_W} height={IMG_H}
                fit="none" // IMPORTANT : On laisse la matrice gérer le zoom
              />
          )}
          
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!p || !p.svgPath) return null;
             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 // Épaisseur "Intelligente"
                 // On prend l'épaisseur enregistrée (ou 0.5% de l'image si manquante)
                 const baseWidth = p.width || (IMG_W * 0.005);
                 
                 // On divise par le scale pour que visuellement, le trait ne soit pas énorme
                 // Multiplié par 0.6 pour la finesse esthétique
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