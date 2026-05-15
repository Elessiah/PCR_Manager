# Documentation technique — PCR Manager

## Objectif

Produire une **documentation technique complète et factuelle** du projet PCR Manager (Tauri 2 + React 18 + TS + SQLite/SQLCipher + Passkey WebAuthn) sous forme de fichiers markdown dans `docs/`. La documentation doit refléter **l'état réel du code**, pas un idéal — Haiku doit **LIRE les fichiers cibles** avant d'écrire chaque section.

## Cwd absolue

`C:\work\PCR Manager\.claude\worktrees\dreamy-villani-248f39`

OS : Windows 11 PowerShell. Le `Bash` tool est disponible.

## État réel du repo (à documenter, pas à inventer)

### Stack effective (vérifiée dans `package.json` et `src-tauri/Cargo.toml`)

- **Frontend** : React 18.2, TypeScript 5.3, Vite 5, React Router 6.20, TanStack Query 5.28, Tailwind 3.4, `lucide-react` 0.344, `@tauri-apps/api` 2.
- **Backend** : Rust 2021, Tauri 2, `rusqlite` 0.31 (feature `bundled-sqlcipher-vendored-openssl`), `webauthn-rs` 0.5 (feature `danger-allow-state-serialisation`), `serde` 1, `chrono` 0.4, `anyhow` 1, `thiserror` 1, `directories` 5, `parking_lot` 0.12, `uuid` 1.
- **Tests** : Vitest 1, @testing-library/react 14, jsdom 24.
- **Build cible** : Windows `.exe` NSIS, macOS `.dmg`. Identifier `com.pcrmanager.app`, fenêtre 1280×800.

### Arborescence réelle

```
.
├── cahier_des_charges_radioprotection_v2.md  (spec)
├── schema.sql                                 (DDL d'origine)
├── design-mockup/                             (maquette Anthropic)
├── docs/                                      (À CRÉER ICI)
├── src/
│   ├── App.tsx, main.tsx, index.css, vite-env.d.ts
│   ├── components/
│   │   ├── icons.tsx
│   │   ├── layout/    (AppShell, Sidebar, Topbar)
│   │   └── ui/        (Badge, Button, Card, Dot, FormField, KpiTile, PillFilter, Table, Tabs, index.ts)
│   ├── lib/           (api.ts, cn.ts, habilitation.ts, status.ts)
│   ├── modules/
│   │   ├── actions/Actions.tsx
│   │   ├── appareils/{AppareilsList,AppareilFiche,VerificationsSection,ControlesQualiteSection}.tsx
│   │   ├── dashboard/{Dashboard,AlertesCard}.tsx
│   │   ├── etablissement/{Etablissement,KbisSection}.tsx
│   │   └── travailleurs/{TravailleursList,TravailleurFiche,DonneesPersonnellesTab,HabilitationTab,CompetencesAppareilSubsheet}.tsx
│   ├── test/          (setup.ts, test-utils.tsx)
│   └── types/domain.ts
└── src-tauri/
    ├── Cargo.toml, tauri.conf.json, build.rs
    ├── migrations/V1__initial.sql
    └── src/
        ├── main.rs, lib.rs, db.rs, auth.rs, models.rs
        └── commands/{mod,etablissement,travailleur,habilitation,appareil,competence,verification,controle_qualite,document}.rs
```

### Commandes Tauri publiques (signatures vérifiées)

Chaque commande retourne `Result<T, String>` et reçoit `state: tauri::State<'_, DbState>` :

- **Appareil** : `appareil_list`, `appareil_get(id)`, `appareil_create(input)`, `appareil_update(input)`, `appareil_delete(id)`
- **Compétence** : `competence_list`, `competence_set(input)`, `competence_get_for_travailleur(travailleur_id)`
- **Contrôle qualité** : `controle_qualite_list`, `controle_qualite_get(id)`, `controle_qualite_create(input)`, `controle_qualite_update(input)`, `controle_qualite_delete(id)`
- **Document** : `document_list`, `document_get(id)`, `document_upload(...)`, `document_delete(id)`
- **Établissement** : `etablissement_list`, `etablissement_get(id)`, `etablissement_create(input)`, `etablissement_update(input)`, `etablissement_delete(id)`
- **Habilitation** : `habilitation_compute(travailleur_id)` → `HabilitationStatus { statut, details }`
- **Travailleur** : `travailleur_list`, `travailleur_get(id)`, `travailleur_create(input)`, `travailleur_update(input)`, `travailleur_delete(id)`
- **Vérification** : `verification_list`, `verification_get(id)`, `verification_create(input)`, `verification_update(input)`, `verification_delete(id)`
- **DB** : `init_db` (`#[tauri::command]` dans `db.rs`)
- **Auth Passkey** : 4 commandes (registration_start/finish, authentication_start/finish) dans `auth.rs`

