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
  
  const image = useImage(imageUri || ""); 

  // 1. Parsing des données
  const safePaths = useMemo(() => {
    let data = [];
    if (Array.isArray(canvasData)) {
        data = canvasData;
    } else if (typeof canvasData === 'string') {
        try { data = JSON.parse(canvasData); } catch (e) { data = []; }
    }
    return data;
  }, [canvasData]);

  // 2. Calcul du Zoom (SIMPLIFIÉ : Zéro Centrage, juste Scale)
  const transform = useMemo(() => {
    // Si pas d'image, pas de transfo
    if (!image) return { scale: 1, translateX: 0, translateY: 0 };
    
    const CANVAS_SIZE = image.height(); // On se base sur la hauteur (référence du carré)
    if (CANVAS_SIZE === 0) return { scale: 1, translateX: 0, translateY: 0 };

    // Calcul simple : Combien de fois l'image native rentre dans l'écran ?
    const fitScale = viewerSize / CANVAS_SIZE;

    // On aligne tout à 0,0 (Coin haut gauche)
    // Comme on force le format carré partout, ça va s'aligner tout seul.
    return { 
        scale: fitScale, 
        translateX: 0, 
        translateY: 0 
    };
  }, [image, viewerSize]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }

  const CANVAS_SIZE = image.height(); // Taille native carré
  
  const matrix = [
      { translateX: transform.translateX },
      { translateY: transform.translateY },
      { scale: transform.scale }
  ];

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize}]}>
      <Canvas style={{ flex: 1 }}>
        <Group transform={matrix}>
          
          {/* IMAGE DE FOND */}
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={CANVAS_SIZE} height={CANVAS_SIZE} // On force le carré natif
                fit="cover"
              />
          )}
          
          {/* DESSINS */}
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!Skia || !Skia.Path) return null;
             if (!p || !p.svgPath || typeof p.svgPath !== 'string') return null;

             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 // Compensation de l'épaisseur
                 const baseWidth = p.width || 6;
                 const adjustedWidth = baseWidth / transform.scale;
                 
                 return (
                   <Path
                     key={index}
                     path={path}
                     // On remet la vraie couleur du trait (ou noir si gomme)
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