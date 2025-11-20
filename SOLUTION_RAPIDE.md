# 🚀 Solution Rapide pour Publier l'Update OTA

## ❌ Votre Erreur Actuelle

```
ReferenceError: ReadableStream is not defined
```

## ✅ Cause

Vous utilisez **Node.js 16** qui est trop ancien pour Expo SDK 54.

**Expo SDK 54 requiert Node.js 18 minimum.**

## 🔧 Solution en 3 Étapes

### Étape 1 : Changer la Version Node

Dans votre terminal Codespaces :

```bash
nvm use 22
```

Si erreur "version not installed" :

```bash
nvm install 22
nvm use 22
```

Vérifiez :
```bash
node --version
```

Vous devez voir `v22.x.x` ou au minimum `v18.x.x`.

### Étape 2 : Nettoyer et Réinstaller

```bash
rm -rf node_modules package-lock.json
npm install
```

### Étape 3 : Publier l'Update

```bash
npx eas-cli update --branch sunbim --message "Fix crash with ErrorBoundary"
```

## ✅ Résultat Attendu

Vous devriez voir :

```
✔ Bundled successfully
✔ Exported successfully
✔ Published successfully
```

## 🎯 Après la Publication

1. **Fermez complètement** votre app mobile
2. **Relancez-la**
3. L'update se télécharge automatiquement
4. **Si crash** : L'ErrorBoundary affichera maintenant l'erreur au lieu de fermer l'app

## 🐛 Si Ça Ne Marche Toujours Pas

### Erreur : "eas-cli not found"
**Solution :** Internet requis pour télécharger `eas-cli` via npx

### Erreur : "No credentials"
**Solution :**
```bash
npx eas-cli login
```

### Erreur : "ReadableStream is not defined" persiste
**Solution :** Vérifiez que vous utilisez bien Node 22 :
```bash
node --version  # Doit être v22.x.x
which node      # Vérifie le chemin utilisé
```

## 📋 Commandes Complètes (Copy-Paste)

```bash
# 1. Changer Node version
nvm use 22 || (nvm install 22 && nvm use 22)

# 2. Vérifier
node --version

# 3. Nettoyer (optionnel mais recommandé)
rm -rf node_modules package-lock.json && npm install

# 4. Publier
npx eas-cli update --branch sunbim --message "Fix crash with ErrorBoundary"
```

---

**Pour plus de détails, consultez `OTA_PUBLISH_FIX.md`**
