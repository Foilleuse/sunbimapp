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

  // 1. Vérification : Est-ce une URL Supabase ?
  const isSupabaseUrl = url.includes('supabase.co') || url.includes('supabase.in');

  if (!isSupabaseUrl) {
    return url;
  }

  // 2. Vérification : Est-ce une image gérée par le Storage ?
  if (!url.includes('/storage/v1/object/')) {
       return url;
  }

  // --- AMÉLIORATION : Standardisation des tailles (Bucketing) ---
  // Pour maximiser le cache CDN, on arrondit la largeur demandée à des paliers fixes.
  // Paliers : 100, 200, 400, 800, 1200, 1600...
  let targetWidth = width;
  if (width <= 100) targetWidth = 100;
  else if (width <= 200) targetWidth = 200;
  else if (width <= 400) targetWidth = 400;
  else if (width <= 800) targetWidth = 800;
  else if (width <= 1200) targetWidth = 1200;
  else targetWidth = 1600; // Max standard

  // 3. Gestion des paramètres existants
  const separator = url.includes('?') ? '&' : '?';

  // 4. Construction de l'URL transformée
  // On ajoute &format=origin pour garder le format source (plus rapide que la conversion à la volée parfois)
  const optimizedUrl = `${url}${separator}width=${targetWidth}&quality=${quality}&format=origin&resize=cover`;

  // Log pour débogage (Visible dans le terminal Metro/Expo)
  // console.log(`⚡ [ImageOptimizer] ${width}px -> ${targetWidth}px :`, optimizedUrl);

  return optimizedUrl;
};