Wrapper TS dans `src/lib/api.ts` : `api.<domain>.<method>(args)`.

### Schéma DB (résumé — détail dans `schema.sql` et `src-tauri/migrations/V1__initial.sql`)

Tables : `passkey`, `etablissement`, `travailleur`, `habilitation`, `competence_ref` (seed 9 lignes), `appareil`, `competence_travailleur`, `verification_technique`, `controle_qualite`, `document`.

Vue : `v_prochaine_verification`. Triggers : `trg_etablissement_updated`, `trg_travailleur_updated`, `trg_appareil_updated`, `trg_habilitation_updated`, `trg_generer_cq_internes` (génère 3 CQ internes à J+90/180/270 après un CQ externe).

Encodage des dates : ISO 8601 TEXT. Booléens INTEGER 0/1. PRAGMA `foreign_keys=ON`, `journal_mode=WAL`. Chiffrement SQLCipher AES-256, clé dérivée à la première ouverture (`PRAGMA key`).

### Logique métier

- **Statuts couleur** : vert (valide), orange (à prévoir ≤ 3 mois pour CQ complet / ≤ 1 mois pour vérifs), rouge (en retard), gris (non applicable). Implémenté côté front dans `src/lib/status.ts` (`statusFromDate(deadlineIso, alertMonths=1)`).
- **Habilitation** (calculée côté Rust via `habilitation_compute`) : statut `validee` / `partielle` / `non_validee`, basée sur 4 critères : formations à jour, dosimétries renseignées, compétences appareils (au moins 9/9 sur un appareil), visite médicale non expirée.
- **Renouvellements** : formation RP travailleurs = 3 ans, formation RP patients = 7 ans, vérif annuelle interne = 1 an, vérif triennale externe = 3 ans.
- **Compétences** : 9 compétences fixes (seed `competence_ref`) validées individuellement par couple (travailleur, appareil).

### Sécurité

- **Auth** : Passkey WebAuthn locale via `webauthn-rs`. Aucune transmission réseau. Credentials stockées dans la table `passkey`.
- **DB** : SQLCipher AES-256, fichier `pcr_manager.db` dans `AppData/PCR Manager/` (`directories::ProjectDirs`).
- **PDFs** (K-Bis, etc.) : stockés dans `AppData/PCR Manager/documents/`, chemin relatif en DB.

### Build

- **Dev** : `npm run dev` (= `tauri dev`, dev server Vite sur `localhost:1420`).
- **Production** : `npm run build` (= `tauri build`) → `.exe` NSIS sur Windows, `.dmg` sur macOS (runner macOS requis).
- **Frontend seul** : `npx vite build` → `dist/`.

### Tests

- **Frontend** (`vitest run`) : 192 tests, 171 passent (89%). Couvre lib pure (status, habilitation, cn, api), 9 primitives UI, layout, modules. 21 échecs documentés concentrés sur des assertions de texte exact dans les modules Travailleurs/Appareils.
- **Rust** (`cargo test`) : 11 tests `#[cfg(test)]` (migrations, CRUD round-trips, trigger `trg_generer_cq_internes`). Cargo non installé sur la machine dev courante — à valider en CI.

## Public cible de la documentation

- **Développeurs** qui reprennent le code (junior à senior) — explication d'architecture, conventions, points d'entrée.
- **Mainteneur PCR** (utilisateur final métier) — uniquement la section "Utilisation", concise.
- Pas de doc commerciale, pas de marketing.

## Format et conventions

- **Markdown CommonMark** (rendu GitHub).
- **Front-matter** : Aucun (markdown plat).
- **Liens** : relatifs entre fichiers (`[Backend](./backend.md)`), absolus depuis racine pour le code source (`[src/lib/api.ts](../src/lib/api.ts)`).
- **Code samples** : copier les vrais extraits du code (lire avec Read tool), pas inventer. Si exemple synthétique, le marquer "(exemple)".
- **Diagrammes** : ASCII-art ou Mermaid (rendu GitHub natif) — pas d'images externes.
- **Longueur** : chaque doc 100-400 lignes (pas de pavé). Privilégier les tableaux et listes.
- **Ton** : concis, factuel, pas de superlatifs. Phrases courtes.

