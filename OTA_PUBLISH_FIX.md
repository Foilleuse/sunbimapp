# 🔧 Correction Erreur EAS Update Export

## ❌ Erreur

```
export failed
/workspaces/sunbimapp/node_modules/expo/bin/cli export --output-dir dist --experimental-bundle --non-interactive --dump-sourcemap --dump-assetmap --platform=all exited with non-zero code: 7
Error: update command failed.
```

## 🔍 Cause

La commande `eas update` utilise en arrière-plan `expo export` avec le flag `--non-interactive` qui est déprécié dans les versions récentes d'Expo CLI.

## ✅ Solution Recommandée : Utiliser `eas-cli` Directement

### Option 1 : Via npx (Recommandé)

```bash
npx eas-cli update --branch sunbim --message "Votre message"
```

Le script dans package.json a été mis à jour :
```json
"ota:publish": "EXPO_NO_TELEMETRY=1 CI=1 npx eas-cli update --branch sunbim --message"
```

Usage :
```bash
npm run ota:publish "Fix crash with ErrorBoundary"
```

### Option 2 : Installer EAS CLI Globalement

Si vous voulez éviter `npx` à chaque fois :

```bash
npm install -g eas-cli
```

Puis utilisez directement :
```bash
eas update --branch sunbim --message "Votre message"
```

### Option 3 : Variables d'Environnement

Assurez-vous que les variables d'environnement sont définies :

```bash
export CI=1
export EXPO_NO_TELEMETRY=1
eas update --branch sunbim --message "Votre message"
```

## 🧪 Test de la Correction

Essayez cette commande dans votre terminal :

```bash
npm run ota:publish "Test correction crash"
```

Si ça fonctionne, vous devriez voir :
```
✔ Bundled successfully
✔ Exported successfully
✔ Published successfully
```

## 🔄 Workflow Complet pour Publier un OTA

1. **Assurez-vous d'être dans le bon répertoire**
   ```bash
   cd /workspaces/sunbimapp
   ```

2. **Vérifiez votre configuration**
   ```bash
   cat app.config.ts | grep -A 5 "updates:"
   ```
   Vous devriez voir :
   ```typescript
   updates: {
     enabled: true,
     checkAutomatically: 'ON_LOAD',
     fallbackToCacheTimeout: 0,
     url: 'https://u.expo.dev/6ac7da66-fe81-4d00-b064-035f9535e691'
   }
   ```

3. **Publiez l'update**
   ```bash
   npm run ota:publish "Fix crash with ErrorBoundary"
   ```

4. **Vérifiez sur le Dashboard Expo**
   - Allez sur https://expo.dev
   - Ouvrez votre projet
   - Onglet "Updates"
   - Vérifiez que le nouvel update apparaît sur le channel "sunbim"

## 🐛 Problèmes Potentiels

### "eas-cli not found"

**Solution :** Le script utilise `npx` qui téléchargera automatiquement `eas-cli` si nécessaire. Assurez-vous d'avoir une connexion internet.

### "No credentials found"

**Solution :** Connectez-vous à votre compte Expo :
```bash
npx eas-cli login
```

### "Project not configured for EAS"

**Solution :** Initialisez EAS :
```bash
npx eas-cli build:configure
```

### Export échoue avec "non-interactive"

**Solution :** C'est exactement le problème qu'on corrige ! Utilisez `npx eas-cli` au lieu de `eas`.

## 📋 Checklist Avant de Publier

- [ ] Toutes les modifications sont commitées (optionnel mais recommandé)
- [ ] Le fichier `app.config.ts` contient la section `updates`
- [ ] La `runtimeVersion` est `exposdk:54.0.0`
- [ ] Les corrections de crash sont incluses (ErrorBoundary, etc.)
- [ ] Le message de changelog est descriptif

## 🎯 Commande Finale

Pour publier vos corrections immédiatement :

```bash
npm run ota:publish "Fix crash with ErrorBoundary and improved error handling"
```

Cette commande va :
1. ✅ Exporter votre code avec les corrections
2. ✅ Créer un bundle optimisé
3. ✅ Uploader sur les serveurs Expo
4. ✅ Publier sur le channel "sunbim"
5. ✅ Les apps existantes téléchargeront l'update au prochain lancement

## 📱 Après Publication

Les utilisateurs avec votre app installée :
1. Ferment complètement l'app
2. Relancent l'app
3. L'update se télécharge automatiquement
4. L'app reload avec le nouveau code
5. **Si crash :** L'ErrorBoundary affichera l'erreur au lieu de fermer l'app

---

**Note:** Si `npm run ota:publish` ne fonctionne toujours pas, utilisez directement :
```bash
npx eas-cli update --branch sunbim --message "Fix crash"
```
