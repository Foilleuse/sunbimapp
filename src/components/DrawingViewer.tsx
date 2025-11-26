import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Canvas, Path, Image as SkiaImage, useImage, Group, Skia } from '@shopify/react-native-skia';

interface DrawingViewerProps {
  imageUri: string;
  canvasData: any; 
  viewerSize: number; // La taille du carré à l'écran (ex: 390px)
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
    if (Array.isArray(canvasData)) data = canvasData;
    else if (typeof canvasData === 'string') {
        try { data = JSON.parse(canvasData); } catch (e) { data = []; }
    }
    return data;
  }, [canvasData]);

  // 2. Calcul du Zoom (Miroir exact du Créateur)
  const transform = useMemo(() => {
    if (!image) return { scale: 1, translateX: 0, translateY: 0 };
    
    // IMPORTANT : On reprend la logique "Carré basé sur la Hauteur" du créateur
    const NATIVE_SQUARE_SIZE = image.height(); 
    if (NATIVE_SQUARE_SIZE === 0) return { scale: 1, translateX: 0, translateY: 0 };

    // On calcule le ratio pour faire rentrer ce carré géant dans le petit carré du viewer
    const fitScale = viewerSize / NATIVE_SQUARE_SIZE;

    // Pas besoin de centrage complexe ici car :
    // Carré Natif (4000x4000) * Scale => Carré Viewer (390x390)
    // Ça rentre pile poil.
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

  // On force les dimensions natives à être un CARRÉ basé sur la hauteur
  // C'est ce qui garantit que l'image est croppée exactement comme au moment du dessin.
  const DISPLAY_SIZE = image.height();
  
  const matrix = [
      { translateX: transform.translateX },
      { translateY: transform.translateY },
      { scale: transform.scale }
  ];

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        <Group transform={matrix}>
          
          {/* IMAGE DE FOND */}
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={DISPLAY_SIZE} height={DISPLAY_SIZE} // <--- FORCE LE CARRÉ
                fit="cover" // Rogne les bords qui dépassent, comme à la création
              />
          )}
          
          {/* DESSINS */}
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!p || !p.svgPath) return null;

             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 // Compensation épaisseur
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