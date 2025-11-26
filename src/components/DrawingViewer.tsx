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

  // --- 1. PARSING ROBUSTE DES DONNÉES ---
  const safePaths = useMemo(() => {
    if (!canvasData) return [];
    
    // Cas 1 : C'est déjà un tableau d'objets (Supabase a bien fait le job)
    if (Array.isArray(canvasData)) return canvasData;
    
    // Cas 2 : C'est une chaine de caractères (String JSON)
    if (typeof canvasData === 'string') {
        try {
            // On tente de parser. Si c'est du JSON valide, ça devient un tableau.
            const parsed = JSON.parse(canvasData);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.warn("DrawingViewer: Impossible de parser le JSON", e);
            return [];
        }
    }
    
    // Cas 3 : Format inconnu
    return [];
  }, [canvasData]);

  const transform = useMemo(() => {
    if (!image) return { scale: 1, translateX: 0, translateY: 0 };
    
    const CANVAS_SIZE = image.height();
    if (CANVAS_SIZE === 0) return { scale: 1, translateX: 0, translateY: 0 };

    const fitScale = viewerSize / CANVAS_SIZE;
    // On utilise la largeur réelle si dispo, sinon on assume carré
    const imgW = image.width ? image.width() : CANVAS_SIZE;
    
    const visualWidth = imgW * fitScale;
    const centerTx = (screenWidth - visualWidth) / 2;

    return { scale: fitScale, translateX: centerTx, translateY: 0 };
  }, [image, screenWidth, viewerSize]);

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }

  const CANVAS_SIZE = image.height();
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
                width={CANVAS_W} height={CANVAS_SIZE}
                fit="cover"
              />
          )}
          
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             // Vérification de sécurité
             if (!p || !p.svgPath || typeof p.svgPath !== 'string') return null;

             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 // Calcul de l'épaisseur pour qu'elle soit visuellement identique à l'original
                 const adjustedWidth = p.width ? (p.width / transform.scale) : 2;
                 
                 return (
                   <Path
                     key={index}
                     path={path}
                     color={p.isEraser ? "#000000" : p.color}
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