# Sunbim - Application de Dessin sur Nuage

Application mobile créée avec Expo + React Native permettant de dessiner sur un nuage du jour.

## 🎯 Version 1 - Fonctionnalités

- Affichage d'un nuage (image placeholder de Pexels)
- Dessin avec React Native Skia :
  - 4 couleurs (noir, rouge, bleu, vert)
  - Gomme
  - Effacement complet
  - Sauvegarde locale (AsyncStorage)

## 🏗️ Architecture Complète (Prête pour le Futur)

### Structure des Dossiers

```
sunbim/
├── app/
│   ├── _layout.tsx              # Navigation principale avec hooks
│   └── +not-found.tsx
├── src/
│   ├── components/
│   │   └── DrawingCanvas.tsx    # Canvas Skia avec dessin
│   ├── screens/
│   │   └── HomeScreen.tsx       # Écran principal V1
│   ├── navigation/
│   │   └── RootNavigator.tsx    # Stack Navigator prêt à étendre
│   ├── hooks/
│   │   ├── useCameraPermission.ts
│   │   └── useNotificationsSetup.ts
│   ├── lib/
│   │   └── supabaseClient.ts    # Client Supabase configuré
│   └── theme/
│       └── colors.ts            # Système de couleurs
├── assets/
│   ├── cloud-placeholder.jpg
│   └── images/
├── app.config.ts                # Configuration complète des permissions
├── eas.json                     # Configuration EAS Build
└── package.json

```

### Modules Installés

**Dessin & UI:**
- `@shopify/react-native-skia` - Canvas de dessin haute performance
- `lucide-react-native` - Icônes

**Navigation:**
- `@react-navigation/native`
- `@react-navigation/native-stack`
- `@react-navigation/bottom-tabs`

**Backend & Storage:**
- `@supabase/supabase-js` - Client Supabase (prêt à utiliser)
- `@react-native-async-storage/async-storage` - Stockage local

**Permissions & Features:**
- `expo-camera` - Caméra (pour futures captures)
- `expo-notifications` - Notifications push (setup automatique)
- `expo-image-picker` - Sélection d'images
- `expo-file-system` - Système de fichiers
- `react-native-url-polyfill` - Support URL pour Supabase

## 🚀 Démarrage

### Développement Web

```bash
npm run dev
```

### Build Production

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

## 📱 Permissions Configurées

- **iOS** (`infoPlist`):
  - NSCameraUsageDescription
  - NSPhotoLibraryUsageDescription
  - NSPhotoLibraryAddUsageDescription

- **Android** (`permissions`):
  - CAMERA
  - READ_EXTERNAL_STORAGE
  - WRITE_EXTERNAL_STORAGE
  - POST_NOTIFICATIONS

## 🔐 Variables d'Environnement

Le fichier `.env` contient:

```env
EXPO_PUBLIC_SUPABASE_URL=https://...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

## 🎨 Utilisation du Canvas

Le composant `DrawingCanvas` utilise React Native Skia:

- **Props:**
  - `width`, `height` - Dimensions du canvas
  - `currentColor` - Couleur actuelle (black | red | blue | green)
  - `isEraser` - Mode gomme
  - `onClearCanvas` - Callback pour effacer

- **Interactions:**
  - Touch/Mouse pour dessiner
  - Historique des chemins sauvegardé
  - Export possible des chemins pour Supabase

## 🗄️ Sauvegarde Locale (V1)

Les dessins sont sauvegardés dans AsyncStorage:

```typescript
Key: drawing_[timestamp]
Value: {
  timestamp: string,
  paths: PathData[]
}
```

## 🔮 Évolutions Futures (V2+)

### Backend Supabase

Le client est déjà configuré dans `src/lib/supabaseClient.ts`.

**Tables suggérées:**

```sql
-- users (auth.users intégré)

-- daily_clouds
id, date, image_url, created_at

-- drawings
id, user_id, cloud_id, paths_data, created_at

-- notifications
id, user_id, scheduled_time, sent_at
```

### Fonctionnalités à Ajouter

1. **Capture de Nuages**
   - Utiliser `expo-camera` pour prendre une photo
   - Upload vers Supabase Storage
   - Créer entrée dans `daily_clouds`

2. **Synchronisation Cloud**
   - Remplacer AsyncStorage par Supabase
   - Sauvegarder les `paths` en JSON
   - Authentification utilisateur

3. **Notifications Quotidiennes**
   - Le hook `useNotificationsSetup` est déjà prêt
   - Programmer notification à 9h
   - Backend pour envoyer les push

4. **Navigation Étendue**
   - Tab bar avec Home / Gallery / Profile
   - Stack navigation pour détails
   - Modal pour paramètres

5. **Galerie de Dessins**
   - Liste des dessins passés
   - Partage social
   - Export en image

## 🛠️ Configuration EAS

Le fichier `eas.json` contient 3 profiles:

- **development**: Build de dev avec simulator
- **preview**: Preview interne
- **production**: Build pour les stores (App Store / Play Store)

## 📦 Build & Deploy

### Prérequis

1. Créer un compte Expo: https://expo.dev
2. Installer EAS CLI: `npm install -g eas-cli`
3. Login: `eas login`
4. Configurer le projet: `eas build:configure`

### Premier Build

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

### Submit aux Stores

Mettre à jour `eas.json` avec vos identifiants Apple/Google, puis:

```bash
eas submit --platform ios
eas submit --platform android
```

## 🎯 Points d'Attention

1. **Pas de TODO** - Tout le code est fonctionnel
2. **Architecture extensible** - Prête pour nouvelles features
3. **Permissions complètes** - Pas de rebuild nécessaire
4. **Supabase ready** - Client configuré, à utiliser quand prêt
5. **Hooks préparés** - Camera et notifications déjà setup

## 📝 Notes Techniques

- **Platform**: Web par défaut (mobile à tester avec dev build)
- **Router**: Expo Router avec Stack Navigation
- **Styling**: StyleSheet.create (pas de NativeWind)
- **State**: React hooks (pas de Redux pour V1)
- **Storage**: AsyncStorage (V1), Supabase (V2+)

## 🐛 Debugging

```bash
# Logs
npx expo start --clear

# Reset cache
rm -rf node_modules .expo
npm install
```

## 📄 License

Projet privé - Tous droits réservés
