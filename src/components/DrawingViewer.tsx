import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Canvas, Path, Image as SkiaImage, useImage, Group, Skia, Rect, Paint } from '@shopify/react-native-skia';

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

  // 1. Parsing des données
  const safePaths = useMemo(() => {
    let data = [];
    if (Array.isArray(canvasData)) data = canvasData;
    else if (typeof canvasData === 'string') {
        try { data = JSON.parse(canvasData); } catch (e) { data = []; }
    }
    return data;
  }, [canvasData]);

  // 2. Calcul du Zoom (Strictement Carré 1:1)
  const transform = useMemo(() => {
    if (!image) return { scale: 1 };
    
    const CANVAS_SIZE = image.height(); // Taille native
    if (CANVAS_SIZE === 0) return { scale: 1 };

    // On veut que le carré natif rentre dans le carré écran
    const fitScale = viewerSize / CANVAS_SIZE;
    
    return { scale: fitScale };
  }, [image, viewerSize]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }

  const NATIVE_SIZE = image.height();
  
  // Matrice simplifiée à l'extrême (Juste le Scale, tout à 0,0)
  const matrix = [{ scale: transform.scale }];

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize}]}>
      <Canvas style={{ flex: 1 }}>
        <Group transform={matrix}>
          
          {/* A. IMAGE DE FOND */}
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={NATIVE_SIZE} height={NATIVE_SIZE}
                fit="cover"
              />
          )}

          {/* B. TEST VISUEL : CADRE BLEU (Limites du dessin) */}
          {/* Si tu ne vois pas ce cadre bleu, c'est que le canvas est hors-champ */}
          {transparentMode && (
              <Rect x={0} y={0} width={NATIVE_SIZE} height={NATIVE_SIZE} style="stroke" strokeWidth={20} color="blue" />
          )}

          {/* C. TEST VISUEL : DIAGONALE ROUGE (Test du moteur) */}
          {transparentMode && (
              <Path path={`M 0 0 L ${NATIVE_SIZE} ${NATIVE_SIZE}`} style="stroke" strokeWidth={20} color="red" />
          )}
          
          {/* D. TES DESSINS (EN VERT) */}
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!p || !p.svgPath) return null;
             const path = Skia.Path.MakeFromSVGString(p.svgPath);
             if (!path) return null;
             
             // On force une grosse épaisseur pour le test
             const debugWidth = 50; 
             
             return (
               <Path
                 key={index}
                 path={path}
                 // FORCE EN VERT POUR LE TEST
                 color={p.isEraser ? "#000000" : "#00FF00"} 
                 style="stroke"
                 strokeWidth={debugWidth} 
                 strokeCap="round"
                 strokeJoin="round"
                 blendMode={p.isEraser ? "clear" : "srcOver"}
               />
             );
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