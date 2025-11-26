import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Canvas, Path, Image as SkiaImage, useImage, Group, Skia } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';

interface DrawingViewerProps {
  imageUri: string;
  canvasData: any; 
  viewerSize: number;
  transparentMode?: boolean;
  animated?: boolean;     // Pour déclencher le tracé
  startVisible?: boolean; // Pour décider si on voit le dessin direct ou pas
}

export const DrawingViewer: React.FC<DrawingViewerProps> = ({ 
  imageUri, 
  canvasData, 
  viewerSize, 
  transparentMode = false,
  animated = false,
  startVisible = true // Par défaut (Galerie), c'est visible tout de suite
}) => {
  
  const { width: screenWidth } = Dimensions.get('window');
  // Image de fallback pour éviter le crash si URI vide
  const image = useImage(imageUri || "https://via.placeholder.com/1000"); 

  // --- MOTEUR D'ANIMATION ---
  const progress = useSharedValue(startVisible ? 1 : 0);

  useEffect(() => {
    if (animated) {
        // Si on anime : on part de 0 et on va à 1
        progress.value = 0;
        progress.value = withTiming(1, { 
            duration: 1500, // 1.5 secondes
            easing: Easing.out(Easing.cubic) 
        });
    } else if (!startVisible) {
        // Si pas animé et pas censé être visible (Feed en attente) -> 0
        progress.value = 0; 
    } else {
        // Si pas animé et censé être visible (Galerie) -> 1
        progress.value = 1;
    }
  }, [animated, startVisible, imageUri]);

  // 1. Parsing sécurisé
  const safePaths = useMemo(() => {
    let data = [];
    if (Array.isArray(canvasData)) data = canvasData;
    else if (typeof canvasData === 'string') {
        try { data = JSON.parse(canvasData); } catch (e) { data = []; }
    }
    return data;
  }, [canvasData]);

  // 2. Calcul du Zoom (Basé sur la hauteur pour le carré)
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

  // Dimensions natives pour le crop manuel
  const NATIVE_W = image.width();
  const NATIVE_H = image.height();
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
          
          {/* IMAGE DE FOND (Centrée manuellement) */}
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={-offsetX} y={-offsetY}
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
                 
                 // ÉPAISSEUR PROPORTIONNELLE (Sans le test jaune)
                 const baseWidth = p.width || 6;
                 const adjustedWidth = (baseWidth / transform.scale) * 0.6; 
                 
                 return (
                   <Path
                     key={index}
                     path={path}
                     // VRAIES COULEURS
                     color={p.isEraser ? "#000000" : (p.color || "#000000")}
                     style="stroke"
                     strokeWidth={adjustedWidth} 
                     strokeCap="round"
                     strokeJoin="round"
                     blendMode={p.isEraser ? "clear" : "srcOver"}
                     // ANIMATION
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