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

  // --- ANIMATION ---
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

  // 2. LOGIQUE D'AFFICHAGE (C'est ici la correction)
  const displayLogic = useMemo(() => {
      const m = Skia.Matrix();
      if (!image) return { matrix: m, fit: "cover" as const, scale: 1, useMatrix: false };
      
      const NATIVE_SIZE = image.height();
      if (NATIVE_SIZE === 0) return { matrix: m, fit: "cover" as const, scale: 1, useMatrix: false };

      // --- CAS A : ZOOM AUTOMATIQUE (Animation Fin Index) ---
      // Ici on calcule une matrice complexe pour centrer le dessin
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
                      const focusScale = Math.min(targetSize / Math.max(bounds.width, bounds.height), 3);

                      const translateX = (viewerSize - bounds.width * focusScale) / 2 - bounds.x * focusScale;
                      const translateY = (viewerSize - bounds.height * focusScale) / 2 - bounds.y * focusScale;

                      m.translate(translateX, translateY);
                      m.scale(focusScale, focusScale);
                      
                      // En mode AutoCenter, on applique la matrice et on ignore l'image (souvent transparente)
                      return { matrix: m, fit: "none" as const, scale: focusScale, useMatrix: true };
                  }
              }
          } catch (e) {}
      }

      // --- CAS B : AFFICHAGE STANDARD (Feed / Galerie) ---
      // C'est le retour à la méthode simple qui marche :
      // 1. On utilise fit="cover" pour l'image (Skia gère le centrage)
      // 2. On utilise un scale simple pour les traits. Pas de translation.
      
      const simpleScale = viewerSize / NATIVE_SIZE;
      m.scale(simpleScale, simpleScale);
      
      return { matrix: m, fit: "cover" as const, scale: simpleScale, useMatrix: false };

  }, [image, viewerSize, autoCenter, safePaths]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }

  // On force le carré basé sur la hauteur
  const SQUARE_SIZE = image.height();

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        
        {/* CAS 1 : GROUPE MATRICIEL (Pour l'animation zoomée) */}
        {displayLogic.useMatrix ? (
            <Group matrix={displayLogic.matrix}>
                 {/* On n'affiche généralement pas l'image en mode AutoCenter (fond blanc) */}
                 <Group layer={true}> 
                    {renderPaths(safePaths, displayLogic.scale, progress)}
                 </Group>
            </Group>
        ) : (
            // CAS 2 : GROUPE STANDARD (Feed/Galerie - Positionnement parfait)
            <>
                {/* L'IMAGE (Gérée par Skia Cover) */}
                {!transparentMode && (
                    <SkiaImage
                        image={image}
                        x={0} y={0}
                        width={SQUARE_SIZE} height={SQUARE_SIZE}
                        fit="cover"
                    />
                )}
                
                {/* LES TRAITS (Juste Scalés, pas décalés) */}
                <Group transform={[{ scale: displayLogic.scale }]}>
                    <Group layer={true}>
                        {renderPaths(safePaths, displayLogic.scale, progress)}
                    </Group>
                </Group>
            </>
        )}

      </Canvas>
    </View>
  );
};

// Helper pour dessiner les traits
const renderPaths = (paths: any[], currentScale: number, progress: any) => {
    return paths.map((p: any, index: number) => {
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
    });
};

const styles = StyleSheet.create({
  container: { backgroundColor: 'transparent' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});