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

  // 1. Vérification Assouplie : On vérifie juste si c'est une URL de stockage d'objets
  // On retire le check 'supabase.co' qui peut échouer selon les régions (ex: .in, .net) ou domaines personnalisés.
  const isStorageUrl = url.includes('/storage/v1/object/');

  // Si ce n'est pas une image gérée par le storage (ex: image externe, unsplash), on ne touche à rien.
  if (!isStorageUrl) {
    // console.log("⚠️ Image externe non optimisée :", url);
    return url;
  }

  // 2. Vérification : L'URL a-t-elle déjà des paramètres ?
  const separator = url.includes('?') ? '&' : '?';

  // 3. Construction de l'URL transformée
  // On force des dimensions entières avec toFixed(0) car Supabase n'accepte pas les décimales
  const optimizedUrl = `${url}${separator}width=${width.toFixed(0)}&quality=${quality}&format=origin`;

  // Log pour débogage (à retirer en prod si trop verbeux)
  // console.log(`⚡ Optimisation Supabase : ${width}px | ${url.split('/').pop()}`);

  return optimizedUrl;
};