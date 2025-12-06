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

  // 1. Vérification : Est-ce une URL Supabase Storage ?
  // Les URLs Supabase ressemblent généralement à :
  // https://[PROJECT_ID].supabase.co/storage/v1/object/public/[BUCKET]/[PATH]
  const isSupabaseUrl = url.includes('supabase.co') && url.includes('/storage/v1/object/');

  // Si ce n'est pas une image Supabase (ex: image externe, unsplash, etc.), on ne touche à rien.
  if (!isSupabaseUrl) {
    return url;
  }

  // 2. Vérification : L'URL a-t-elle déjà des paramètres ?
  const separator = url.includes('?') ? '&' : '?';

  // 3. Construction de l'URL transformée
  // Supabase Image Transformation utilise les paramètres 'width', 'height', 'quality', 'format'.
  // 'resize=contain' ou 'cover' est implicite si width/height sont fournis.
  // Note: On utilise `toFixed(0)` pour s'assurer que width est un entier (Supabase n'aime pas les décimales).
  return `${url}${separator}width=${width.toFixed(0)}&quality=${quality}&format=origin`;
};