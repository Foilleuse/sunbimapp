# 🚀 Guide de Configuration OTA - Sunbim

## ✅ Corrections Appliquées

### 1. Configuration `app.config.ts`
- ✅ Ajout de la section `updates` complète
- ✅ `enabled: true` - Les updates sont activés
- ✅ `checkAutomatically: 'ON_LOAD'` - Vérification automatique au démarrage
- ✅ `url: 'https://u.expo.dev/6ac7da66-fe81-4d00-b064-035f9535e691'` - URL correcte
- ✅ `runtimeVersion: 'exposdk:54.0.0'` - Version runtime fixée

### 2. Vérification Automatique au Démarrage
- ✅ Ajout de logs détaillés dans `app/_layout.tsx`
- ✅ Vérification automatique à chaque lancement
- ✅ Téléchargement et reload automatique si update disponible

### 3. Panneau de Debug OTA
- ✅ Nouveau composant `OTADebugPanel` en haut de l'écran principal
- ✅ Affiche : statut, runtime version, channel, update ID
- ✅ Bouton "Check Update" pour test manuel
- ✅ Bouton "Reload" pour recharger l'app

### 4. Script NPM Corrigé
- ✅ `npm run ota:publish "message"` - Commande correcte avec CI=1

---

## 🔧 Comment Publier un OTA Update

### Commande Correcte
```bash
npm run ota:publish "Votre message de changelog"
```

Ou directement :
```bash
CI=1 eas update --branch sunbim --message "Votre message"
```

**Note:** L'option `CI=1` remplace `--non-interactive` (deprecated)

---

## 📱 Comment Tester

### 1. Rebuilder l'App
Après les changements de configuration, vous devez créer un nouveau build :
```bash
eas build --platform ios --profile preview
# ou
eas build --platform android --profile preview
```

**Important:** Les changements dans `app.config.ts` nécessitent un nouveau build !

### 2. Installer le Nouveau Build
- iOS : Téléchargez via TestFlight ou le lien direct
- Android : Installez le fichier APK/AAB

### 3. Vérifier le Panneau de Debug
Au lancement de l'app, vérifiez en haut de l'écran :
- ✅ "Updates Enabled: YES" (doit être vert)
- Runtime Version: "exposdk:54.0.0"
- Channel: "sunbim"

### 4. Publier un Update OTA
```bash
npm run ota:publish "Test OTA update"
```

### 5. Tester la Réception
**Option A : Automatique**
- Fermez complètement l'app (swipe depuis le multitâche)
- Relancez l'app
- L'update devrait se télécharger automatiquement
- Vérifiez les logs console

**Option B : Manuel**
- Appuyez sur "Check Update" dans le debug panel
- Si update disponible, appuyez sur "Reload"

---

## 🔍 Logs à Surveiller

Dans votre terminal (Metro) ou console native, vous devriez voir :

```
🔄 Sunbim OTA: Running update check on load
📱 Sunbim OTA: Runtime version: exposdk:54.0.0
📱 Sunbim OTA: Channel: sunbim
📱 Sunbim OTA: Update ID: xxx-xxx-xxx
✅ Sunbim OTA: Update available! Fetching...
✅ Sunbim OTA: Update downloaded, reloading...
```

---

## ❌ Problèmes Fréquents

### "Updates Enabled: NO"
**Cause:** Vous êtes en mode dev ou sur web
**Solution:** Testez sur un build de production

### "No update available" mais j'ai publié
**Causes possibles:**
1. Le runtimeVersion ne match pas → Vérifiez dans le debug panel
2. Le channel ne match pas → Doit être "sunbim"
3. Le build est trop ancien → Recréez un build avec la nouvelle config

### Updates ne se téléchargent toujours pas
**Solution:** Recréez un build APRÈS avoir modifié `app.config.ts`

---

## 📋 Checklist Complète

- [ ] `app.config.ts` a la section `updates` complète
- [ ] Nouveau build créé APRÈS les changements
- [ ] App installée depuis le nouveau build
- [ ] Debug panel affiche "Updates Enabled: YES"
- [ ] Runtime version = "exposdk:54.0.0"
- [ ] Channel = "sunbim"
- [ ] OTA publié avec `npm run ota:publish "message"`
- [ ] App fermée et relancée
- [ ] Logs dans la console confirment le téléchargement

---

## 🎯 Prochaines Étapes

1. **Créez un nouveau build** avec ces changements
2. **Installez-le** sur votre device de test
3. **Vérifiez** le debug panel au lancement
4. **Publiez** un update OTA test
5. **Relancez** l'app pour tester la réception

Le panneau de debug restera visible jusqu'à ce que vous soyez sûr que tout fonctionne. Vous pourrez ensuite le retirer en supprimant `<OTADebugPanel />` de `app/index.tsx`.

---

## 📞 Diagnostic Rapide

Si après un nouveau build, l'app ne télécharge toujours pas :

1. Vérifiez le debug panel : "Updates Enabled" doit être YES
2. Vérifiez la console : vous devez voir les logs "Sunbim OTA"
3. Utilisez le bouton "Check Update" pour forcer un check manuel
4. Vérifiez sur le dashboard Expo que l'update est bien sur le channel "sunbim"
5. Vérifiez que le runtimeVersion du build = runtimeVersion de l'update

**Succès attendu:** Après avoir publié un update et relancé l'app, vous devriez voir les logs de téléchargement et l'app devrait reload automatiquement.
