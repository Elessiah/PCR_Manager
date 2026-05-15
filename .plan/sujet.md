# Projet : PCR Manager — Application Suivi Radioprotection

## Objectif global

Implémenter une application desktop **Tauri 2 + React 18 + TypeScript + Tailwind CSS** avec base **SQLite chiffrée (SQLCipher)** et authentification **Passkey/WebAuthn**, en suivant fidèlement la maquette de design fournie.

## Contexte repo

- **Repo path (cwd absolue)** : `C:\work\PCR Manager\.claude\worktrees\dreamy-villani-248f39`
- **Branche actuelle** : `feature/dreamy-villani-248f39` (worktree)
- **OS cible build** : Windows (.exe NSIS) + macOS (.dmg)
- **OS dev** : Windows 11, PowerShell. Le binaire `claude` tourne déjà sous PS — utiliser `Bash` tool quand un script POSIX est plus simple, sinon PowerShell.
- **Le repo est NPM-init seulement** : `package.json` existe, dépendances React+Tailwind+TS+Tauri à installer/configurer. Les fichiers existants à NE PAS TOUCHER hors scope explicite :
  - `cahier_des_charges_radioprotection_v2.md` (spec — read-only)
  - `schema.sql` (schéma DB — read-only, à copier dans `src-tauri/migrations/`)
  - `STRUCTURE.md` (doc projet)
  - `.gitignore`, `LICENSE`, `README.md`
  - `design-mockup/` (maquette fournie — read-only, source de vérité visuelle)

## Maquette de design — lue et résumée

La maquette (`design-mockup/project/index.html` et `src/*.jsx`) utilise React 18 UMD + Babel standalone (prototype). On doit **reproduire le rendu pixel-perfect** avec React+TS+Tailwind, **pas** copier sa structure interne.

### Design tokens (à intégrer dans Tailwind config)

```css
/* OKLCH palette */
--bg: oklch(0.985 0.003 250);
--surface: #ffffff;
--surface-2: oklch(0.975 0.004 250);
--surface-hover: oklch(0.965 0.005 250);
--border: oklch(0.92 0.006 250);
--border-strong: oklch(0.86 0.008 250);
--text: oklch(0.22 0.02 255);
--text-muted: oklch(0.48 0.015 255);
--text-soft: oklch(0.62 0.012 255);
--accent: oklch(0.52 0.14 245);        /* bleu primaire */
--accent-hover: oklch(0.46 0.15 245);
--accent-soft: oklch(0.96 0.02 245);
--accent-soft-border: oklch(0.9 0.04 245);
--ok: oklch(0.55 0.13 150);    --ok-bg: oklch(0.965 0.025 150);    --ok-border: oklch(0.88 0.05 150);
--warn: oklch(0.62 0.14 65);   --warn-bg: oklch(0.97 0.04 75);     --warn-border: oklch(0.88 0.08 70);
--danger: oklch(0.58 0.18 25); --danger-bg: oklch(0.965 0.03 25);  --danger-border: oklch(0.88 0.08 25);
--neutral: oklch(0.55 0.01 255); --neutral-bg: oklch(0.96 0.004 255); --neutral-border: oklch(0.9 0.006 255);
--radius: 6px;
--radius-sm: 4px;
```

### Typographie
- **Public Sans** (400, 500, 600, 700) — corps & UI. font-size de base 14px, line-height 1.45, font-feature-settings "ss01" "cv11".
- **JetBrains Mono** (400, 500) — chiffres (`.mono`, tabular-nums, feature "zero"), kbd, num cellules tableau.

### Layout
- App grid : `240px 1fr` (sidebar / main).
- Sidebar : sticky height 100vh, brand 18px padding, nav-items 7px 10px, badges count à droite.
- Topbar : 56px hauteur, breadcrumb à gauche, search 280px à droite, sticky top 0 z-10.
- Page : `padding: 28px 32px 56px; max-width: 1320px`.

### Composants observés (à reproduire en composants TS réutilisables)
- `Button` (variants : default / primary / ghost / danger-ghost ; sizes : default / sm / icon)
- `Card` (head + body, border radius 8px, shadow-md léger)
- `Badge` (variants : ok / warn / danger / neutral / accent ; rounded-full ; icône optionnelle)
- `Dot` (ok/warn/danger/neutral — pastille 8px)
- `Table` (head uppercase 12px text-soft, rows hoverables, .num mono tabular)
- `KpiTile` (label uppercase + valeur 32px bold + footer)
- `FormField` (label + input / select / textarea, focus accent ring)
- `Tabs` (border-bottom, tab actif accent + bordure 2px)
- `PillFilter` (groupe boutons radio segmenté)
- `BreadCrumb`, `SearchBox`, `Sidebar`, `Topbar`, `Avatar`

### Modules (mêmes que la spec)
1. **Dashboard** — KPI grid (3 cols) + cartes alertes par catégorie + statuts ok/warn/danger
2. **Etablissement** — formulaire admin + section K-Bis (SIRET + upload PDF)
3. **Travailleurs** — table + fiche 2 onglets (Données / Habilitation) + sous-fiche compétences
4. **Appareils** — table + fiche (info + caractéristiques + vérifs techniques + contrôles qualité)
5. **Actions** — liste filtrable (pill-filter : Tout / En retard / À venir / Formation / Contrôle / Visite médicale)

