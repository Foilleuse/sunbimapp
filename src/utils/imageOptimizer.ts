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
  // On accepte 'supabase.co' (cloud) et 'supabase.in' (certaines régions).
  const isSupabaseUrl = url.includes('supabase.co') || url.includes('supabase.in');

  // Si ce n'est pas une image Supabase, on la retourne telle quelle.
  if (!isSupabaseUrl) {
    return url;
  }

  // 2. Vérification : Est-ce une image gérée par le Storage ?
  // Les URLs publiques sont généralement de la forme : .../storage/v1/object/public/...
  // Les URLs signées sont de la forme : .../storage/v1/object/sign/...
  if (!url.includes('/storage/v1/object/')) {
       // Si l'URL ne semble pas pointer vers un objet, on ne touche pas.
       return url;
  }

  // 3. Gestion des paramètres existants
  // Si l'URL a déjà des paramètres (ex: token de signature), on ajoute avec '&', sinon avec '?'
  const separator = url.includes('?') ? '&' : '?';

  // 4. Construction de l'URL transformée
  // width: largeur cible (entier)
  // quality: compression (0-100)
  // format: 'origin' garde le format source (jpg, png...), 'avif' ou 'webp' est souvent mieux mais 'origin' est plus sûr.
  // resize: 'contain' (par défaut si omis) ou 'cover'. Pour des avatars/miniatures, 'cover' est souvent mieux pour remplir le cadre.
  const optimizedUrl = `${url}${separator}width=${width.toFixed(0)}&quality=${quality}&format=origin&resize=cover`;

  // Log pour débogage (Visible dans le terminal Metro/Expo, pas dans les logs système iOS)
  // console.log(`⚡ [ImageOptimizer] ${width}px :`, optimizedUrl);

  return optimizedUrl;
};