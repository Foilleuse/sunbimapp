import React, { useMemo, useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Image } from 'react-native';
import { Canvas, Path, Group, Skia, SkPath } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';

interface DrawingViewerProps {
  imageUri: string;
  canvasData: any; 
  viewerSize: number;
  viewerHeight?: number; 
  transparentMode?: boolean;
  animated?: boolean;
  startVisible?: boolean;
  autoCenter?: boolean; 
}

const getSkiaPath = (svgString: string): SkPath | null => {
    try {
        return Skia.Path.MakeFromSVGString(svgString);
    } catch {
        return null;
    }
};

const DrawingViewerContent: React.FC<DrawingViewerProps> = ({ 
  imageUri, 
  canvasData, 
  viewerSize, 
  viewerHeight,
  transparentMode = false,
  animated = false,
  startVisible = true,
  autoCenter = false
}) => {
  
  const optimizedUri = useMemo(() => {
      // On demande une taille légèrement supérieure pour la netteté sur écrans haute densité
      return getOptimizedImageUrl(imageUri, viewerSize * 2) || imageUri;
  }, [imageUri, viewerSize]);

  // Plus besoin de useImage ici, on utilise <Image> natif
  const [isReady, setIsReady] = useState(false); 
  
  const progress = useSharedValue(animated ? 0 : (startVisible ? 1 : 0));
  const opacity = useSharedValue(animated ? 0 : 1);

  const SCREEN_WIDTH = Dimensions.get('window').width;
  
  // Dimensions de référence du papier (sur lequel le dessin a été fait)
  const REF_PAPER_W = SCREEN_WIDTH;
  //const REF_PAPER_H = SCREEN_WIDTH * (4/3); // Non utilisé directement pour le scale

  const TARGET_W = viewerSize;
  const TARGET_H = viewerHeight || (viewerSize * (4/3));

  useEffect(() => {
    if (animated) {
        progress.value = 0;
        opacity.value = 0;
        opacity.value = withTiming(1, { duration: 1000 });
        progress.value = withTiming(1, { duration: 2200, easing: Easing.linear });
    } else {
        progress.value = startVisible ? 1 : 0;
        opacity.value = 1;
    }
    // Petit délai pour laisser le temps au layout de se stabiliser
    const timer = setTimeout(() => setIsReady(true), 10);
    return () => clearTimeout(timer);
  }, [animated, startVisible]);

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

  const transforms = useMemo(() => {
      // 1. Zoom Auto sur le dessin (si demandé)
      if (autoCenter && skiaPaths.length > 0) {
          const combinedPath = Skia.Path.Make();
          skiaPaths.forEach((p: any) => combinedPath.addPath(p.skPath));
          const bounds = combinedPath.getBounds();
          
          if (bounds.width > 10 && bounds.height > 10) {
              const padding = 20;
              // On calcule le scale pour faire tenir le dessin dans le viewer
              const scaleX = (TARGET_W - padding) / bounds.width;
              const scaleY = (TARGET_H - padding) / bounds.height;
              const focusScale = Math.min(scaleX, scaleY, 5); // Max zoom x5
              
              // Centrage
              const tx = (TARGET_W - bounds.width * focusScale) / 2 - bounds.x * focusScale;
              const ty = (TARGET_H - bounds.height * focusScale) / 2 - bounds.y * focusScale;

              return [{ translateX: tx }, { translateY: ty }, { scale: focusScale }];
          }
      }

      // 2. Mode STANDARD : On adapte l'échelle du papier d'origine à la taille du viewer
      const scale = TARGET_W / REF_PAPER_W;
      // On centre verticalement si le ratio est différent
      const scaledH = (REF_PAPER_W * (4/3)) * scale;
      const translateY = (TARGET_H - scaledH) / 2;

      return [{ translateX: 0 }, { translateY }, { scale }];

  }, [TARGET_W, TARGET_H, REF_PAPER_W, autoCenter, skiaPaths]);

  return (
    <View style={[styles.container, {width: TARGET_W, height: TARGET_H, overflow: 'hidden'}]}>
      
      {/* COUCHE 1 : IMAGE NATIVE (Optimisée pour le chargement) */}
      {!transparentMode && (
          <Image
            source={{ uri: optimizedUri }}
            style={[
                StyleSheet.absoluteFill, 
                { width: TARGET_W, height: TARGET_H, resizeMode: 'cover' }
            ]}
            fadeDuration={0} // Apparition immédiate si en cache
          />
      )}

      {/* COUCHE 2 : DESSIN VECTORIEL (Skia) */}
      <Canvas style={{ flex: 1 }}>
        <Group transform={transforms}>
          {isReady && (
            <Group layer={true} opacity={opacity}> 
            {skiaPaths.map((p: any, index: number) => (
              <Path
                key={index}
                path={p.skPath}
                color={p.isEraser ? "#000000" : (p.color || "#000000")}
                style="stroke"
                strokeWidth={p.width || 15}
                strokeCap="round"
                strokeJoin="round"
                // En mode gomme, on "efface" en utilisant 'clear' (si le canvas avait un fond)
                // Mais ici comme le fond est une Image native séparée, 'clear' rendrait le trait transparent
                // ce qui révélerait l'image native dessous, donc ça fonctionne comme une gomme !
                blendMode={p.isEraser ? "clear" : "srcOver"}
                start={0}
                end={progress} 
              />
            ))}
            </Group>
          )}
        </Group>
      </Canvas>
    </View>
  );
};

export const DrawingViewer: React.FC<DrawingViewerProps> = (props) => {
  return (
    <DrawingViewerContent 
      key={props.animated ? 'anim-mode' : 'static-mode'} 
      {...props} 
    />
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: 'transparent' }, // Transparent pour laisser voir l'image native ou le fond parent
});