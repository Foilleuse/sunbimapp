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
  // Protection contre URI vide
  const image = useImage(imageUri || "https://via.placeholder.com/1000"); 

  // 1. Parsing
  const safePaths = useMemo(() => {
    let data = [];
    if (Array.isArray(canvasData)) data = canvasData;
    else if (typeof canvasData === 'string') {
        try { data = JSON.parse(canvasData); } catch (e) { data = []; }
    }
    return data;
  }, [canvasData]);

  // 2. Calcul du Zoom (Scale)
  const transform = useMemo(() => {
    // Valeur par défaut safe
    if (!image) return { scale: 1, translateX: 0, translateY: 0 };
    
    // On utilise la hauteur native comme référence du carré
    const NATIVE_SIZE = image.height(); 
    if (NATIVE_SIZE === 0) return { scale: 1, translateX: 0, translateY: 0 };

    const fitScale = viewerSize / NATIVE_SIZE;
    
    // On centre l'image si elle est plus large que haute
    const imgW = image.width ? image.width() : NATIVE_SIZE;
    const visualWidth = imgW * fitScale;
    const centerTx = (viewerSize - visualWidth) / 2;

    // Log pour comprendre l'échelle
    // console.log(`📐 Scale: ${fitScale} (Native: ${NATIVE_SIZE} -> View: ${viewerSize})`);

    return { scale: fitScale, translateX: centerTx, translateY: 0 };
  }, [image, viewerSize]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }

  const CANVAS_H = image.height();
  const CANVAS_W = image.width();
  
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
                width={CANVAS_W} height={CANVAS_H}
                fit="cover"
              />
          )}
          
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!p || !p.svgPath) return null;

             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 // --- CORRECTION ÉPAISSEUR ---
                 // On récupère la largeur enregistrée ou on met 15 par défaut
                 const recordedWidth = typeof p.width === 'number' ? p.width : 15;
                 
                 // On divise par le scale pour compenser le rétrécissement de l'image
                 // Ex: Si l'image est réduite x0.1, on multiplie le trait par 10 pour qu'il garde sa taille visuelle.
                 const adjustedWidth = recordedWidth / transform.scale;
                 
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