import { Dimensions, PixelRatio } from 'react-native';

// Récupération de l'URL de base du projet Supabase depuis l'URL de stockage
// Ex: https://xyz.supabase.co/storage/v1/object/public/...
// On veut transformer en : https://xyz.supabase.co/storage/v1/render/image/public/...
// OU utiliser le paramètre ?width=XXX&quality=YYY si le render server est configuré différemment.

// NOTE: Supabase Image Transformations nécessite que le bucket soit public et que la fonctionnalité soit active.
// La transformation standard se fait souvent via l'URL /render/image ou en ajoutant des query params selon le CDN.
// Pour Supabase Pro, l'URL ressemble souvent à : 
// https://<project_ref>.supabase.co/storage/v1/object/public/<bucket>/<file>?width=500&resize=cover

export const getOptimizedImageUrl = (url: string | null, width?: number, quality = 80): string | null => {
  if (!url) return null;

  // Si ce n'est pas une URL Supabase, on la retourne telle quelle
  if (!url.includes('supabase.co/storage')) {
      return url;
  }

  // Si c'est déjà une URL transformée ou locale, on ne touche pas
  if (url.includes('?')) {
      // On pourrait append les params, mais restons simples pour l'instant
      return url;
  }

  // Calcul de la largeur cible en tenant compte de la densité de pixels de l'écran
  // Si width n'est pas fourni, on prend une valeur par défaut raisonnable (ex: largeur écran / 2)
  const screenWidth = Dimensions.get('window').width;
  const targetWidth = width ? width * PixelRatio.get() : screenWidth * PixelRatio.get();
  
  // On arrondit à une valeur "standard" pour maximiser le cache CDN (ex: multiples de 100)
  const optimizedWidth = Math.ceil(targetWidth / 100) * 100;

  // Construction de l'URL transformée
  // Supabase Image Transformation utilise le endpoint /render/image pour les transformations à la volée
  // OU les query parameters standards 'width', 'height', 'resize', 'quality', 'format'
  
  // Méthode 1 : Query Params (Standard Supabase Storage Resizing)
  return `${url}?width=${optimizedWidth}&quality=${quality}&format=origin`;
};