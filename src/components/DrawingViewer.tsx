import React, { useMemo, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Canvas, Path, Image as SkiaImage, useImage, Group, Skia, SkPath } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';

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
  
  const image = useImage(imageUri); 
  const [isReady, setIsReady] = useState(false); 
  const progress = useSharedValue(animated ? 0 : (startVisible ? 1 : 0));

  // --- 1. DÉFINITION DU "PAPIER" (Même logique que DrawingCanvas) ---
  // On crée une surface virtuelle en 3:4 basée sur la largeur du viewer.
  // C'est dans ce repère que les traits ont été enregistrés.
  const PAPER_W = viewerSize;
  const PAPER_H = viewerSize * (4/3);

  // --- 2. DÉFINITION DE LA CIBLE (Viewport) ---
  // Hauteur réelle d'affichage (si pas fournie, on reste en 3:4)
  const TARGET_H = viewerHeight || PAPER_H;

  useEffect(() => {
    if (animated) {
        progress.value = 0;
        progress.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) });
    } else {
        progress.value = startVisible ? 1 : 0;
    }
    const timer = setTimeout(() => setIsReady(true), 50);
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
      if (!image) return [];
      
      // Logique Auto-Center (Zoom sur l'encre)
      if (autoCenter && skiaPaths.length > 0) {
          const combinedPath = Skia.Path.Make();
          skiaPaths.forEach((p: any) => combinedPath.addPath(p.skPath));
          const bounds = combinedPath.getBounds();
          
          if (bounds.width > 10 && bounds.height > 10) {
              const padding = 40;
              // On calcule le zoom pour faire tenir la bounding box des traits dans le viewer
              const focusScale = Math.min((viewerSize - padding) / Math.max(bounds.width, bounds.height), 5);
              
              const tx = (viewerSize - bounds.width * focusScale) / 2 - bounds.x * focusScale;
              const ty = (TARGET_H - bounds.height * focusScale) / 2 - bounds.y * focusScale;

              return [{ translateX: tx }, { translateY: ty }, { scale: focusScale }];
          }
      }

      // Logique STANDARD (Cover Screen)
      // On doit faire rentrer notre PAPIER 3:4 dans le Viewport TARGET (Plein écran ou autre)
      // en mode "Cover" (remplir tout).
      
      const scaleW = viewerSize / PAPER_W; // = 1
      const scaleH = TARGET_H / PAPER_H;
      const scale = Math.max(scaleW, scaleH);

      // Centrage
      const scaledW = PAPER_W * scale;
      const scaledH = PAPER_H * scale;
      
      const translateX = (viewerSize - scaledW) / 2;
      const translateY = (TARGET_H - scaledH) / 2;

      return [{ translateX }, { translateY }, { scale }];

  }, [image, viewerSize, TARGET_H, autoCenter, skiaPaths]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: TARGET_H}} />;
    return <View style={styles.loading}><ActivityIndicator color="#000" /></View>;
  }

  return (
    <View style={[styles.container, {width: viewerSize, height: TARGET_H, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        {/* On transforme le groupe entier (Papier + Image + Traits) */}
        <Group transform={transforms}>
          
          {/* IMPORTANT : On affiche l'image DANS le cadre 3:4 (comme à la création) */}
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={PAPER_W} 
                height={PAPER_H} 
                fit="cover" 
              />
          )}
          
          {isReady && (
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
  container: { backgroundColor: 'transparent' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});