/**
 * Utilitaire pour optimiser les images stockées sur Supabase.
 * Documentation : https://supabase.com/docs/guides/storage/image-transformations
 */

export const getOptimizedImageUrl = (
  url: string | null | undefined,
  width: number,
  quality: number = 75
): string | null => {
  if (!url) return null;

  // 1. Vérification : URL Supabase
  const isSupabaseUrl = url.includes('supabase.co') || url.includes('supabase.in');
  if (!isSupabaseUrl) return url;

  // 2. SÉCURITÉ : On ne touche pas aux URLs privées/signées
  if (!url.includes('/storage/v1/object/public/')) {
       return url;
  }

  // --- Bucketing : Standardisation des tailles ---
  let targetWidth = width;
  if (width <= 100) targetWidth = 100;
  else if (width <= 200) targetWidth = 200;
  else if (width <= 400) targetWidth = 400;
  else if (width <= 800) targetWidth = 800;
  else if (width <= 1200) targetWidth = 1200;
  else targetWidth = 1600;

  // 3. CORRECTION : Passage sur l'API de transformation
  // On remplace le chemin statique par le chemin de rendu dynamique
  let optimizedUrl = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );

  const separator = optimizedUrl.includes('?') ? '&' : '?';

  // 🔥 CORRECTIONS FINALES :
  // 1. format=origin : On le remet pour garder la transparence (PNG) de vos nuages.
  // 2. SUPPRESSION de resize=cover : On laisse Supabase calculer la hauteur automatiquement
  //    pour conserver le ratio exact de l'image originale. Plus de crop serveur.
  optimizedUrl = `${optimizedUrl}${separator}width=${targetWidth}&quality=${quality}&format=origin`;

  return optimizedUrl;
};