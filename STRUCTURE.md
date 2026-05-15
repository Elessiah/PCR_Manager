# PCR Manager — Structure du Projet

## Vue d'ensemble

```
PCR Manager/
├── .git/                          # Dépôt Git
├── .gitignore                     # Exclusions Git
├── .eslintrc.cjs                  # Configuration ESLint
├── .env.example                   # Variables d'environnement (template)
├── index.html                     # Entrypoint HTML (Vite)
├── package.json                   # Dépendances NPM
├── tsconfig.json                  # Configuration TypeScript (src/)
├── tsconfig.node.json             # Configuration TypeScript (outils)
├── vite.config.ts                 # Configuration Vite
├── tailwind.config.js             # Configuration Tailwind CSS
├── postcss.config.js              # Configuration PostCSS
├── README.md                      # Documentation générale
├── STRUCTURE.md                   # Ce fichier
├── cahier_des_charges_radioprotection_v2.md  # Spécifications
├── schema.sql                     # Modèle de données SQLite
│
├── src/                           # Code source React (Frontend)
│   ├── main.tsx                   # Entrypoint React (ReactDOM.render)
│   ├── App.tsx                    # Composant racine (Router + QueryClient)
│   │
│   ├── pages/                     # Pages des 5 modules
│   │   ├── .gitkeep
│   │   ├── Dashboard.tsx          # Module 1: Tableau de bord
│   │   ├── Etablissement.tsx      # Module 2: Établissement
│   │   ├── Travailleurs.tsx       # Module 3: Travailleurs
│   │   ├── Appareils.tsx          # Module 4: Appareils
│   │   └── Actions.tsx            # Module 5: Actions
│   │
│   ├── components/                # Composants réutilisables
│   │   ├── .gitkeep
│   │   ├── Layout/                # Composants layout
│   │   │   ├── Navbar.tsx         # Barre supérieure (5 modules)
│   │   │   ├── Sidebar.tsx        # Sidebar optionnel
│   │   │   └── MainLayout.tsx
│   │   ├── Cards/                 # Cartes visuelles
│   │   │   ├── AlertCard.tsx
│   │   │   ├── StatusCard.tsx
│   │   │   └── DataCard.tsx
│   │   ├── Forms/                 # Formulaires
│   │   │   ├── TravailleurForm.tsx
│   │   │   ├── AppareilForm.tsx
│   │   │   └── EtablissementForm.tsx
│   │   ├── Tables/                # Tableaux de données
│   │   │   ├── Travailleurs Table.tsx
│   │   │   ├── AppareilsTable.tsx
│   │   │   └── ActionsTable.tsx
│   │   ├── Badges/                # Badges de statut
│   │   │   └── StatusBadge.tsx
│   │   └── Modals/                # Modales
│   │       ├── ConfirmModal.tsx
│   │       └── DetailModal.tsx
│   │
│   ├── hooks/                     # Hooks custom
│   │   ├── useTauriInvoke.ts      # Intégration Tauri
│   │   ├── useTremailleurs.ts     # Requêtes travailleurs
│   │   ├── useAppareils.ts        # Requêtes appareils
│   │   ├── useEtablissements.ts   # Requêtes établissements
│   │   └── useAlertes.ts          # Requêtes alertes
│   │
│   ├── context/                   # Context API
│   │   ├── .gitkeep
│   │   ├── AuthContext.tsx        # Contexte authentification (Passkey)
│   │   └── EtablissementContext.tsx
│   │
│   ├── types/                     # Types TypeScript
│   │   └── index.ts               # Énums + Interfaces (basé CDC)
│   │
│   ├── utils/                     # Fonctions utilitaires
│   │   ├── .gitkeep
│   │   ├── dateUtils.ts           # Gestion des dates/échéances
│   │   ├── statusUtils.ts         # Calcul des statuts
│   │   ├── formatUtils.ts         # Formatage (dates, texte)
│   │   └── validators.ts          # Validations formulaires
│   │
│   └── styles/                    # Feuilles de style
│       ├── globals.css            # Styles globaux + Tailwind + badges
│       ├── modules.css            # Styles par module (optionnel)
│       └── animations.css         # Animations (optionnel)
│
└── src-tauri/                     # Code source Rust (Backend)
    ├── src/                       # Code Rust
    │   ├── main.rs               # Point d'entrée Tauri
    │   ├── db/                   # Gestion base de données
    │   │   ├── mod.rs
    │   │   └── migrations/       # Migrations SQLite
    │   ├── commands/             # Commandes Tauri (handlers)
    │   │   ├── mod.rs
    │   │   ├── auth.rs           # WebAuthn / Passkey
    │   │   ├── travailleurs.rs
    │   │   ├── appareils.rs
    │   │   └── etablissements.rs
    │   ├── models/               # Structures de données
    │   │   └── mod.rs
    │   └── utils/                # Utilitaires Rust
    │       └── mod.rs
    │
    ├── Cargo.toml               # Dépendances Rust
    └── tauri.conf.json          # Configuration Tauri
```

---

## Flux de données

```
Utilisateur
    ↓
React UI (pages/ + components/)
    ↓ (React Query)
Hooks (useTravailleur, etc.)
    ↓ (invoke)
App.tsx → useTauriInvoke()
    ↓
Tauri Commands (src-tauri/src/commands/)
    ↓ (Rust handlers)
SQLite + SQLCipher (chiffré)
    ↓
Fichiers (PDFs, K-Bis)
```

---

## Stack par couche

| Couche | Technologie | Fichiers |
|--------|-------------|----------|
| **Frontend** | React 18 + TypeScript | src/pages, src/components |
| **Routing** | React Router v6 | src/App.tsx |
| **État serveur** | TanStack Query v5 | src/hooks |
| **Styles** | Tailwind CSS 3 | src/styles, tailwind.config.js |
| **Interop** | Tauri Invoke | src/hooks/useTauriInvoke.ts |
| **Backend** | Tauri 2 (Rust) | src-tauri/src |
| **Base de données** | SQLite + SQLCipher | schema.sql |
| **Auth** | WebAuthn / Passkey | src-tauri/src/commands/auth.rs |

---

## Points clés

- **Pas de serveur** — application desktop locale uniquement
- **Authentification** — Passkey/WebAuthn (biométrie, PIN système)
- **Données chiffrées** — SQLCipher AES-256 (NSS, données médicales)
- **5 modules** — Tableau de bord, Établissement, Travailleurs, Appareils, Actions
- **Codes couleur** — Vert (valide), Orange (attention), Rouge (invalide), Gris (disabled)

---

## Commandes à utiliser

```bash
# Installation des dépendances
npm install

# Développement
npm run dev              # Tauri dev (hot reload)

# Production
npm run build            # Tauri build (exe/dmg)

# Vérifications
npm run type-check       # TypeScript
npm run lint             # ESLint
npm run test             # Vitest
```

---

## Notes pour l'implémentation

1. **Créer les pages** dans `src/pages/` selon les 5 modules du CDC
2. **Implémenter les hooks** dans `src/hooks/` pour chaque requête DB
3. **Créer les commandes Tauri** dans `src-tauri/src/commands/` avec les handlers Rust
4. **Gérer l'authentification** avec WebAuthn dans le contexte `AuthContext`
5. **Stocker les données** dans SQLite chiffré via `src-tauri/src/db/`
6. **Exclure les fichiers sensibles** (*.db, .env) — déjà dans `.gitignore`
