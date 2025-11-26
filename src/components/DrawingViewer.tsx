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

  // 1. PARSING + DEBUG LOGS
  const safePaths = useMemo(() => {
    let data = [];
    
    // Décodage
    if (Array.isArray(canvasData)) {
        data = canvasData;
    } else if (typeof canvasData === 'string') {
        try { data = JSON.parse(canvasData); } catch (e) { data = []; }
    }

    // Log pour vérifier ce qu'on reçoit
    if (data.length > 0) {
        console.log(`🎨 DrawingViewer: Affichage de ${data.length} traits.`);
    } else {
        console.log("⚠️ DrawingViewer: Aucune donnée de dessin trouvée.");
    }

    return data;
  }, [canvasData]);

  const transform = useMemo(() => {
    if (!image) return { scale: 1, translateX: 0, translateY: 0 };
    
    const CANVAS_SIZE = image.height();
    if (CANVAS_SIZE === 0) return { scale: 1, translateX: 0, translateY: 0 };

    const fitScale = viewerSize / CANVAS_SIZE;
    const imgW = image.width ? image.width() : CANVAS_SIZE;
    const visualWidth = imgW * fitScale;
    const centerTx = (screenWidth - visualWidth) / 2;

    return { scale: fitScale, translateX: centerTx, translateY: 0 };
  }, [image, screenWidth, viewerSize]);

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
    <View style={[styles.container, {width: viewerSize, height: viewerSize}]}>
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
             if (!Skia || !Skia.Path) return null;
             if (!p || !p.svgPath || typeof p.svgPath !== 'string') return null;

             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 // --- CORRECTION MAJEURE ICI ---
                 // On utilise l'épaisseur brute stockée (car la matrice 'scale' va la réduire visuellement)
                 // Si on divise encore, ça fait l'inverse (traits énormes).
                 const width = p.width || 5; 
                 
                 return (
                   <Path
                     key={index}
                     path={path}
                     color={p.isEraser ? "#000000" : p.color}
                     style="stroke"
                     strokeWidth={width} // On utilise la largeur native directe
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