## Stack technique imposée

| Couche | Tech |
|--------|------|
| Shell | Tauri 2 (Rust) |
| Frontend | React 18 + TypeScript + Tailwind CSS 3 + Vite |
| Routing | React Router 6 |
| State serveur | TanStack Query 5 |
| Backend local | Rust + crate `tauri`, `rusqlite` (feature `bundled-sqlcipher-vendored-openssl` ou équivalent), `webauthn-rs`, `refinery` ou `rusqlite_migration`, `serde`, `chrono` |
| Build | Tauri CLI → Windows NSIS, macOS DMG |

## Schéma SQL (schema.sql — à copier dans `src-tauri/migrations/V1__initial.sql`)

Tables : `passkey`, `etablissement`, `travailleur`, `habilitation`, `competence_ref` (seed 9 lignes), `competence_travailleur`, `appareil`, `verification_technique`, `controle_qualite`, `document`. Vue `v_prochaine_verification`. Triggers `trg_*_updated` (updated_at) + `trg_generer_cq_internes` (génère 3 CQ internes J+90/180/270 à l'insertion d'un CQ externe).

PRAGMA `foreign_keys = ON`, `journal_mode = WAL`. Dates ISO 8601 (TEXT). Booléens INTEGER 0/1.

**ATTENTION** : dans `schema.sql` la table `competence_travailleur` (l. 128) référence `appareil(id)` AVANT que la table `appareil` (l. 143) ne soit créée → réordonner en migration (placer `appareil` avant `competence_travailleur`).

## Logique métier critique

- **Habilitation** : statut calculé à la volée (jamais stocké). 4 critères : formations à jour, dosimétries renseignées, compétences appareils ≥ 1 validation complète 9/9, visite médicale non expirée. Statuts : `non_validee` (gris) / `partielle` (orange) / `validee` (vert).
- **Renouvellement formation RP travailleurs** : 3 ans. **RP patients** : 7 ans.
- **Vérification technique annuelle interne** : 1 an, alerte 1 mois avant. **Triennale externe** : 3 ans, alerte 1 mois avant. Statut = la plus contraignante.
- **Contrôle qualité** : externe = point de départ. À l'insert externe, trigger crée 3 internes (partiel J+90, complet J+180, partiel J+270).
- **Statuts couleur globaux** : vert (valide), orange (à prévoir, ≤ 3 mois), rouge (en retard, dépassé), gris (non applicable / non validé).

## Authentification Passkey

- WebAuthn via crate `webauthn-rs` côté Rust.
- Credential locale stockée dans table `passkey`.
- À l'init de l'app : si aucune passkey enregistrée → onboarding "Créer une passkey" ; sinon → login passkey.
- Biométrie / PIN système (Windows Hello, Face ID, empreinte) gérés par l'OS via WebAuthn API du webview.
- Aucune transmission réseau (local only).

## Sécurité

- SQLCipher AES-256 — clé dérivée d'un secret généré au premier lancement et stocké dans le keychain OS (`tauri-plugin-stronghold` ou équivalent ; à défaut, fichier protégé par DPAPI sur Windows / Keychain sur macOS).
- PDFs (K-Bis, etc.) stockés dans `AppData/PCR Manager/documents/` avec chemin relatif en DB.

## Structure cible du repo (à créer)

```
.
├── package.json                  (déjà init, à compléter)
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── index.html
├── src/                          (frontend React)
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css                 (Tailwind + tokens OKLCH)
│   ├── lib/
│   │   ├── api.ts                (wrapper invoke Tauri typé)
│   │   ├── status.ts             (calcul statuts couleur)
│   │   └── habilitation.ts       (calcul habilitation)
│   ├── components/
│   │   ├── ui/                   (Button, Card, Badge, Table, KpiTile, FormField, Tabs, PillFilter, Dot)
│   │   ├── layout/               (Sidebar, Topbar, AppShell)
│   │   └── icons.tsx
│   ├── modules/
│   │   ├── dashboard/
│   │   ├── etablissement/
│   │   ├── travailleurs/         (incl. fiche, onglets, sous-fiche compétences)
│   │   ├── appareils/            (incl. fiche, vérifs, CQ)
│   │   └── actions/
│   └── types/
│       └── domain.ts             (types TS générés à partir du schéma)
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── migrations/
│   │   └── V1__initial.sql       (= schema.sql adapté)
│   └── src/
│       ├── main.rs
│       ├── db.rs                 (pool rusqlite + SQLCipher)
│       ├── auth.rs               (webauthn-rs + passkey table)
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── etablissement.rs
│       │   ├── travailleur.rs
│       │   ├── habilitation.rs
│       │   ├── appareil.rs
│       │   ├── competence.rs
│       │   ├── verification.rs
│       │   ├── controle_qualite.rs
│       │   └── document.rs
│       └── models.rs             (structs serde mirror du schéma)
└── design-mockup/                (read-only)
```

