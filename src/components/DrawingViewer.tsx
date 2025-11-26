import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Canvas, Path, Image as SkiaImage, useImage, Group, Skia, rect } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';

interface DrawingViewerProps {
  imageUri: string;
  canvasData: any; 
  viewerSize: number;
  transparentMode?: boolean;
  animated?: boolean;
  startVisible?: boolean;
  autoCenter?: boolean; // <--- L'INTERRUPTEUR MAGIQUE
}

export const DrawingViewer: React.FC<DrawingViewerProps> = ({ 
  imageUri, 
  canvasData, 
  viewerSize, 
  transparentMode = false,
  animated = false,
  startVisible = true,
  autoCenter = false // Par défaut : NON (pour protéger le Feed/Galerie)
}) => {
  
  const { width: screenWidth } = Dimensions.get('window');
  const image = useImage(imageUri || "https://via.placeholder.com/1000"); 

  // --- ANIMATION ---
  const progress = useSharedValue(startVisible ? 1 : 0);

  useEffect(() => {
    if (animated) {
        progress.value = 0;
        progress.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) });
    } else if (!startVisible) {
        progress.value = 0; 
    } else {
        progress.value = 1;
    }
  }, [animated, startVisible, imageUri]);

  // 1. Parsing
  const safePaths = useMemo(() => {
    let data = [];
    if (Array.isArray(canvasData)) data = canvasData;
    else if (typeof canvasData === 'string') {
        try { data = JSON.parse(canvasData); } catch (e) { data = []; }
    }
    return data;
  }, [canvasData]);

  // 2. Calcul de la Matrice (C'est là que tout se joue)
  const matrix = useMemo(() => {
      const m = Skia.Matrix();
      
      if (!image) return m;
      const NATIVE_SIZE = image.height();
      if (NATIVE_SIZE === 0) return m;

      // Échelle de base (Cadrage Image normal)
      const baseScale = viewerSize / NATIVE_SIZE;

      // --- CAS SPÉCIAL : ANIMATION CENTRÉE (Seulement si demandé) ---
      if (autoCenter && safePaths.length > 0) {
          try {
              // On crée un chemin virtuel qui combine tous les traits pour trouver les limites
              const combinedPath = Skia.Path.Make();
              let valid = false;
              safePaths.forEach(p => {
                  if (p.svgPath) {
                      const path = Skia.Path.MakeFromSVGString(p.svgPath);
                      if (path) { combinedPath.addPath(path); valid = true; }
                  }
              });

              if (valid) {
                  const bounds = combinedPath.getBounds();
                  // Sécurité : On ne zoome que si le dessin a une taille réelle (> 10px)
                  if (bounds.width > 10 && bounds.height > 10) {
                      const padding = 40; // Marge pour faire joli
                      const targetSize = viewerSize - padding;
                      
                      // On calcule le zoom pour que le DESSIN (pas l'image) remplisse l'écran
                      const scaleX = targetSize / bounds.width;
                      const scaleY = targetSize / bounds.height;
                      const focusScale = Math.min(scaleX, scaleY, 3); // Max zoom x3 pour pas pixeliser

                      // On centre le dessin
                      const translateX = (viewerSize - bounds.width * focusScale) / 2 - bounds.x * focusScale;
                      const translateY = (viewerSize - bounds.height * focusScale) / 2 - bounds.y * focusScale;

                      m.translate(translateX, translateY);
                      m.scale(focusScale, focusScale);
                      return m; // ON RENVOIE LA MATRICE CENTRÉE
                  }
              }
          } catch (e) { console.log("Erreur AutoCenter", e); }
      }

      // --- CAS STANDARD : CADRAGE NUAGE (Feed / Galerie) ---
      // On aligne strictement sur l'image native
      // Calcul du décalage pour centrer l'image si elle est rectangulaire
      const NATIVE_W = image.width();
      const offsetX = (NATIVE_W - NATIVE_SIZE) / 2;
      
      // On applique : Scale d'abord, puis translation pour recaler
      m.scale(baseScale, baseScale);
      // Pour compenser le décalage natif, on translate en coordonnées natives
      m.translate(-offsetX, 0);
      
      return m;

  }, [image, viewerSize, autoCenter, safePaths]);

  // --- RENDU ---
  if (!image) {
    if (transparentMode) return <View style={{width: viewerSize, height: viewerSize}} />;
    return <View style={styles.loading}><ActivityIndicator color="#fff" /></View>;
  }

  // Récupération du scale actuel pour l'épaisseur
  const currentScale = matrix.get()[0] || 1;
  const NATIVE_W = image.width();
  const NATIVE_H = image.height();

  return (
    <View style={[styles.container, {width: viewerSize, height: viewerSize, overflow: 'hidden'}]}>
      <Canvas style={{ flex: 1 }}>
        <Group matrix={matrix}>
          
          {/* IMAGE DE FOND */}
          {!transparentMode && (
              <SkiaImage
                image={image}
                x={0} y={0}
                width={NATIVE_W} height={NATIVE_H}
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