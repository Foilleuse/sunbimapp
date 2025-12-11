export const getOptimizedImageUrl = (
  url: string | null | undefined,
  width: number,
  quality: number = 75
): string | null => {
  if (!url) return null;

  // 1. Vérification : URL Supabase
  const isSupabaseUrl = url.includes('supabase.co') || url.includes('supabase.in');
  if (!isSupabaseUrl) return url;

  // 2. SÉCURITÉ : Vérification stricte
  // On ne touche PAS aux URLs signées ou privées. Modifier leur URL casserait le token d'accès.
  // On ne transforme que si l'URL contient explicitement le chemin public standard.
  if (!url.includes('/storage/v1/object/public/')) {
    return url;
  }

  // --- Bucketing (Votre logique est bonne) ---
  let targetWidth = width;
  if (width <= 100) targetWidth = 100;
  else if (width <= 200) targetWidth = 200;
  else if (width <= 400) targetWidth = 400;
  else if (width <= 800) targetWidth = 800;
  else if (width <= 1200) targetWidth = 1200;
  else targetWidth = 1600;

  // 3. CORRECTION MAJEURE : Changement d'endpoint
  // On remplace le chemin statique par le chemin de transformation dynamique
  let optimizedUrl = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );

  // 4. Construction des paramètres
  const separator = optimizedUrl.includes('?') ? '&' : '?';

  // AMÉLIORATIONS :
  // - Retrait de format=origin : Laisse Supabase choisir WebP/AVIF (bien plus léger)
  // - Retrait de resize=cover : Inutile sans height, le resize proportionnel est le défaut
  optimizedUrl = `${optimizedUrl}${separator}width=${targetWidth}&quality=${quality}`;

  return optimizedUrl;
};