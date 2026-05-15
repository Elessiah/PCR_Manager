# Backend Rust

## Crate & édition

**Tauri 2** — plateforme desktop multi-plateforme. **Rust 2021**.

Dépendances clés avec versions exactes :
- `tauri` 2 : runtime
- `rusqlite` 0.31 : accès SQLite avec features `bundled-sqlcipher-vendored-openssl`, `chrono`
- `serde` 1 : sérialisation JSON avec feature `derive`
- `chrono` 0.4 : dates avec feature `serde`
- `anyhow` 1 : gestion erreurs contextualisées
- `thiserror` 1 : derive Error pour types d'erreur
- `directories` 5 : localisation répertoires app OS
- `parking_lot` 0.12 : mutex performant (remplace std::sync::Mutex)
- `webauthn-rs` 0.5 : implémentation WebAuthn/Passkey avec feature `danger-allow-state-serialisation`
- `uuid` 1 : identifiants uniques avec features `v4`, `serde`
- `base64` 0.22 : encodage base64
- `url` 2 : parsing URL

## Organisation des modules

| Fichier | Rôle |
|---------|------|
| `main.rs` | Point d'entrée Tauri, builder, enregistrement commandes |
| `lib.rs` | Exports, commande `ping`, orchestration setup |
| `db.rs` | Ouverture connexion SQLite, migrations, type `DbState` |
| `auth.rs` | Passkey WebAuthn registration/authentication, état `WebauthnState` |
| `models.rs` | Structs Serialize/Deserialize pour domaines (Établissement, Travailleur, Habilitation, etc.) |
| `commands/etablissement.rs` | CRUD établissements |
| `commands/travailleur.rs` | CRUD travailleurs |
| `commands/habilitation.rs` | Calcul habilitation avec logique metier |
| `commands/appareil.rs` | CRUD appareils |
| `commands/competence.rs` | Gestion compétences par travailleur/appareil |
| `commands/verification.rs` | CRUD vérifications techniques |
| `commands/controle_qualite.rs` | CRUD contrôles qualité |
| `commands/document.rs` | Listing, upload, suppression documents |

## État partagé

`DbState` enveloppe une connexion SQLite :

```rust
pub struct DbState {
    pub conn: Mutex<Connection>,
}
```

Type réel : `parking_lot::Mutex<rusqlite::Connection>`. Géré par `tauri::Builder::manage(DbState { ... })` dans `lib.rs::run()`.

Pattern d'accès dans les commandes :
```rust
let conn = state.conn.lock();  // acquiert verrou, retourne &Connection
// utiliser conn...
// drop implicite en fin de scope
```

État WebAuthn séparé `WebauthnState` gère défi-réponse intermédiaire en mémoire :
- `reg_states : HashMap<String, PasskeyRegistration>` → état de registration
- `auth_states : HashMap<String, PasskeyAuthentication>` → état d'authentification

## Pattern des commandes

Signature :
```rust
#[tauri::command]
pub async fn foo(
    input1: Type1,
    input2: Type2,
    state: tauri::State<'_, DbState>,
) -> Result<Output, String>
```

Toutes les commandes sont `async`. Erreurs converties en `String` :
```rust
conn.execute(...).map_err(|e| e.to_string())?
state.webauthn.start(...).map_err(|e| e.to_string())?
```

Enregistrement dans `lib.rs` via `tauri::generate_handler![...]`.

## Commandes Tauri publiques

### Utilitaires & DB

| Commande | Entrée | Sortie |
|----------|--------|--------|
| `ping` | — | `&'static str` ("pong") |
| `init_db` | `state: DbState` | `Result<(), String>` |

### Auth Passkey (WebAuthn)

| Commande | Entrée | Sortie |
|----------|--------|--------|
| `passkey_register_start` | `state: WebauthnState` | `Result<CreationChallengeResponse, String>` |
| `passkey_register_finish` | `reg_id: String, response: RegisterPublicKeyCredential, state: WebauthnState, db: DbState` | `Result<JsonValue, String>` |
| `passkey_auth_start` | `state: WebauthnState, db: DbState` | `Result<RequestChallengeResponse, String>` |
| `passkey_auth_finish` | `auth_id: String, response: PublicKeyCredential, state: WebauthnState, db: DbState` | `Result<JsonValue, String>` |

### Établissements

| Commande | Entrée | Sortie |
|----------|--------|--------|
| `etablissement_list` | `state: DbState` | `Result<Vec<Etablissement>, String>` |
| `etablissement_get` | `id: i64, state: DbState` | `Result<Etablissement, String>` |
| `etablissement_create` | `denomination: String, statut_juridique?: String, ..., state: DbState` | `Result<i64, String>` |
| `etablissement_update` | `id: i64, denomination: String, ..., state: DbState` | `Result<(), String>` |
| `etablissement_delete` | `id: i64, state: DbState` | `Result<(), String>` |

### Travailleurs

| Commande | Entrée | Sortie |
|----------|--------|--------|
| `travailleur_list` | `state: DbState` | `Result<Vec<Travailleur>, String>` |
| `travailleur_get` | `id: i64, state: DbState` | `Result<Travailleur, String>` |
| `travailleur_create` | `etablissement_id: i64, nom: String, prenom: String, ..., state: DbState` | `Result<i64, String>` |
| `travailleur_update` | `id: i64, etablissement_id: i64, nom: String, prenom: String, ..., state: DbState` | `Result<(), String>` |
| `travailleur_delete` | `id: i64, state: DbState` | `Result<(), String>` |

