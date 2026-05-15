# Couverture de tests complète — PCR Manager

## Objectif

Ajouter une **couverture de tests complète** au projet PCR Manager (Tauri 2 + React 18 + TS + Rust). Le projet a été généré dans la session précédente : le code est en place, **aucun test n'existe encore**. La pile est :

- **Frontend** : React 18, TypeScript, Vite, Tailwind. `vitest@^1.1.0` est déjà dans `devDependencies`. **Manque** : `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, et la config vitest.
- **Backend** : Rust 2021 dans `src-tauri/`. Crates dispo dans `Cargo.toml` : `tauri@2`, `rusqlite@0.31` (feature `bundled-sqlcipher-vendored-openssl`), `webauthn-rs@0.5`, `serde`, `chrono`, `anyhow`, `thiserror`, `directories`, `parking_lot`, `uuid`. Aucun crate de test ajouté.

## Repo

- **Cwd absolue** : `C:\work\PCR Manager\.claude\worktrees\dreamy-villani-248f39`
- **OS** : Windows 11, PowerShell. Le `Bash` tool est disponible aussi.
- **Cargo NON installé** sur la machine de dev : les tests Rust doivent être écrits mais leur validation se limite à `cargo check` quand cargo n'est pas trouvable → rapporter sans bloquer. Les tests TypeScript sont validés avec `npx vitest run --reporter=basic` (doit passer 100%).

## État actuel du code (à ne pas réécrire)

### Frontend — fichiers et exports clés à tester

`src/lib/status.ts` (29 lignes) :
```ts
export type StatusColor = 'valide' | 'a_prevoir' | 'en_retard' | 'non_applicable';

export function statusFromDate(
  deadlineIso: string | null | undefined,
  alertMonths: number = 1
): StatusColor {
  if (!deadlineIso) return 'non_applicable';
  const now = new Date();
  const deadline = new Date(deadlineIso);
  if (Number.isNaN(deadline.getTime())) return 'non_applicable';
  if (deadline < now) return 'en_retard';
  const alertThreshold = new Date(now);
  alertThreshold.setMonth(alertThreshold.getMonth() + alertMonths);
  if (deadline <= alertThreshold) return 'a_prevoir';
  return 'valide';
}

export const statusToBadgeVariant: Record<StatusColor, 'ok' | 'warn' | 'danger' | 'neutral'> = {
  valide: 'ok',
  a_prevoir: 'warn',
  en_retard: 'danger',
  non_applicable: 'neutral',
};
```

`src/lib/habilitation.ts` (10 lignes) :
```ts
import type { HabilitationStatut } from '../types/domain';
export const habilitationToBadge: Record<
  HabilitationStatut,
  { label: string; variant: 'ok' | 'warn' | 'neutral' }
