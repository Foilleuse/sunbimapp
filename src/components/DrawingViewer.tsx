import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Canvas, Path, Image as SkiaImage, useImage, Group, Skia } from '@shopify/react-native-skia';

interface DrawingViewerProps {
  imageUri: string;
  canvasData: any; 
  viewerSize: number; // Taille du carré final (ex: 150px)
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

  // 1. Parsing des données
  const safePaths = useMemo(() => {
    let data = [];
    if (Array.isArray(canvasData)) data = canvasData;
    else if (typeof canvasData === 'string') {
        try { data = JSON.parse(canvasData); } catch (e) { data = []; }
    }
    return data;
  }, [canvasData]);

  // 2. Calcul du Zoom (Alignement STRICT 0,0)
  const transform = useMemo(() => {
    if (!image) return { scale: 1 };
    
    // On se base sur la hauteur pour l'échelle (comme à la création)
    const H = image.height();
    if (H === 0) return { scale: 1 };

    // On calcule l'échelle pour que la hauteur de l'image = hauteur du viewer
    const scale = viewerSize / H;

    return { scale };
  }, [image, viewerSize]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#ccc" /></View>;
  }

  // Dimensions natives complètes
  const NATIVE_W = image.width();
  const NATIVE_H = image.height();
  
  const matrix = [{ scale: transform.scale }];

  return (
    // Le View avec overflow: 'hidden' agit comme un cadre carré qui rogne ce qui dépasse
    <View style={[styles.container, {width: viewerSize, height: viewerSize, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        <Group transform={matrix}>
          
          {/* IMAGE DE FOND */}
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0} // Ancrage strict en haut à gauche
                width={NATIVE_W} height={NATIVE_H}
                fit="none" // IMPORTANT: On ne laisse pas Skia redimensionner ou centrer
              />
          )}
          
          {/* DESSINS */}
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!p || !p.svgPath) return null;

             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 // CALCUL ÉPAISSEUR
                 // 1. On prend la largeur originale
                 // 2. On la divise par le scale (pour compenser le zoom arrière)
                 // 3. On multiplie par 0.6 pour affiner le rendu sur les petits écrans
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
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F9F9' }
});