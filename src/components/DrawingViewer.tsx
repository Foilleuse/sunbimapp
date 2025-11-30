import React, { useMemo, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Canvas, Path, Image as SkiaImage, useImage, Group, Skia, SkPath } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';

interface DrawingViewerProps {
  imageUri: string;
  canvasData: any; 
  viewerSize: number;
  viewerHeight?: number; // Hauteur optionnelle pour le mode plein écran
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

  // Si viewerHeight n'est pas fourni, on assume un ratio par défaut (ou carré)
  // Pour le Feed qui est "flex", il vaudrait mieux passer la hauteur réelle via onLayout, 
  // mais ici on va utiliser viewerHeight s'il est là (Index), sinon viewerSize * 1.33 (Feed 3:4)
  const VIEW_HEIGHT = viewerHeight || (viewerSize * (4/3));

  useEffect(() => {
    if (animated) {
        progress.value = 0;
        progress.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) });
    } else {
        progress.value = startVisible ? 1 : 0;
    }
    setIsReady(true);
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

  const matrixTransform = useMemo(() => {
      const m = Skia.Matrix();
      if (!image) return m;
      
      const imgW = image.width();
      const imgH = image.height();
      if (imgH === 0 || imgW === 0) return m;

      // 1. Logique AUTO-CENTER (Zoom sur les traits)
      if (autoCenter && skiaPaths.length > 0) {
          const combinedPath = Skia.Path.Make();
          skiaPaths.forEach((p: any) => combinedPath.addPath(p.skPath));
          
          const bounds = combinedPath.getBounds();
          if (bounds.width > 10 && bounds.height > 10) {
              const padding = 40;
              const targetSize = viewerSize - padding;
              const focusScale = Math.min(targetSize / Math.max(bounds.width, bounds.height), 5);

              const translateX = (viewerSize - bounds.width * focusScale) / 2 - bounds.x * focusScale;
              const translateY = (VIEW_HEIGHT - bounds.height * focusScale) / 2 - bounds.y * focusScale;

              m.translate(translateX, translateY);
              m.scale(focusScale, focusScale);
              return m;
          }
      }

      // 2. Logique FIT COVER + CENTER (Correction de l'alignement)
      // On calcule l'échelle pour couvrir toute la zone (comme le CSS object-fit: cover)
      const scaleW = viewerSize / imgW;
      const scaleH = VIEW_HEIGHT / imgH;
      const scale = Math.max(scaleW, scaleH);

      // On calcule le décalage pour CENTRER l'image (comme le Canvas de dessin)
      const dx = (viewerSize - imgW * scale) / 2;
      const dy = (VIEW_HEIGHT - imgH * scale) / 2;

      m.translate(dx, dy);
      m.scale(scale, scale);
      
      return m;

  }, [image, viewerSize, VIEW_HEIGHT, autoCenter, skiaPaths]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: VIEW_HEIGHT}} />;
    return <View style={styles.loading}><ActivityIndicator color="#000" /></View>;
  }

  return (
    <View style={[styles.container, {width: viewerSize, height: VIEW_HEIGHT, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        <Group matrix={matrixTransform}>
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={image.width()} 
                height={image.height()} 
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