> = {
  validee: { label: 'Validee', variant: 'ok' },
  partielle: { label: 'Partielle', variant: 'warn' },
  non_validee: { label: 'Non validee', variant: 'neutral' },
};
```

`src/lib/cn.ts` :
```ts
export function cn(...args: (string | false | null | undefined)[]): string { /* concat truthy strings with space */ }
```

`src/lib/api.ts` (228 lignes) : wrapper typé autour de `invoke` (depuis `@tauri-apps/api/core`). Forme `api.<domain>.<method>(args)`. Domaines : `ping`, `db.init`, `etablissement.{list,get,create,update,remove}`, `travailleur.{list,get,create,update,remove}`, `habilitation.{get,update}`, `competence.{list_refs,list_for_travailleur,set}`, `appareil.{list,get,create,update,remove}`, `verification.{list,create}`, `controle_qualite.{list,create,realiser}`, `document.{list,upload,open}`, `passkey.{register_start,register_finish,auth_start,auth_finish,has_passkey}`. Chaque méthode appelle `invoke<T>('snake_case_name', args)`.

### UI primitives (à tester avec @testing-library/react)

`src/components/ui/` contient (forwardRef + variants Tailwind) :
- `Button.tsx` — variants : default/primary/ghost/danger-ghost, sizes : default/sm/icon.
- `Badge.tsx` — variants : ok/warn/danger/neutral/accent + icône optionnelle.
- `Card.tsx` — exports `Card`, `CardHead`, `CardBody`, `CardTitle`.
- `Dot.tsx` — variants ok/warn/danger/neutral.
- `FormField.tsx` — exports `Field`, `Label`, `Input`, `Select`, `Textarea`.
- `KpiTile.tsx` — props `label`, `value`, `tone` ('default'|'ok'|'warn'|'danger'), `footer`.
- `PillFilter.tsx` — options `Array<{value,label}>`, `value`, `onChange(value)`.
- `Table.tsx` — exports `Table`, `THead`, `TBody`, `TR`, `TH`, `TD`.
- `Tabs.tsx` — exports `Tabs`, `TabList`, `Tab`, `TabPanel` (state-driven via prop `value` ou interne).
- `index.ts` — re-exports.

### Layout

`src/components/layout/` : `AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`. Sidebar contient les 5 liens NavLink vers `/`, `/etablissement`, `/travailleurs`, `/appareils`, `/actions`. Topbar : breadcrumb + search.

### Modules

`src/modules/{dashboard,etablissement,travailleurs,appareils,actions}/*.tsx`. Chaque module utilise `useQuery` (TanStack Query 5) avec `api.<domain>.list/get`. Le K-Bis utilise `api.document.{upload,open}`.

### Backend Rust — fichiers et fonctions clés

`src-tauri/src/`:
- `db.rs` — fonction `init_db(app_data_dir: &Path) -> Result<Connection>` : ouvre `pcr_manager.db` avec SQLCipher (`PRAGMA key`), applique les migrations depuis `migrations/V1__initial.sql` (peut être lu via `include_str!`). Test cible : DB en mémoire (`:memory:`) sans SQLCipher avec `Connection::open_in_memory()` + apply schema → vérifier `passkey`, `etablissement`, etc. existent.
- `models.rs` — structs serde (Etablissement, Travailleur, Habilitation, Appareil, etc.) mirror du schéma.
- `commands/etablissement.rs`, `travailleur.rs`, `appareil.rs`, `habilitation.rs`, `competence.rs`, `verification.rs`, `controle_qualite.rs`, `document.rs` — commandes Tauri prenant `State<DbConnection>` et retournant `Result<T, String>`. La logique pure (mapping SQL ↔ struct) peut être extraite et testée en isolation.
- `auth.rs` — webauthn-rs. Tests d'unité limités (registration ceremony nécessite un challenge serveur + client → tests d'intégration plutôt).

### Migration SQL

`src-tauri/migrations/V1__initial.sql` : reprend `schema.sql` avec `appareil` AVANT `competence_travailleur`. Tables, triggers `trg_*_updated`, trigger `trg_generer_cq_internes`, seed `competence_ref` (9 lignes), vue `v_prochaine_verification`.

## Stratégie de tests demandée

### Frontend (Vitest + RTL)

1. **Setup Vitest** :
   - `vitest.config.ts` : env `jsdom`, `globals: true`, `setupFiles: ['./src/test/setup.ts']`, alias éventuels.
   - `src/test/setup.ts` : `import '@testing-library/jest-dom'` + extensions, mock global de `@tauri-apps/api/core`.
   - `src/test/test-utils.tsx` : `renderWithProviders(ui)` qui wrap dans `QueryClientProvider` (avec un fresh `QueryClient` à `retry: false, gcTime: 0`) + `MemoryRouter`.
   - `package.json` : ajouter scripts `test`, `test:run`, `test:ui`, `test:coverage`. Ajouter devDeps `@testing-library/react@^14`, `@testing-library/jest-dom@^6`, `@testing-library/user-event@^14`, `jsdom@^24`, `@vitest/coverage-v8@^1`.

2. **Tests unitaires lib (pure logic)** :
   - `src/lib/__tests__/status.test.ts` : statusFromDate sur null, undefined, '', date passée, date dans 1 jour, date dans 2 mois (alert default 1 → valide), date dans 2 mois avec alertMonths=3 (→ a_prevoir), date invalide '2026-13-99'. Tester `statusToBadgeVariant` (couvre les 4 valeurs).
   - `src/lib/__tests__/habilitation.test.ts` : couvre les 3 entrées du map.
   - `src/lib/__tests__/cn.test.ts` : cn('a', false, null, 'b') → 'a b', cn() → '', cn(undefined) → ''.
   - `src/lib/__tests__/api.test.ts` : importer `api`, mocker `invoke`, vérifier qu'au moins 3 méthodes (`ping`, `etablissement.list`, `travailleur.create`) appellent `invoke` avec le bon nom + bons args.

3. **Tests composants UI** :
   - Un fichier par primitive sous `src/components/ui/__tests__/`. Vérifier : rendu de base (par défaut), props variant (snapshot des classes via `toHaveClass`), interactivité (Button onClick, PillFilter change la sélection, Tabs change le panneau).

4. **Tests layout** :
   - `src/components/layout/__tests__/Sidebar.test.tsx` : renderWithProviders + MemoryRouter sur `/travailleurs` → vérifier que le lien Travailleurs a la classe active.
   - `Topbar.test.tsx` : rendu du breadcrumb et du champ search.
   - `AppShell.test.tsx` : rendu de l'outlet.

5. **Tests modules (smoke + interactions clés)** :
   - Pour chaque module : `renderWithProviders` avec `api` mocké, attendre via `waitFor` que la table/contenu s'affiche.
   - Dashboard : KPI grid avec valeurs mockées.
   - Etablissement : formulaire pré-rempli, bouton "Charger K-Bis" déclenche `api.document.upload`.
   - Travailleurs : liste → click sur une ligne → fiche → 2 onglets cliquables → onglet Habilitation affiche les 5 items.
   - Appareils : liste → fiche → sections vérification + CQ.
   - Actions : pill filter "En retard" filtre la liste.

### Backend (cargo test)

1. **Setup test infrastructure** :
   - `src-tauri/Cargo.toml` : ajouter sous `[dev-dependencies]` : `tempfile = "3"`, `serial_test = "3"` (pour les tests touchant un fichier DB partagé), `rusqlite = { version = "0.31", features = ["bundled"] }` pour les tests (variante non chiffrée).
   - Note : SQLCipher impose une clé. Les tests d'intégration peuvent **ouvrir une DB en mémoire NON chiffrée** (feature `bundled` au lieu de `bundled-sqlcipher-vendored-openssl`) pour tester la logique. Le chiffrement est testé séparément ou laissé en TODO.

2. **Tests unitaires Rust** :
   - `src-tauri/src/db.rs` (in-file `#[cfg(test)]`) : test `apply_migrations` sur `Connection::open_in_memory()` → vérifier que toutes les tables existent (`SELECT name FROM sqlite_master WHERE type='table'`) et que `competence_ref` a 9 lignes.
   - `src-tauri/src/commands/etablissement.rs` : extraire un helper `insert_etablissement(conn, &input) -> Result<i64>` pur, testé sur in-memory DB. Round-trip insert + list.
   - Idem pour `travailleur`, `appareil`. Test du trigger `trg_generer_cq_internes` : insérer un CQ externe, vérifier que 3 internes apparaissent avec les bonnes dates J+90/180/270.
   - `src-tauri/src/auth.rs` : si une fonction de format/conversion existe (ex: `credential_to_db_row`), tester l'aller-retour. Sinon, laisser un test placeholder annoté `#[ignore]` qui documente le besoin.

3. **Pas de test webauthn end-to-end** (trop dépendant d'un client réel).

## Contraintes strictes

- **SCOPE STRICT par tâche** : chaque tâche liste les fichiers autorisés à créer/modifier. Toute autre modification est interdite.
- **NE PAS toucher** : `cahier_des_charges_radioprotection_v2.md`, `schema.sql` (original), `design-mockup/**`, `STRUCTURE.md`, `LICENSE`, `.gitignore`, `README.md`, `.plan/sujet.md`, `.plan/sujet_tests.md`, `.plan/plan.json` (ancien), `.plan/execution_log.md`.
- **NE PAS toucher** au code applicatif existant (`src/components/**`, `src/modules/**`, `src/lib/**`, `src/types/**`, `src-tauri/src/**`, `src-tauri/migrations/**`) SAUF :
  - Ajouter une annotation `#[cfg(test)] mod tests { ... }` à la fin de fichiers Rust (db.rs, commands/*.rs) — autorisé uniquement si la tâche le mentionne explicitement.
  - Toute refactor non-trivial est INTERDITE. Si un test nécessite d'extraire une fonction, RAPPORTER sans modifier — ajouter un test annoté `#[ignore]` à la place.
- **Pas de Co-Authored-By dans les commits** (user kgalaxie84).
- **Validation par tâche** : chaque tâche doit lancer la commande de validation finale (typiquement `npx vitest run <chemin du nouveau fichier>` ou `npx vitest run --reporter=basic`).
- **Cargo absent** : pour les tâches Rust, validation = `cargo check --manifest-path src-tauri/Cargo.toml --tests` SI cargo trouvable, sinon rapporter "cargo absent — tests écrits non validés localement". Ne PAS tenter d'installer Rust.
- **Pas de dev server lancé.** Les commandes longues ne sont pas autorisées.
- Toutes les commandes sont compatibles Windows (`Bash` tool ou `PowerShell`). Préférer le `Bash` tool pour les commandes Unix-style.

## Plan attendu (ordre)

1. **Setup Vitest + RTL + jsdom + test utils** : `vitest.config.ts`, `src/test/setup.ts`, `src/test/test-utils.tsx`, mises à jour `package.json` (scripts + devDeps), `npm install`. Validation : `npx vitest run --reporter=basic` (0 tests OK = "no test files found" toléré).
2. **Tests lib pure** : status, habilitation, cn, api (avec mock invoke). 4 fichiers `.test.ts`. Validation : `npx vitest run src/lib`.
3. **Tests UI primitives — batch 1** : Button, Badge, Card, Dot, KpiTile. Validation : `npx vitest run src/components/ui`.
4. **Tests UI primitives — batch 2** : FormField, PillFilter, Tabs, Table. Validation : `npx vitest run src/components/ui`.
5. **Tests layout** : Sidebar, Topbar, AppShell. Validation : `npx vitest run src/components/layout`.
6. **Tests modules — Dashboard + Etablissement + Actions** (les plus simples). Validation : `npx vitest run src/modules/dashboard src/modules/etablissement src/modules/actions`.
7. **Tests modules — Travailleurs** (le plus complexe : 2 onglets + sous-fiche compétences). Validation : `npx vitest run src/modules/travailleurs`.
8. **Tests modules — Appareils** (vérifs + CQ). Validation : `npx vitest run src/modules/appareils`.
9. **Setup Rust dev-deps + tests db.rs** : Cargo.toml devdeps + `#[cfg(test)]` dans db.rs (migrations apply, tables count, competence_ref seed). Validation : `cargo check --manifest-path src-tauri/Cargo.toml --tests` si dispo.
10. **Tests Rust commands** : tests dans commands/etablissement.rs, travailleur.rs, appareil.rs, controle_qualite.rs (trigger CQ internes). Validation : `cargo check --tests` si dispo.
11. **Rapport coverage + cleanup** : lancer `npx vitest run --coverage` (générer rapport), rapporter % couverture par fichier. Vérifier que tous les tests passent.

Chaque tâche = autonome, mentionne chemins absolus, SCOPE STRICT, commande de validation, et critère de succès (X tests passent).
