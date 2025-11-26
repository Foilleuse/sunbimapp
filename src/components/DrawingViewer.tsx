import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Canvas, Path, Image as SkiaImage, useImage, Group, Skia } from '@shopify/react-native-skia';
// Ajout des outils d'animation
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';

interface DrawingViewerProps {
  imageUri: string;
  canvasData: any; 
  viewerSize: number;
  transparentMode?: boolean;
  animated?: boolean; // <--- Option pour activer l'effet
}

export const DrawingViewer: React.FC<DrawingViewerProps> = ({ 
  imageUri, 
  canvasData, 
  viewerSize, 
  transparentMode = false,
  animated = false
}) => {
  
  const { width: screenWidth } = Dimensions.get('window');
  const image = useImage(imageUri || ""); 

  // --- 1. MOTEUR D'ANIMATION ---
  // Si on demande l'animation, on commence à 0. Sinon on est direct à 1 (100% visible).
  const progress = useSharedValue(animated ? 0 : 1);

  useEffect(() => {
    if (animated) {
        // On reset à 0
        progress.value = 0;
        // On lance l'animation vers 1 en 2.5 secondes
        progress.value = withTiming(1, { 
            duration: 2500, 
            easing: Easing.out(Easing.cubic) 
        });
    } else {
        progress.value = 1; // Force l'affichage immédiat si pas d'animation
    }
  }, [animated, imageUri]); // Se relance si l'image change

  // --- 2. PARSING DONNÉES ---
  const safePaths = useMemo(() => {
    let data = [];
    if (Array.isArray(canvasData)) data = canvasData;
    else if (typeof canvasData === 'string') {
        try { data = JSON.parse(canvasData); } catch (e) { data = []; }
    }
    return data;
  }, [canvasData]);

  // --- 3. CALCUL ZOOM (Strict Carré) ---
  const transform = useMemo(() => {
    if (!image) return { scale: 1, translateX: 0, translateY: 0 };
    
    const CANVAS_SIZE = image.height();
    if (CANVAS_SIZE === 0) return { scale: 1, translateX: 0, translateY: 0 };

    const fitScale = viewerSize / CANVAS_SIZE;
    return { scale: fitScale, translateX: 0, translateY: 0 };
  }, [image, viewerSize]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }

  // --- 4. CALCUL CADRAGE (Le Crop Parfait) ---
  const NATIVE_W = image.width();
  const NATIVE_H = image.height();
  
  // Centrage horizontal du carré
  const offsetX = (NATIVE_W - NATIVE_H) / 2;
  const offsetY = 0;

  const matrix = [
      { translateX: transform.translateX },
      { translateY: transform.translateY },
      { scale: transform.scale }
  ];

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        <Group transform={matrix}>
          
          {/* IMAGE (Avec le bon crop manuel) */}
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={-offsetX} y={-offsetY} // <--- C'est ça qui garde l'image centrée comme à la création
                width={NATIVE_W} height={NATIVE_H}
                fit="none"
              />
          )}
          
          {/* DESSINS */}
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!p || !p.svgPath) return null;

             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 // ÉPAISSEUR (Adaptée + Affinée)
                 const baseWidth = p.width || 6;
                 const adjustedWidth = (baseWidth / transform.scale) * 0.6; 
                 
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
                     // L'ANIMATION EST ICI 👇
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