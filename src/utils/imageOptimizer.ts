import { Dimensions, PixelRatio } from 'react-native';

// Utilitaire pour l'optimisation des images Supabase
// Transforme une URL de stockage brute en URL optimisée via le render server
export const getOptimizedImageUrl = (url: string | null, width?: number, quality = 80): string | null => {
  if (!url) return null;

  // Si ce n'est pas une URL Supabase, on la retourne telle quelle
  if (!url.includes('supabase.co/storage')) {
      return url;
  }

  // Si c'est déjà une URL transformée ou avec des paramètres, on ne touche pas pour éviter les conflits
  if (url.includes('?')) {
      return url;
  }

  // Calcul de la largeur cible
  // Si width n'est pas fourni, on prend une valeur par défaut (largeur écran / 2 pour être safe)
  const screenWidth = Dimensions.get('window').width;
  const targetWidth = width ? width * PixelRatio.get() : screenWidth * PixelRatio.get();
  
  // On arrondit à une valeur "standard" (multiples de 100) pour maximiser le cache CDN
  const optimizedWidth = Math.ceil(targetWidth / 100) * 100;

  // Construction de l'URL transformée
  // On ajoute les query params standards de Supabase Image Transformations
  return `${url}?width=${optimizedWidth}&quality=${quality}&format=origin`;
};