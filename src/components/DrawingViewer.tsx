import React, { useMemo, useEffect } from 'react';
import { Canvas, Path, Skia, useValue, runTiming, Easing } from '@shopify/react-native-skia';
import { Image } from 'react-native';

interface DrawingViewerProps {
  imageUri?: string | null;
  canvasData: any[];
  viewerSize: number;
  transparentMode?: boolean;
  animated?: boolean;
  startVisible?: boolean;
  // NOUVELLE OPTION : Pour centrer et zoomer automatiquement le dessin
  autoCenterAndScale?: boolean;
}

export const DrawingViewer: React.FC<DrawingViewerProps> = ({
  imageUri,
  canvasData,
  viewerSize,
  transparentMode = false,
  animated = false,
  startVisible = true,
  autoCenterAndScale = false, // Par défaut désactivé (pour la galerie, le feed...)
}) => {
  // Valeur d'animation (de 0 à 1)
  const progress = useValue(startVisible ? 1 : 0);

  useEffect(() => {
    if (animated) {
      // Reset si on doit rejouer
      if (!startVisible) progress.current = 0;
        
      // Lancement de l'animation fluide
      runTiming(progress, 1, {
        duration: 2500, // Durée un peu plus longue pour apprécier le zoom
        easing: Easing.inOut(Easing.ease),
      });
    } else {
      // Si pas animé, on fixe la visibilité selon la prop
      progress.current = startVisible ? 1 : 0;
    }
  }, [animated, canvasData, startVisible]); // On relance si les données changent

  const paths = useMemo(() => {
    if (!canvasData || canvasData.length === 0) return [];

    // 1. CALCUL DU CENTRAGE ET DU ZOOM (Si demandé)
    let matrix = Skia.Matrix();
    if (autoCenterAndScale) {
        // Créer un chemin temporaire combinant TOUS les traits pour trouver les limites
        const combinedPath = Skia.Path.Make();
        canvasData.forEach(stroke => {
            const p = Skia.Path.MakeFromSVGString(stroke.path);
            if(p) combinedPath.addPath(p);
        });

        const bounds = combinedPath.getBounds();
        
        // Si le dessin existe et n'est pas minuscule
        if (bounds.width > 1 && bounds.height > 1) {
            const padding = 60; // Marge autour du dessin zoomé
            const availableSize = viewerSize - padding;
            
            // On calcule le facteur de zoom (on prend le côté le plus grand pour que tout rentre)
            const scale = availableSize / Math.max(bounds.width, bounds.height);

            // On calcule le décalage pour centrer
            const translateX = (viewerSize - bounds.width * scale) / 2 - bounds.x * scale;
            const translateY = (viewerSize - bounds.height * scale) / 2 - bounds.y * scale;

            // On crée la matrice de transformation
            matrix.translate(translateX, translateY);
            matrix.scale(scale, scale);
        }
    }

    // 2. CRÉATION DES CHEMINS SKIA (Avec application de la matrice)
    return canvasData.map((stroke) => {
      const path = Skia.Path.MakeFromSVGString(stroke.path);
      if (!path) return null;

      // Appliquer la transformation (zoom/centrage) si elle existe
      if (autoCenterAndScale) {
         path.transform(matrix);
      }

      return {
        path,
        color: stroke.color,
        width: stroke.width,
      };
    }).filter(p => p !== null) as any[];
  }, [canvasData, viewerSize, autoCenterAndScale]);

  if (!canvasData || canvasData.length === 0) {
    if (transparentMode) return null;
    return imageUri ? <Image source={{ uri: imageUri }} style={{ width: viewerSize, height: viewerSize }} /> : null;
  }

  return (
    <Canvas style={{ width: viewerSize, height: viewerSize }}>
      {/* Fond Image (si pas transparent) */}
      {!transparentMode && imageUri && (
        <Image image={Skia.Image.MakeImageFromEncoded(Skia.Data.fromUri(imageUri))} x={0} y={0} width={viewerSize} height={viewerSize} fit="cover" />
      )}
      
      {/* Traits du dessin */}
      {paths.map((stroke, index) => (
        <Path
          key={index}
          path={stroke.path}
          color={stroke.color}
          style="stroke"
          strokeWidth={stroke.width}
          strokeCap="round"
          strokeJoin="round"
          // L'animation coupe le tracé
          end={progress}
        />
      ))}
    </Canvas>
  );
};