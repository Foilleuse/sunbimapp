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

// Fonction utilitaire sortie du composant pour éviter sa redéfinition à chaque render
const getSkiaPath = (svgString: string): SkPath | null => {
    try {
        return Skia.Path.MakeFromSVGString(svgString);
    } catch {
        return null;
    }
};

// --- COMPOSANT INTERNE (Logique d'affichage) ---
const DrawingViewerContent: React.FC<DrawingViewerProps> = ({ 
  imageUri, 
  canvasData, 
  viewerSize, 
  transparentMode = false,
  animated = false,
  startVisible = true,
  autoCenter = false
}) => {
  
  const image = useImage(imageUri); 
  
  // Initialisation : Si on doit animer, on commence TOUJOURS à 0 (startVisible est ignoré si animated=true au montage grâce au reset par key)
  const progress = useSharedValue(startVisible ? 1 : 0);

  useEffect(() => {
    if (animated) {
        // On force à 0 immédiatement puis on lance l'animation
        progress.value = 0;
        progress.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) });
    } else {
        progress.value = startVisible ? 1 : 0;
    }
  }, [animated, startVisible]);

  // --- OPTIMISATION 1 : Mémoïsation des chemins ---
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

  // --- OPTIMISATION 2 : Mémoïsation de la matrice ---
  const matrixTransform = useMemo(() => {
      const m = Skia.Matrix();
      if (!image) return m;
      
      const NATIVE_SIZE = image.height();
      if (NATIVE_SIZE === 0) return m;

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

// --- COMPOSANT WRAPPER (Pour gérer le Reset sans flash) ---
export const DrawingViewer: React.FC<DrawingViewerProps> = (props) => {
  // L'astuce est ici : on utilise une `key` basée sur `animated`.
  // Quand on passe de "Statique" (animated=false) à "Animé" (animated=true),
  // React démonte et remonte le composant Content.
  // Cela force `useSharedValue` à s'initialiser directement à 0, sans garder la valeur 1 précédente en mémoire.
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