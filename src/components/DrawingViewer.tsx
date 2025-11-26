import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Canvas, Path, Image as SkiaImage, useImage, Group, Skia } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';

interface DrawingViewerProps {
  imageUri: string;
  canvasData: any; 
  viewerSize: number;
  transparentMode?: boolean;
  animated?: boolean;
  startVisible?: boolean;
  autoCenterAndScale?: boolean;
}

export const DrawingViewer: React.FC<DrawingViewerProps> = ({ 
  imageUri, 
  canvasData, 
  viewerSize, 
  transparentMode = false,
  animated = false,
  startVisible = true,
  autoCenterAndScale = false
}) => {
  
  // Image de fallback pour éviter tout crash de chargement
  const image = useImage(imageUri || "https://via.placeholder.com/1000"); 

  // --- MOTEUR D'ANIMATION ---
  const progress = useSharedValue(startVisible ? 1 : 0);

  useEffect(() => {
    if (animated) {
        progress.value = 0;
        progress.value = withTiming(1, { 
            duration: 2000, // 2 secondes pour bien voir le tracé
            easing: Easing.out(Easing.cubic) 
        });
    } else if (!startVisible) {
        progress.value = 0; 
    } else {
        progress.value = 1;
    }
  }, [animated, startVisible]);

  // --- 1. PARSING DES DONNÉES ---
  const safePaths = useMemo(() => {
    let data = [];
    if (Array.isArray(canvasData)) data = canvasData;
    else if (typeof canvasData === 'string') {
        try { data = JSON.parse(canvasData); } catch (e) { data = []; }
    }
    return data;
  }, [canvasData]);

  // --- 2. CALCUL DE LA MATRICE DE TRANSFORMATION (ZOOM/CENTRAGE) ---
  const matrix = useMemo(() => {
      // Matrice par défaut (Identité)
      const m = Skia.Matrix();
      
      // Si pas d'image ou pas de dessin, on renvoie juste l'échelle de base
      if (!image) return m;
      const NATIVE_SIZE = image.height();
      if (NATIVE_SIZE === 0) return m;

      // Échelle de base pour remplir l'écran (Fit Cover)
      const baseScale = viewerSize / NATIVE_SIZE;
      
      // CAS A : CENTRAGE AUTOMATIQUE SUR LE DESSIN (Cinématique)
      if (autoCenterAndScale && safePaths.length > 0) {
          try {
              // On calcule la boîte englobante de tout le dessin
              const combinedPath = Skia.Path.Make();
              let hasValidPaths = false;
              
              safePaths.forEach(p => {
                  if (p.svgPath) {
                      const path = Skia.Path.MakeFromSVGString(p.svgPath);
                      if (path) {
                          combinedPath.addPath(path);
                          hasValidPaths = true;
                      }
                  }
              });

              if (hasValidPaths) {
                  const bounds = combinedPath.getBounds();
                  const maxDim = Math.max(bounds.width, bounds.height);

                  // 🛡️ SÉCURITÉ ANTI-CRASH (Division par zéro)
                  // Si le dessin est plus petit que 10 pixels, on ne zoome pas (c'est un point)
                  if (maxDim > 10) {
                      const padding = 40; // Marge autour du dessin
                      const targetSize = viewerSize - padding;
                      
                      // On calcule le zoom nécessaire pour que le dessin remplisse l'écran
                      const focusScale = targetSize / maxDim;
                      
                      // On limite le zoom max à x3 pour ne pas pixeliser ou exploser
                      const finalScale = Math.min(focusScale, baseScale * 3);

                      // On centre le dessin
                      const translateX = (viewerSize - bounds.width * finalScale) / 2 - bounds.x * finalScale;
                      const translateY = (viewerSize - bounds.height * finalScale) / 2 - bounds.y * finalScale;

                      m.translate(translateX, translateY);
                      m.scale(finalScale, finalScale);
                      return m;
                  }
              }
          } catch (e) {
              console.log("Erreur calcul auto-center", e);
              // Si erreur, on continue vers le cas par défaut
          }
      }

      // CAS B : AFFICHAGE NORMAL (Centré sur le nuage)
      // On centre l'image native dans le viewer
      const NATIVE_W = image.width();
      const offsetX = (NATIVE_W - NATIVE_SIZE) / 2; // Centrage horizontal
      
      m.scale(baseScale, baseScale);
      m.translate(-offsetX, 0); // On décale l'origine avant le scale? Non, après.
      // Skia Matrix order: Translate then Scale usually works best via dedicated methods
      // Reset pour faire propre :
      m.identity();
      m.scale(baseScale, baseScale);
      m.translate(-offsetX, 0);
      
      return m;

  }, [image, viewerSize, autoCenterAndScale, safePaths]);

  // --- 3. RENDU ---

  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }
  
  // Pour récupérer le facteur de zoom actuel (pour l'épaisseur du trait)
  // On approxime en prenant la valeur de l'échelle X de la matrice
  // array[0] est scaleX dans une matrice 3x3 standard
  const currentScale = matrix.get()[0] || 1;

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        <Group matrix={matrix}>
          
          {/* IMAGE DE FOND */}
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={image.width()} height={image.height()}
                fit="none"
              />
          )}
          
          {/* DESSINS */}
          <Group layer={true}> 
          {safePaths.map((p: any, index: number) => {
             if (!p || !p.svgPath) return null;

             try {
                 const path = Skia.Path.MakeFromSVGString(p.svgPath);
                 if (!path) return null;
                 
                 // ÉPAISSEUR ADAPTÉE
                 // On divise par le scale actuel de la matrice pour garder une épaisseur constante
                 const baseWidth = p.width || 6;
                 const adjustedWidth = (baseWidth / currentScale) * 0.65; 
                 
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
                     start={0}
                     end={progress} 
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