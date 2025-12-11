import { PixelRatio } from 'react-native';

/**
 * Utilitaire pour optimiser les images stockées sur Supabase.
 * Documentation : https://supabase.com/docs/guides/storage/image-transformations
 */
export const getOptimizedImageUrl = (
  url: string | null | undefined,
  width: number,
  height?: number, // ✅ Paramètre optionnel : S'il est présent, on active le CROP.
  quality: number = 75
): string | null => {
  if (!url) return null;

  // 1. Vérification : URL Supabase standard
  const isSupabaseUrl = url.includes('supabase.co') || url.includes('supabase.in');
  if (!isSupabaseUrl) return url;

  // 2. Sécurité : On ne transforme que les URLs publiques
  if (!url.includes('/storage/v1/object/public/')) {
       return url;
  }

  // --- Bucketing : On standardise la largeur pour le cache CDN ---
  let targetWidth = width;
  if (width <= 100) targetWidth = 100;
  else if (width <= 200) targetWidth = 200;
  else if (width <= 400) targetWidth = 400;
  else if (width <= 800) targetWidth = 800;
  else if (width <= 1200) targetWidth = 1200;
  else targetWidth = 1600;

  let params = `width=${targetWidth}&quality=${quality}&format=origin`;

  // 3. LOGIQUE CONDITIONNELLE (Le cœur du fix)
  if (height) {
    // 🔥 CAS A : HAUTEUR FOURNIE (Galerie)
    // On veut forcer un ratio précis (ex: 3:4).
    // On calcule la hauteur cible proportionnelle au bucket de largeur.
    const ratio = height / width;
    const targetHeight = Math.round(targetWidth * ratio);
    
    // "resize=cover" est l'instruction qui dit au serveur : 
    // "Coupe tout ce qui dépasse pour remplir exactement cette boîte".
    params += `&height=${targetHeight}&resize=cover`;
  } 
  // 🧊 CAS B : PAS DE HAUTEUR (Avatars, Plein écran)
  // On ne met PAS "resize=cover". Supabase va juste réduire la taille du fichier
  // tout en gardant l'image entière (pas de têtes coupées).

  // 4. Remplacement de l'endpoint vers le moteur de rendu
  let optimizedUrl = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );

  const separator = optimizedUrl.includes('?') ? '&' : '?';

  return `${optimizedUrl}${separator}${params}`;
};