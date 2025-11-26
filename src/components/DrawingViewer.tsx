
import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Canvas, Path, Image as SkiaImage, useImage, Group, Skia } from '@shopify/react-native-skia';

interface DrawingViewerProps {
  imageUri: string;
  canvasData: any; 
  viewerSize: number;
  transparentMode?: boolean;
}

export const DrawingViewer: React.FC<DrawingViewerProps> = ({ 
  imageUri, 
  canvasData, 
  viewerSize, 
  transparentMode = false 
}) => {
  
  const { width: screenWidth } = Dimensions.get('window');
  const image = useImage(imageUri || ""); 

  // 1. Parsing
  const safePaths = useMemo(() => {
    let data = [];
    if (Array.isArray(canvasData)) data = canvasData;
    else if (typeof canvasData === 'string') {
        try { data = JSON.parse(canvasData); } catch (e) { data = []; }
    }
    return data;
  }, [canvasData]);

  // 2. Calcul de l'Échelle (Zoom)
  const transform = useMemo(() => {
    if (!image) return { scale: 1, translateX: 0, translateY: 0 };
    
    const NATIVE_H = image.height();
    if (NATIVE_H === 0) return { scale: 1, translateX: 0, translateY: 0 };

    // On fait rentrer le carré natif (H x H) dans le viewer
    const fitScale = viewerSize / NATIVE_H;

    return { scale: fitScale, translateX: 0, translateY: 0 };
  }, [image, viewerSize]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }

  // --- CALCUL DU CENTRAGE (Le Secret du Crop) ---
  const NATIVE_W = image.width();
  const NATIVE_H = image.height();
  
  // On veut simuler un carré de taille HxH
  // Si l'image est plus large que haute (Paysage), on doit la décaler vers la gauche
  // pour que le centre de l'image soit au centre du carré.
  const offsetX = (NATIVE_W - NATIVE_H) / 2;
  const offsetY = 0; // On assume que H est la référence, donc pas de décalage vertical

  const matrix = [
      { translateX: transform.translateX },
      { translateY: transform.translateY },
      { scale: transform.scale }
  ];

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        <Group transform={matrix}>
          
          {/* A. IMAGE DE FOND */}
          {!transparentMode && (
              <SkiaImage
                image={image}
                // ON APPLIQUE LE DÉCALAGE NÉGATIF POUR CENTRER
                x={-offsetX} 
                y={-offsetY}
                width={NATIVE_W} 
                height={NATIVE_H}
                fit="none" // On gère le crop nous-mêmes via x/y
              />
          )}
          
          {/* B. DESSINS */}
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!p || !p.svgPath) return null;

             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
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