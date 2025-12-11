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

  // 2. SÉCURITÉ : Vérification stricte
  // On ne touche PAS aux URLs signées ou privées pour ne pas casser les tokens.
  if (!url.includes('/storage/v1/object/public/')) {
       return url;
  }

  // --- Bucketing : Standardisation des tailles ---
  // Permet de maximiser le cache CDN
  let targetWidth = width;
  if (width <= 100) targetWidth = 100;
  else if (width <= 200) targetWidth = 200;
  else if (width <= 400) targetWidth = 400;
  else if (width <= 800) targetWidth = 800;
  else if (width <= 1200) targetWidth = 1200;
  else targetWidth = 1600;

  // 3. CORRECTION TECHNIQUE : Changement d'endpoint
  // C'est le seul changement nécessaire pour que l'optimisation fonctionne.
  // On remplace le chemin statique par le chemin de transformation dynamique.
  let optimizedUrl = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );

  // 4. Construction de l'URL
  const separator = optimizedUrl.includes('?') ? '&' : '?';

  // 🔥 RESTAURATION DES PARAMÈTRES D'ORIGINE
  // - format=origin : INDISPENSABLE pour garder la transparence (PNG reste PNG).
  // - resize=cover  : Coupe l'image proprement pour remplir la largeur demandée.
  optimizedUrl = `${optimizedUrl}${separator}width=${targetWidth}&quality=${quality}&format=origin&resize=cover`;

  return optimizedUrl;
};