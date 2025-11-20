# 🔧 Correction du Crash après Update OTA

## ❌ Problème

L'application se ferme automatiquement après le démarrage suite à une mise à jour OTA.

## 🔍 Causes Possibles

1. **Boucle infinie de reload** - L'app vérifie et reload à chaque démarrage
2. **Erreur non gérée** - Un crash silencieux qui ferme l'app
3. **Problème d'initialisation** - Supabase ou expo-updates plante au démarrage

## ✅ Corrections Appliquées

### 1. **ErrorBoundary** - Capture toutes les erreurs React

Nouveau composant `src/components/ErrorBoundary.tsx` :
- Capture toutes les erreurs non gérées
- Affiche l'erreur complète à l'écran (message + stack)
- Bouton "Réessayer" pour relancer
- **Important:** Permet de voir POURQUOI l'app crashe

### 2. **Protection anti-boucle** dans `app/_layout.tsx`

```typescript
const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

if (isCheckingUpdates) {
  console.log('⚠️ Sunbim OTA: Already checking for updates');
  return;
}
```

Empêche plusieurs vérifications simultanées qui pourraient causer une boucle.

### 3. **OTADebugPanel Résilient**

Le panneau OTA peut maintenant gérer les erreurs :
- Try-catch autour de `loadUpdateInfo()`
- Affiche un message d'erreur si expo-updates plante
- Ne bloque pas le reste de l'app en cas d'erreur

### 4. **Logs de Diagnostic Améliorés**

Ajout de :
```typescript
console.log('📱 Sunbim OTA: Is embedded launch:', Updates.isEmbeddedLaunch);
```

Permet de savoir si l'app tourne depuis le build ou depuis un OTA.

## 🧪 Comment Débugger

### Étape 1 : Vérifier les Logs

Quand l'app démarre, regardez la console pour voir les logs :

```
🔄 Sunbim OTA: Running update check on load
📱 Sunbim OTA: Runtime version: exposdk:54.0.0
📱 Sunbim OTA: Channel: sunbim
📱 Sunbim OTA: Update ID: xxx
📱 Sunbim OTA: Is embedded launch: false
```

Si vous ne voyez pas ces logs, l'app crash AVANT le check OTA.

### Étape 2 : ErrorBoundary Affichera l'Erreur

Si l'app crash maintenant, au lieu de se fermer, vous verrez un écran rouge avec :
- Le message d'erreur exact
- La stack trace complète
- Un bouton "Réessayer"

**Prenez un screenshot de cet écran !** Il contient toutes les infos nécessaires pour identifier le problème.

### Étape 3 : Causes Communes et Solutions

#### A. Erreur "Cannot read property 'from' of null"
**Solution:** Variables d'env Supabase manquantes dans le build OTA
```bash
# Republier avec les bonnes variables
eas update --branch sunbim --message "Fix env vars"
```

#### B. Boucle infinie de reload
**Symptôme:** L'app reload sans arrêt
**Solution:** Vérifier que `isCheckingUpdates` fonctionne correctement

#### C. Erreur dans expo-updates
**Symptôme:** Logs montrent "Error checking for updates"
**Solution:** Vérifier que la configuration OTA dans `app.config.ts` est correcte

## 📱 Test de la Correction

1. **Publier l'update OTA avec ces corrections:**
   ```bash
   npm run ota:publish "Fix crash with ErrorBoundary"
   ```

2. **Ouvrir l'app:**
   - Si elle crash, vous verrez maintenant l'écran d'erreur
   - Si elle fonctionne, le panneau OTA s'affichera normalement

3. **Vérifier le panneau OTA:**
   - "Updates Enabled" doit être ✅ YES
   - "Embedded Launch" vous indique si c'est un build ou un OTA

## 🎯 Résultat Attendu

Après ces corrections, l'une de ces deux choses se produira :

### Scénario A : L'app fonctionne
- Le panneau OTA s'affiche en haut
- Les logs apparaissent dans la console
- L'app charge le cloud du jour normalement

### Scénario B : L'app crashe mais affiche l'erreur
- Un écran rouge avec l'erreur s'affiche
- Vous pouvez lire exactement quel est le problème
- Prenez un screenshot et partagez-le pour une correction ciblée

## 🔴 Si l'App se Ferme Toujours Sans Message

Si l'app se ferme encore brutalement SANS afficher l'ErrorBoundary, cela signifie :

1. **Crash natif** (pas une erreur React)
   - Vérifier les logs natifs (Xcode/Logcat)
   - Peut être un problème avec expo-updates lui-même

2. **Variables d'environnement manquantes**
   - Les variables Supabase ne sont peut-être pas incluses dans l'OTA
   - Solution : Rebuild complet

3. **Configuration OTA incorrecte**
   - Runtime version ne match pas
   - Solution : Vérifier `app.config.ts` et rebuild

## 📁 Fichiers Modifiés

- ➕ `src/components/ErrorBoundary.tsx` - Nouveau composant
- ✏️ `app/_layout.tsx` - Protection anti-boucle + ErrorBoundary
- ✏️ `src/components/OTADebugPanel.tsx` - Gestion d'erreur améliorée

## 💡 Prochaines Étapes

1. Publier l'update OTA avec ces corrections
2. Ouvrir l'app et observer le comportement
3. Si erreur affichée, prendre un screenshot
4. Si l'app fonctionne, vérifier le panneau OTA

**L'ErrorBoundary est votre meilleur outil de diagnostic !**
