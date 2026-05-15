# Build & Déploiement

## Pré-requis

- **Node.js** ≥ 18.0.0
- **npm** ≥ 9.0.0
- **Rust** stable (installer via [rustup](https://rustup.rs/))
- Cibles de build :
  - Windows : installeur NSIS (.exe)
  - macOS : disque d'installation (.dmg) — nécessite un runner macOS

## Scripts npm

| Script | Commande | Rôle |
|--------|----------|------|
| `dev` | `tauri dev` | Lance le serveur de développement Tauri avec hot reload |
| `build` | `tauri build` | Compile la webview et la binaire Rust en production |
| `preview` | `vite preview` | Prévisualise la build Vite localement |
| `typecheck` | `tsc --noEmit` | Vérification TypeScript sans émission |
| `lint` | `eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0` | Linting du code source |
| `test` | `vitest` | Lance Vitest en mode watch |
| `test:run` | `vitest run` | Exécute les tests une seule fois |
| `test:ui` | `vitest --ui` | Interface utilisateur Vitest |
| `test:coverage` | `vitest run --coverage` | Rapport de couverture de tests |

## Développement

### Lancer le serveur de développement

```bash
npm run dev
```

Cette commande exécute `tauri dev`, qui :
1. Lance Vite en serveur de développement sur `http://localhost:1420`
2. Charge la webview Tauri pointant vers ce serveur
3. Active le hot reload du code React lors des modifications
4. Recompile automatiquement la binaire Rust lors des modifications `src-tauri/`

### Configuration du dev server

- **Port** : `1420` (configuré dans `vite.config.ts`)
- **Strict port** : activé (le serveur échoue si le port est occupé)

## Build production

### Exécuter la build

```bash
npm run build
```

Processus :
1. **Compilation Vite** : transpile et empaquette la webview React dans `dist/`
2. **Compilation Rust** : compile la binaire Tauri en mode `release`
3. **Bundling** : génère les installeurs pour les cibles configurées

### Artefacts de sortie

- **Windows** : `src-tauri/target/release/bundle/nsis/PCR Manager_0.1.0_x64-setup.exe`
- **macOS** : `src-tauri/target/release/bundle/dmg/PCR Manager_0.1.0_x64.dmg`

## Configuration Tauri

Fichier : `src-tauri/tauri.conf.json`

```json
{
  "productName": "PCR Manager",
  "version": "0.1.0",
  "identifier": "com.pcrmanager.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [{
      "title": "PCR Manager",
      "width": 1280,
      "height": 800,
      "resizable": true
    }]
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "dmg"]
  }
}
```

Paramètres clés :
- **identifier** : `com.pcrmanager.app` (identifiant unique d'application)
- **productName** : `PCR Manager`
- **version** : `0.1.0`
- **Fenêtre** : 1280×800, redimensionnable
- **Cibles de bundle** : NSIS (Windows) et DMG (macOS)

## Configuration Vite

Fichier : `vite.config.ts`

- **Version** : Vite 5
- **Plugin React** : `@vitejs/plugin-react` pour JSX
- **Dev server** :
  - Port : `1420`
  - Strict port : oui
  - Clear screen : désactivé

## Configuration TypeScript

### tsconfig.json (application)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

Paramètres clés :
- **target** : ES2022
- **module** : ESNext
- **jsx** : react-jsx
- **strict mode** : activé
- **moduleResolution** : Bundler

### tsconfig.node.json (configuration Vite)

Configurations spécifiques pour `vite.config.ts` (composite, ESNext, Bundler).

## Frontend seul

Pour compiler uniquement la webview (sans Tauri) :

```bash
npx vite build
```

Génère `dist/` pour un déploiement web pur.

## Distribution

### Windows

L'installeur NSIS (`*.exe`) :
- Double-clic pour installer dans `Program Files`
- Démarrage des menus Windows
- Intégration classique Windows

**Signature/Notarisation** : non configurées par défaut.

### macOS

Le disque d'installation (`*.dmg`) :
- Glisser-déposer dans Applications
- Signature de code non configurée par défaut
- Notarisation Apple non configurée par défaut

## Stack technique

- **Frontend** : React 18 + TypeScript + Tailwind
- **Build** : Vite 5
- **Desktop** : Tauri 2
- **Backend Rust** : SQLCipher (SQLite chiffré), Serde, WebAuthn
- **Tests** : Vitest + Testing Library

## Liens

- [Backend & API](./backend.md)
- [Tests](./testing.md)