## Contraintes strictes pour chaque tâche

- **SCOPE STRICT** : chaque prompt doit énumérer les fichiers autorisés à créer/modifier. Aucun ménage ou refactor spontané ailleurs.
- Ne jamais toucher : `cahier_des_charges_radioprotection_v2.md`, `schema.sql` (original), `design-mockup/**`, `STRUCTURE.md`, `LICENSE`, `.gitignore`.
- Toutes les commandes shell doivent être Windows-compatibles (PowerShell ou commands via le `Bash` tool intégré). Pas de `&&` PowerShell (utiliser `;` ou enchaîner).
- Chemins absolus : utiliser `C:\work\PCR Manager\.claude\worktrees\dreamy-villani-248f39\` comme cwd.
- Pour les installations npm/cargo, **ne PAS** lancer `npm run tauri dev` ou un dev server (bloquant) — uniquement install + build vérifications.
- **Validation par tâche** : après création de fichiers, lancer la commande pertinente (`npx tsc --noEmit` pour TS, `cargo check --manifest-path src-tauri/Cargo.toml` pour Rust, etc.) et rapporter les erreurs sans les corriger hors-scope.
- Pas de placeholder TODO laissés en plan — chaque tâche doit être livrée fonctionnellement complète sur son périmètre.

## Plan attendu (ordre logique)

1. **Setup projet** : `package.json` (deps), `tsconfig.json`, `vite.config.ts`, `index.html`, `postcss.config.js`, `tailwind.config.ts` (tokens OKLCH + fonts), `src/index.css` (`@tailwind base/components/utilities` + variables CSS), `src/main.tsx` boot React. Validation : `npx tsc --noEmit`.
2. **Setup Tauri Rust** : `src-tauri/Cargo.toml`, `tauri.conf.json` (windows + macos config, bundle NSIS/DMG, identifier `com.pcrmanager.app`), `build.rs`, `src-tauri/src/main.rs` minimal avec une commande `ping`. Validation : `cargo check --manifest-path src-tauri/Cargo.toml`.
3. **DB + migrations** : `src-tauri/migrations/V1__initial.sql` (= schema.sql avec réordonnancement `appareil` AVANT `competence_travailleur`), `src-tauri/src/db.rs` (pool rusqlite + SQLCipher + applique migrations au boot), commande Tauri `init_db`. Validation : `cargo check`.
4. **Auth Passkey** : `src-tauri/src/auth.rs` avec `webauthn-rs` (register + authenticate), table `passkey`, commandes Tauri `passkey_register_start/finish`, `passkey_auth_start/finish`. Validation : `cargo check`.
5. **Commandes CRUD Rust** : `src-tauri/src/models.rs` (structs serde) + `src-tauri/src/commands/{etablissement,travailleur,habilitation,appareil,competence,verification,controle_qualite,document}.rs` + `commands/mod.rs` + enregistrement dans `main.rs`. Validation : `cargo check`.
6. **UI primitives** : `src/components/ui/{Button,Card,Badge,Dot,Table,KpiTile,FormField,Tabs,PillFilter}.tsx` + `src/components/icons.tsx` (Lucide React ou SVG inline depuis maquette). Validation : `npx tsc --noEmit`.
7. **Layout + routing** : `src/components/layout/{Sidebar,Topbar,AppShell}.tsx`, `src/App.tsx` avec React Router 6 (5 routes), wrapper TanStack Query. Validation : `npx tsc --noEmit`.
8. **Lib statut + habilitation** : `src/lib/{status.ts,habilitation.ts,api.ts}` (wrapper `invoke` typé). Validation : `npx tsc --noEmit`.
9. **Module Dashboard** : `src/modules/dashboard/Dashboard.tsx` + sous-composants alertes par catégorie. Validation : `npx tsc --noEmit`.
10. **Module Etablissement** : `src/modules/etablissement/{Etablissement.tsx,KbisSection.tsx}` + commande Tauri document upload côté Rust si pas déjà fait. Validation : `npx tsc --noEmit`.
11. **Module Travailleurs** : `src/modules/travailleurs/{TravailleursList.tsx,TravailleurFiche.tsx,DonneesPersonnellesTab.tsx,HabilitationTab.tsx,CompetencesAppareilSubsheet.tsx}`. Validation : `npx tsc --noEmit`.
12. **Module Appareils** : `src/modules/appareils/{AppareilsList.tsx,AppareilFiche.tsx,VerificationsSection.tsx,ControlesQualiteSection.tsx}`. Validation : `npx tsc --noEmit`.
13. **Module Actions** : `src/modules/actions/Actions.tsx` (vue consolidée filtrable depuis toutes sources). Validation : `npx tsc --noEmit`.
14. **Build vérification** : `npx tsc --noEmit` + `cargo check` complet + `npx vite build` (build frontend uniquement, pas tauri build complet qui exigerait un installeur NSIS local). Rapport final.

Chaque tâche = autonome, mentionne chemins absolus + SCOPE STRICT + commande de validation.
