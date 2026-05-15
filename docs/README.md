# PCR Manager — Documentation technique

PCR Manager est une application de suivi de radioprotection conçue comme client lourd Tauri 2, avec données chiffrées localement et authentification Passkey.

## Démarrage rapide

### Pré-requis

- Node.js ≥ 18.0.0
- npm ≥ 9.0.0
- Rust stable (via rustup)

### Installation et lancement

```bash
npm install
npm run dev
```

Cela lance le serveur Tauri en développement et expose Vite sur `http://localhost:1420`.

### Build et déploiement

```bash
npm run build
```

Produit l'installeur final (NSIS pour Windows, DMG pour macOS).

Pour bundler le frontend seul vers le dossier `dist/`, sans Tauri backend :

```bash
npx vite build
```

### Autres scripts utiles

- `npm run typecheck` — vérifie les types TypeScript sans émettre.
- `npm run lint` — contrôle les violations ESLint.
- `npm run test` — lance Vitest en mode watch.
- `npm run test:run` — exécute une seule fois tous les tests.
- `npm run test:ui` — ouvre l'interface web Vitest.
- `npm run test:coverage` — génère un rapport de couverture.

## Stack technique

| Couche | Technologie | Version |
|--------|------------|---------|
| **Frontend** | React | 18.2.0 |
| | TypeScript | 5.3.0 |
| | Vite | 5.0.0 |
| | React Router | 6.20.0 |
| | TanStack Query | 5.28.0 |
| | Tailwind CSS | 3.4.0 |
| | lucide-react | 0.344.0 |
| | @tauri-apps/api | 2.0.0 |
| **Backend** | Rust | 2021 edition |
| | Tauri | 2 |
| | rusqlite | 0.31 (bundled-sqlcipher-vendored-openssl) |
| | webauthn-rs | 0.5 |
| | chrono | 0.4 |
| | anyhow, thiserror | 1 |
| | directories | 5 |
| | parking_lot | 0.12 |
| | uuid | 1 |
| **Tests** | Vitest | 1.1.0 |
| | @testing-library/react | 14.2.0 |
| | jsdom | 24.0.0 |

## Table des matières

La documentation technique couvre les domaines suivants :

- [Architecture](./architecture.md) — structure générale, composants, flux de données.
- [Base de données](./database.md) — schéma SQL, migrations, requêtes.
- [Backend Rust](./backend.md) — structure du projet Tauri, commandes, API interne.
- [Frontend React](./frontend.md) — composants, routing, state management.
- [Logique métier](./business-logic.md) — règles métier, workflows radioprotection.
- [Sécurité](./security.md) — authentification Passkey, chiffrement, bonnes pratiques.
- [Build & déploiement](./build-deploy.md) — processus de build, distribution, CI/CD.
- [Tests](./testing.md) — stratégie de test, couverture, exécution.

## Public cible

**Développeurs** — Cette documentation s'adresse en premier lieu aux développeurs contribuant au projet. Les sections Architecture, Backend, Frontend, Tests et Sécurité fournissent les détails techniques et les conventions nécessaires.

**Mainteneur métier** — Une section dédiée à l'utilisation du logiciel et aux opérations sera complétée ultérieurement.

## Conventions de la documentation

- Markdown CommonMark : listes, tableaux, blocs de code, liens.
- Liens entre documents : chemins relatifs (ex. `./architecture.md`).
- Références vers le code source : chemins depuis la racine du repository.
- Exemples et extraits : copiés directement du code en place.
- Diagrammes : format ASCII ou Mermaid quand nécessaire.
