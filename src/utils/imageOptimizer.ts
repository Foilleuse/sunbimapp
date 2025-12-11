/**
 * Utilitaire pour optimiser les images stockées sur Supabase.
 */
export const getOptimizedImageUrl = (
  url: string | null | undefined,
  width: number,
  height?: number, // ✅ Paramètre optionnel
  quality: number = 75
): string | null => {
  if (!url) return null;

  const isSupabaseUrl = url.includes('supabase.co') || url.includes('supabase.in');
  if (!isSupabaseUrl) return url;

  // Sécurité : URLs publiques uniquement
  if (!url.includes('/storage/v1/object/public/')) {
       return url;
  }

  // --- Bucketing Largeur ---
  let targetWidth = width;
  if (width <= 100) targetWidth = 100;
  else if (width <= 200) targetWidth = 200;
  else if (width <= 400) targetWidth = 400;
  else if (width <= 800) targetWidth = 800;
  else if (width <= 1200) targetWidth = 1200;
  else targetWidth = 1600;

  // --- Gestion Intelligente de la Hauteur ---
  let params = `width=${targetWidth}&quality=${quality}&format=origin`;

  if (height) {
    // 🔥 Si une hauteur est demandée (ex: Grille 3:4), on l'adapte au bucketing
    // pour que le ratio d'image reste exactement celui demandé.
    const ratio = height / width;
    const targetHeight = Math.round(targetWidth * ratio);
    
    // On active le crop strict (cover) car on a des dimensions précises
    params += `&height=${targetHeight}&resize=cover`;
  } 
  // SINON (Pas de height) : Supabase garde le ratio d'origine (Avatars, FullScreen...)

  // Changement d'endpoint
  let optimizedUrl = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );

  const separator = optimizedUrl.includes('?') ? '&' : '?';

  return `${optimizedUrl}${separator}${params}`;
};