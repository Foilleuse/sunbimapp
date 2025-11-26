import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, Text } from 'react-native';
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
  // On charge l'image, ou une image de fallback si vide
  const image = useImage(imageUri || "https://via.placeholder.com/1000"); 

  // 1. LOGS DE DONNÉES
  const safePaths = useMemo(() => {
    let data = [];
    if (Array.isArray(canvasData)) {
        data = canvasData;
    } else if (typeof canvasData === 'string') {
        try { data = JSON.parse(canvasData); } catch (e) { data = []; }
    }
    // DEBUG: Affiche la longueur
    console.log(`🔍 [VIEWER] Mode: ${transparentMode ? 'Transparent' : 'Image'} | Traits: ${data.length}`);
    return data;
  }, [canvasData, transparentMode]);

  const transform = useMemo(() => {
    if (!image) return { scale: 1, translateX: 0, translateY: 0 };
    
    const CANVAS_SIZE = image.height();
    if (CANVAS_SIZE === 0) return { scale: 1, translateX: 0, translateY: 0 };

    const fitScale = viewerSize / CANVAS_SIZE;
    const imgW = image.width ? image.width() : CANVAS_SIZE;
    const visualWidth = imgW * fitScale;
    const centerTx = (screenWidth - visualWidth) / 2;

    console.log(`📐 [SCALE] Native: ${CANVAS_SIZE} -> Screen: ${viewerSize} (Scale: ${fitScale})`);

    return { scale: fitScale, translateX: centerTx, translateY: 0 };
  }, [image, screenWidth, viewerSize]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize, borderColor: 'blue', borderWidth: 2}} />;
    return <View style={styles.loading}><ActivityIndicator color="red" size="large" /></View>;
  }

  const CANVAS_H = image.height();
  const CANVAS_W = image.width();
  
  const matrix = [
      { translateX: transform.translateX },
      { translateY: transform.translateY },
      { scale: transform.scale }
  ];

  return (
    // AJOUT D'UNE BORDURE ROUGE AUTOUR DU CANVAS POUR VÉRIFIER QU'IL PREND DE LA PLACE
    <View style={[styles.container, {width: viewerSize, height: viewerSize, borderColor: 'red', borderWidth: 2, zIndex: 999}]}>
      
      <Canvas style={{ flex: 1 }}>
        
        {/* TEST 1 : UNE CROIX ROUGE FORCEE (Doit apparaître par dessus tout) */}
        <Path path="M 0 0 L 500 500" color="red" style="stroke" strokeWidth={10} />
        <Path path="M 500 0 L 0 500" color="red" style="stroke" strokeWidth={10} />

        <Group transform={matrix}>
          
          {/* IMAGE */}
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={CANVAS_W} height={CANVAS_H}
                fit="cover"
              />
          )}
          
          {/* DESSINS SUPABASE */}
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!Skia || !Skia.Path) return null;
             if (!p || !p.svgPath || typeof p.svgPath !== 'string') return null;

             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 const baseWidth = p.width || 10;
                 // TEST 2 : ON FORCE UNE GROSSE ÉPAISSEUR POUR VOIR
                 const adjustedWidth = (baseWidth / transform.scale) * 2; 
                 
                 return (
                   <Path
                     key={index}
                     path={path}
                     color="#FFFF00" // JAUNE VIF
                     style="stroke"
                     strokeWidth={adjustedWidth} 
                     strokeCap="round"
                     strokeJoin="round"
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