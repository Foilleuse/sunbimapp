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

  // 2. Calcul du Zoom (1:1 Carré Strict)
  const transform = useMemo(() => {
    if (!image) return { scale: 1, translateX: 0, translateY: 0 };
    
    // On prend la plus petite dimension pour créer un carré central
    // (Ou on se base sur la hauteur comme avant, mais on force le cover)
    const NATIVE_SIZE = Math.min(image.width(), image.height()); 
    if (NATIVE_SIZE === 0) return { scale: 1, translateX: 0, translateY: 0 };

    const fitScale = viewerSize / NATIVE_SIZE;
    
    // On centre l'image native dans notre viewer carré
    const centerTx = (viewerSize - (image.width() * fitScale)) / 2;
    const centerTy = (viewerSize - (image.height() * fitScale)) / 2;

    return { scale: fitScale, translateX: centerTx, translateY: centerTy };
  }, [image, viewerSize]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }

  const matrix = [
      { translateX: transform.translateX },
      { translateY: transform.translateY },
      { scale: transform.scale }
  ];

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        <Group transform={matrix}>
          
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={image.width()} height={image.height()}
                fit="cover" // Remplit tout l'espace dispo
              />
          )}
          
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!p || !p.svgPath) return null;
             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 // --- CORRECTION MAJEURE : Mode Proportionnel ---
                 // On utilise p.width brut. Comme on est dans un <Group> qui a un scale,
                 // l'épaisseur sera réduite automatiquement avec l'image.
                 // C'est ce qui rend les miniatures nettes.
                 const width = p.width || 6;

                 return (
                   <Path
                     key={index}
                     path={path}
                     color={p.isEraser ? "#000000" : (p.color || "#000000")}
                     style="stroke"
                     strokeWidth={width} 
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
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F0F0' }
});