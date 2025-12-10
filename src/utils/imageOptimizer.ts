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

  // 1. Vérification : Est-ce une URL qui peut être optimisée ?
  // On vérifie si c'est une URL Supabase.
  // Note: On peut aussi vérifier le domaine spécifique de votre projet si besoin.
  const isSupabaseUrl = url.includes('supabase.co');

  // Si ce n'est pas une image Supabase, on la retourne telle quelle.
  if (!isSupabaseUrl) {
    return url;
  }

  // 2. Gestion des URLs qui ont déjà des paramètres (ex: ?t=...)
  const separator = url.includes('?') ? '&' : '?';

  // 3. Construction de l'URL transformée
  // Supabase Image Transformation utilise les paramètres 'width', 'height', 'quality', 'format'.
  // On utilise `toFixed(0)` pour s'assurer que width est un entier.
  // On ajoute `resize=contain` pour s'assurer que l'image tient dans les dimensions demandées sans être rognée si le ratio est différent,
  // ou `resize=cover` si vous voulez remplir le carré (plus fréquent pour des miniatures). Ici on laisse par défaut (souvent 'cover').
  const optimizedUrl = `${url}${separator}width=${width.toFixed(0)}&quality=${quality}&format=origin`;

  // Log pour débogage : permet de voir dans la console si l'URL est bien transformée
  // console.log(`⚡ Optimisation Image : ${url} -> ${optimizedUrl}`);

  return optimizedUrl;
};