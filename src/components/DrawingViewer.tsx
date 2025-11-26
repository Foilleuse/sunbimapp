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
  // On retire autoCenterAndScale qui causait le bug de position
}

export const DrawingViewer: React.FC<DrawingViewerProps> = ({ 
  imageUri, 
  canvasData, 
  viewerSize, 
  transparentMode = false,
  animated = false,
  startVisible = true
}) => {
  
  const { width: screenWidth } = Dimensions.get('window');
  const image = useImage(imageUri || "https://via.placeholder.com/1000"); 

  // --- ANIMATION ---
  const progress = useSharedValue(startVisible ? 1 : 0);

  useEffect(() => {
    if (animated) {
        progress.value = 0;
        progress.value = withTiming(1, { 
            duration: 1500, 
            easing: Easing.out(Easing.cubic) 
        });
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

  // 2. Calcul du Zoom (ALIGNEMENT SUR LE CRÉATEUR)
  const transform = useMemo(() => {
    if (!image) return { scale: 1 };
    
    // Référence : La Hauteur (comme dans DrawingCanvas)
    const NATIVE_SIZE = image.height(); 
    if (NATIVE_SIZE === 0) return { scale: 1 };

    // On adapte ce carré natif à la taille de l'écran
    const fitScale = viewerSize / NATIVE_SIZE;

    // Pas de translation. On reste en 0,0.
    return { scale: fitScale };
  }, [image, viewerSize]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }

  // On force la dimension carrée basée sur la hauteur
  const SQUARE_SIZE = image.height();
  
  const matrix = [{ scale: transform.scale }];

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        <Group transform={matrix}>
          
          {/* IMAGE DE FOND */}
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={SQUARE_SIZE} height={SQUARE_SIZE}
                fit="cover" // Skia va centrer et rogner l'image automatiquement
              />
          )}
          
          {/* DESSINS */}
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!p || !p.svgPath) return null;

             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 // ÉPAISSEUR : On remet le calcul qui marchait bien
                 const baseWidth = p.width || 6;
                 const adjustedWidth = (baseWidth / transform.scale) * 0.65; 
                 
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