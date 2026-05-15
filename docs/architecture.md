# Architecture

## Vue d'ensemble

PCR Manager est une application de gestion réglementaire basée sur Tauri 2, un framework desktop natif. Le frontend React 18 (TypeScript, Vite) s'exécute dans une webview et communique avec un backend Rust via des commandes IPC. Les données résident en SQLite local (chiffré SQLCipher), sans aucune connexion réseau. L'authentification utilise le standard WebAuthn (Passkey). Le déploiement produit un exécutable natif optimisé pour Windows, macOS et Linux.

## Diagramme

```text
┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│ React 18 + TS        │    │ Tauri Core (Rust)    │    │ SQLite + SQLCipher   │
│ Vite, Router, RQ     │◄──►│ commands/ + auth.rs  │◄──►│ pcr.db (AppData)     │
│ src/                 │IPC │ src-tauri/src/       │    │ __migrations table   │
└──────────────────────┘    └──────────────────────┘    └──────────────────────┘
```

## Couches et responsabilités

| Couche | Localisation | Rôle |
|--------|--------------|------|
| Primitives UI | `src/components/ui/` | Boutons, badges, tableaux, formulaires réutilisables. |
| Layout | `src/components/layout/` | AppShell contenant navigation, sidebar, topbar. |
| Modules métier | `src/modules/<domaine>/` | Pages par domaine : Dashboard, Établissement, TravailleursList/Fiche, AppareilsList/Fiche, Actions. |
| Lib pure (frontend) | `src/lib/` | api.ts (wrapper IPC), utilitaires (status, habilitation, cn). |
| Types partagés | `src/types/domain.ts` | Interfaces TypeScript (Établissement, Travailleur, Appareil, Document, etc.). |
| Commandes Tauri | `src-tauri/src/commands/` | Modules : établissement, travailleur, habilitation, compétence, appareil, vérification, contrôle qualité, document. |
| Auth | `src-tauri/src/auth.rs` | Gestion WebAuthn (Passkey), états `reg_states` et `auth_states`. |
| DB | `src-tauri/src/db.rs` | Ouverture SQLite, PRAGMA clé SQLCipher, migrations versionnées, DbState (Mutex). |
| Modèles Rust | `src-tauri/src/models.rs` | Structs `Serialize`/`Deserialize` Serde alignées aux types TS. |

## Flow d'une requête type — charger la liste des travailleurs

1. **UI (React)** : Le composant `TravailleursList.tsx` utilise TanStack React Query via `useQuery(['travailleurs'])`.
2. **QueryFn** : La fonction appelle `api.travailleur.list()` depuis `src/lib/api.ts`.
3. **Wrapper TS** : La méthode `invoke<Travailleur[]>('travailleur_list')` sérialise le message pour Tauri.
4. **Tauri IPC** : Le routeur Tauri achemine l'appel vers la commande Rust `travailleur_list` (registrée dans `lib.rs`).
5. **Commande Rust** : `commands::travailleur::travailleur_list()` reçoit `state: tauri::State<DbState>`, verrouille le `Mutex` (parking_lot), exécute la requête SQL et mappe les lignes en structs `Travailleur`.
6. **Sérialisation** : Le résultat `Result<Vec<Travailleur>, String>` est sérialisé JSON par Tauri.
7. **Cache RQ** : React Query cache le résultat et déclenche le ré-rendu du composant.

L'API Tauri expose également des commandes pour établissement, appareil, vérification technique, contrôle qualité, document et gestion des passkeys.

## Patterns et technologies clés

**Frontend** :
- React Router pour le routage SPA (récupère le segment d'URL pour la page active).
- TanStack React Query pour la mise en cache côté client et la gestion de l'état asynchrone.
- Tailwind CSS pour le styling utility-first.
- Vite pour le build/dev rapide.

**Backend** :
- Tauri Builder avec setup hook pour initialiser DB et état WebAuthn au démarrage.
- Parking_lot `Mutex<Connection>` pour le verrouillage thread-safe de la connexion SQLite.
- `rusqlite` pour les requêtes SQL typées avec paramètres.
- `webauthn-rs` pour la cryptographie WebAuthn.
- Serde pour la sérialisation/désérialisation JSON des structures.

## Bornes du système

- **Aucune connexion réseau** : toutes les données sont locales (SQLite).
- **Déploiement monolithique** : l'application build produit un installeur natif (.msi, .dmg, .AppImage).
- **Single-user** : une instance par utilisateur ; pas de synchronisation multi-instance.
- **Versionning DB** : migrations SQL versionnées (V1, V2…) tracées dans `__migrations`.
- **Répertoire données** : base de données stockée dans `AppLocalData/PCR Manager/pcr.db`.

## Démarrage et initialisation

À chaque lancement de l'application :
1. Tauri charge le main.rs qui appelle `pcr_manager_lib::run()` (lib.rs).
2. Le setup hook exécute `db::open_db()` pour ouvrir la connexion SQLite à `pcr.db`.
3. `run_migrations()` applique les migrations versionnées (V1__initial.sql) si non exécutées.
4. L'état `DbState` (Mutex<Connection>) est enregistré globalement via `app.manage()`.
5. `WebauthnState` (avec `Webauthn::new()`) est également initialisé pour la gestion des Passkeys.
6. La webview React charge et initialise React Query, Router et l'état global.

## Liens

- [database.md](./database.md) — schéma SQL, tables, vues, migrations.
- [backend.md](./backend.md) — détails commandes Rust, modèles Serde, interactions DB.
- [frontend.md](./frontend.md) — composants, modules métier, patterns React/TypeScript.