### Habilitation

| Commande | Entrée | Sortie |
|----------|--------|--------|
| `habilitation_compute` | `travailleur_id: i64, state: DbState` | `Result<HabilitationStatus, String>` |

Retourne `HabilitationStatus { statut: "validee" \| "partielle" \| "non_validee", details: HabilitationDetails }`.

### Appareils

| Commande | Entrée | Sortie |
|----------|--------|--------|
| `appareil_list` | `state: DbState` | `Result<Vec<Appareil>, String>` |
| `appareil_get` | `id: i64, state: DbState` | `Result<Appareil, String>` |
| `appareil_create` | `etablissement_id: i64, designation: String, ..., state: DbState` | `Result<i64, String>` |
| `appareil_update` | `id: i64, etablissement_id: i64, designation: String, ..., state: DbState` | `Result<(), String>` |
| `appareil_delete` | `id: i64, state: DbState` | `Result<(), String>` |

### Compétences

| Commande | Entrée | Sortie |
|----------|--------|--------|
| `competence_list` | `state: DbState` | `Result<Vec<CompetenceRef>, String>` |
| `competence_set` | `travailleur_id: i64, appareil_id: i64, competence_ref_id: i64, date_validation?: String, validated: i64, state: DbState` | `Result<(), String>` |
| `competence_get_for_travailleur` | `travailleur_id: i64, state: DbState` | `Result<Vec<CompetenceTravailleur>, String>` |

### Vérifications techniques

| Commande | Entrée | Sortie |
|----------|--------|--------|
| `verification_list` | `state: DbState` | `Result<Vec<VerificationTechnique>, String>` |
| `verification_get` | `id: i64, state: DbState` | `Result<VerificationTechnique, String>` |
| `verification_create` | `appareil_id: i64, type_: String, date_realisation: String, ..., state: DbState` | `Result<i64, String>` |
| `verification_update` | `id: i64, appareil_id: i64, type_: String, ..., state: DbState` | `Result<(), String>` |
| `verification_delete` | `id: i64, state: DbState` | `Result<(), String>` |

### Contrôles qualité

| Commande | Entrée | Sortie |
|----------|--------|--------|
| `controle_qualite_list` | `state: DbState` | `Result<Vec<ControleQualite>, String>` |
| `controle_qualite_get` | `id: i64, state: DbState` | `Result<ControleQualite, String>` |
| `controle_qualite_create` | `appareil_id: i64, type_: String, date_echeance: String, statut: String, ..., state: DbState` | `Result<i64, String>` |
| `controle_qualite_update` | `id: i64, appareil_id: i64, type_: String, ..., state: DbState` | `Result<(), String>` |
| `controle_qualite_delete` | `id: i64, state: DbState` | `Result<(), String>` |

### Documents

| Commande | Entrée | Sortie |
|----------|--------|--------|
| `document_list` | `state: DbState` | `Result<Vec<Document>, String>` |
| `document_get` | `id: i64, state: DbState` | `Result<Document, String>` |
| `document_upload` | `app_handle: AppHandle, entity_type: String, entity_id: i64, type_document: String, nom_fichier: String, source_path: String, state: DbState` | `Result<Document, String>` |
| `document_delete` | `id: i64, state: DbState` | `Result<(), String>` |

## Auth Passkey

**Registration flow** :
1. `passkey_register_start()` → génère défi WebAuthn, stocke état en mémoire avec UUID `reg_id`
2. Client effectue opération biométrique/PIN
3. `passkey_register_finish(reg_id, response)` → vérifie, sérialise credential en JSON, insère en DB table `passkey` (colonnes : `credential_id` base64, `public_key` JSON, `sign_count`, `label`)

**Authentication flow** :
1. `passkey_auth_start()` → charge credentials de DB, génère défi, stocke état avec UUID `auth_id`
2. Client effectue opération biométrique/PIN
3. `passkey_auth_finish(auth_id, response)` → vérifie challenge, met à jour `sign_count` et `last_used_at` en DB

État intermédiaire : stocké en mémoire dans `WebauthnState` (HashMaps), généré par session WebAuthn, nettoyé après consommation.

## Gestion d'erreurs

À la frontière IPC (Tauri) : `Result<T, String>` — erreurs sérialisées JSON.

Internes :
- Erreurs DB : `rusqlite::Error` → `.map_err(|e| e.to_string())`
- Erreurs WebAuthn : `webauthn_rs::WebauthnError` → `.map_err(|e| e.to_string())`
- Erreurs contextualisées : `anyhow::Error` (avec `.context()`)
- Erreurs métier : `thiserror::Error` derive sur enums si besoin

Pas de panic en mode production — conversions String systématiques.

## Liens

- [database.md](./database.md) — schéma, tables, vues, migrations
- [frontend.md](./frontend.md) — intégration API via wrapper `api.ts`
- [security.md](./security.md) — WebAuthn, isolation d'état, SQLCipher
