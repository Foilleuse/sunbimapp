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
  // Protection : Si pas d'URI, on ne tente même pas de charger
  const image = useImage(imageUri || ""); 

  // 1. PARSING SÉCURISÉ (Anti-Crash JSON)
  const safePaths = useMemo(() => {
    if (!canvasData) return [];
    if (Array.isArray(canvasData)) return canvasData;
    
    // Si c'est une string JSON, on essaie de la parser
    if (typeof canvasData === 'string') {
        try {
            const parsed = JSON.parse(canvasData);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return []; // Donnée poubelle -> on renvoie vide
        }
    }
    return [];
  }, [canvasData]);

  const transform = useMemo(() => {
    if (!image) return { scale: 1, translateX: 0, translateY: 0 };
    
    const CANVAS_SIZE = image.height();
    if (CANVAS_SIZE === 0) return { scale: 1, translateX: 0, translateY: 0 };

    const fitScale = viewerSize / CANVAS_SIZE;
    // On utilise width() si dispo, sinon on suppose carré
    const imgW = image.width ? image.width() : CANVAS_SIZE;
    const visualWidth = imgW * fitScale;
    
    const centerTx = (screenWidth - visualWidth) / 2;

    return { scale: fitScale, translateX: centerTx, translateY: 0 };
  }, [image, screenWidth, viewerSize]);

  // Affichage du loader si l'image n'est pas prête
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
          
          {/* IMAGE (Masquée en mode transparent) */}
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={CANVAS_W} height={CANVAS_H}
                fit="cover"
              />
          )}
          
          {/* DESSINS (Avec Protection Anti-Crash par trait) */}
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             
             // --- LE BOUCLIER ANTI-CRASH ---
             // 1. Vérifier que Skia est chargé
             if (!Skia || !Skia.Path) return null;

             // 2. Vérifier que la donnée du trait est valide
             if (!p || !p.svgPath || typeof p.svgPath !== 'string') {
                 return null; // On saute silencieusement ce trait pourri
             }

             // 3. Tenter de créer le chemin (Try/Catch ultime)
             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 const adjustedWidth = p.width / transform.scale;
                 
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
             } catch (e) {
                 return null; // Si Skia n'aime pas le SVG, on saute
             }
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