## Plan attendu (8-9 tâches)

1. **`docs/README.md`** — index/table des matières + démarrage rapide (pré-requis : Node ≥ 18, Rust stable, dependencies install, `npm run dev`). Liens vers tous les autres docs.
2. **`docs/architecture.md`** — vue 10000 pieds : diagramme ASCII Frontend ↔ Tauri IPC ↔ Rust ↔ SQLite. Layers, responsabilités, flow d'une requête type (ex: charger la liste des travailleurs).
3. **`docs/database.md`** — schéma SQL commenté (tables, contraintes, FK, triggers, vue), conventions (dates ISO, booléens), localisation du fichier `.db`, chiffrement SQLCipher, migration `V1__initial.sql`. Référencer la spec dans `schema.sql`.
4. **`docs/backend.md`** — couche Rust : `db.rs` (open/run_migrations), `auth.rs` (passkey flows), `models.rs`, structure `commands/`, pattern `Result<T, String>`, gestion `DbState` + `parking_lot::Mutex`. Lister les 34 commandes Tauri (table par module).
5. **`docs/frontend.md`** — architecture front : routing React Router (5 routes), TanStack Query (cache, retry, gcTime), wrapper `api.ts`, design tokens OKLCH + Tailwind config, primitives UI (`src/components/ui/`), layout (Sidebar/Topbar/AppShell).
6. **`docs/business-logic.md`** — règles métier : calcul d'habilitation (4 critères → 3 statuts), statuts couleur (statusFromDate + thresholds vert/orange/rouge), renouvellements (3 ans / 7 ans / 1 an / 3 ans), trigger `trg_generer_cq_internes` (J+90/180/270), compétences 9/9.
7. **`docs/security.md`** — modèle de menace + mitigations (tableau menace/mitigation reproduit du cahier des charges), Passkey WebAuthn (flow register/authenticate), SQLCipher (clé, dérivation, stockage), stockage local des PDFs, conformité RGPD.
8. **`docs/build-deploy.md`** — build pipeline : `npm run dev`, `npm run build`, cibles Windows (NSIS) / macOS (DMG, runner macOS requis), config `tauri.conf.json`, identifiant `com.pcrmanager.app`, sortie installeur.
9. **`docs/testing.md`** — stratégie : Vitest + RTL + jsdom, structure `__tests__/`, `src/test/setup.ts` (mock global de `@tauri-apps/api/core`), `renderWithProviders` (router + QueryClient), Rust `#[cfg(test)]` avec DB en mémoire (feature `bundled` non chiffré), commandes `npm test` / `cargo test`, état actuel honnête (171/192 frontend, 11 Rust).

## Contraintes strictes

- **SCOPE STRICT par tâche** : chaque tâche ne crée/édite QUE le `.md` qui lui est assigné + éventuellement `docs/README.md` pour la première tâche. INTERDIT de toucher au code applicatif, à `schema.sql`, au cahier des charges, à `STRUCTURE.md`, etc.
- **Lecture obligatoire avant écriture** : chaque tâche doit `Read` les fichiers source pertinents (chemins fournis dans le prompt) AVANT de rédiger, pour citer fidèlement signatures et noms. Ne pas inventer de noms de fonction ou de champ.
- **Pas de duplication** : si une info est ailleurs (ex : signatures détaillées dans `backend.md`), la référencer par lien plutôt que de répéter.
- **Validation par tâche** : `Bash` tool → `wc -l docs/<fichier>.md` doit retourner ≥ 80 lignes et ≤ 500 lignes. Pas de placeholder TODO non résolu.
- **Pas de Co-Authored-By dans les commits** (user kgalaxie84).
- **Cargo absent** sur la machine — ne pas tenter de lancer `cargo doc` ou `cargo test`. Les commandes sont mentionnées dans la doc, pas exécutées.
- **Pas de génération automatique** (rustdoc, typedoc) — pure rédaction humaine.

## Commande de validation finale (par tâche)

```bash
test -f docs/<fichier>.md && wc -l docs/<fichier>.md
```
+ relecture rapide pour vérifier qu'aucune section "TODO" ou "à compléter" ne subsiste.
