import React, { useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
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

  // 2. Calcul du Zoom (ALIGNEMENT STRICT 0,0)
  const transform = useMemo(() => {
    if (!image) return { scale: 1 };
    
    const CANVAS_SIZE = image.height(); // Référence carrée
    if (CANVAS_SIZE === 0) return { scale: 1 };

    // On calcule juste l'échelle pour passer de "Taille Native" à "Taille Écran"
    const fitScale = viewerSize / CANVAS_SIZE;

    // 🛑 STOP : On ne calcule plus de translateX/Y.
    // Les données vectorielles sont déjà relatives au coin de l'image.
    // On colle tout en haut à gauche (0,0).
    return { scale: fitScale };
  }, [image, viewerSize]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }

  const DISPLAY_SIZE = image.height();
  
  // Matrice simplifiée
  const matrix = [{ scale: transform.scale }];

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        <Group transform={matrix}>
          
          {/* IMAGE DE FOND */}
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0} // Toujours à 0,0
                width={DISPLAY_SIZE} height={DISPLAY_SIZE}
                fit="cover"
              />
          )}
          
          {/* DESSINS */}
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!p || !p.svgPath) return null;

             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 // Compensation épaisseur (pour garder le trait visible)
                 const baseWidth = p.width || 6;
                 const adjustedWidth = baseWidth / transform.scale;
                 
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