# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Platform

**macOS + iOS uniquement.** Ne pas écrire de code Windows, ne pas suggérer de solutions Windows. Le backend Tauri tourne sur macOS, l'app compagnon sur iOS.

## Commands

### Development
```bash
npm run tauri:dev        # Full Tauri dev (backend + frontend HMR)
npm run dev              # Vite frontend only (no Rust backend)
```

### Build
```bash
# REQUIRED: Strawberry Perl must be used — Git Bash Perl is incomplete and causes OpenSSL to fail
PERL="C:/Strawberry/perl/bin/perl.exe" npx tauri build
```
If you see an error like `Could not find Perl` or OpenSSL fails to configure, this is the fix.

### Tests
```bash
npm run test:run         # Vitest single pass
npm test                 # Vitest watch mode
npm run test:coverage    # Coverage report

# Rust tests
cargo test --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml db::tests         # single module
cargo test --manifest-path src-tauri/Cargo.toml auth_iphone::tests
cargo test --manifest-path src-tauri/Cargo.toml ecies::tests
```

### Lint / Typecheck
```bash
npm run lint
npm run typecheck
```

## Architecture

**Tauri 2** desktop app — React 18 + TypeScript frontend, Rust backend, SQLCipher database.

```
src/                    React frontend (Vite)
  lib/api.ts            All Tauri IPC calls (invoke wrappers)
  pages/                Route-level components
  components/           Reusable UI components
src-tauri/
  src/
    lib.rs              App entry: plugin setup, .setup(), invoke_handler![]
    db.rs               DB state, migrations, key management
    auth_iphone.rs      Wi-Fi pairing & auth protocol (QR code + HTTP local + ECIES key-wrapping)
    ecies.rs            ECIES-P256-HKDF-SHA256-AES256GCM (encrypt only)
    models.rs           Shared Rust structs
    validators.rs       Input validation helpers
    commands/           One file per domain (établissement, travailleur, etc.)
  migrations/           SQL migration files (V1–V8)
docs/                   Architecture, security, DB schema, testing, build-deploy guides
```

## Critical Patterns

### DB access in commands
**Always** use `state.get()?` — never `state.conn.lock()`:
```rust
pub async fn my_command(state: tauri::State<'_, DbState>) -> Result<_, String> {
    let conn = state.get()?;   // Returns MappedMutexGuard<Connection>; errors if DB not open
    // use conn...
}
```
`DbState.conn` is `Mutex<Option<Connection>>`. It is `None` until iPhone authentication delivers the DB key (iPhone mode). `state.get()` returns an error that propagates to the frontend when called before auth.

### Auth guard
Every data command must start with:
```rust
ensure_authenticated(&session)?;
```
This checks the in-memory session token (set after iPhone challenge verification).

### Adding a Tauri command
1. Write `#[tauri::command]` function in `commands/<domain>.rs`
2. Add it to `invoke_handler![]` in `lib.rs`
3. Add an `invoke("command_name", args)` wrapper in `src/lib/api.ts`

## Security Model

### iPhone mode vs Legacy mode
Determined at startup by `db::has_wrapped_key(app)`:

- **Legacy mode** (`wrapped_db_key.bin` absent): DB key from macOS Keychain. DB opens immediately.
- **iPhone mode** (`wrapped_db_key.bin` present): DB key is ECIES-wrapped with the iPhone's P-256 Key Agreement public key. DB stays `None` until auth succeeds and the iPhone decrypts and returns the key.

Transition to iPhone mode happens in `activate_iphone_key_wrapping()`:
1. Generate random 32-byte DB key (`generate_db_key`)
2. ECIES-encrypt it with iPhone's `ka_public_key` → `wrapped_db_key.bin.tmp`
3. `PRAGMA rekey` on the open connection
4. Rename `.tmp` → `.bin` (atomic)

### ECIES bundle format
```
[eph_pub_x963 (65 bytes)] || [nonce AES-GCM (12 bytes)] || [ciphertext + GCM tag (N+16 bytes)]
```
HKDF-SHA256: `salt = eph_pub_bytes`, `info = "PCRManager-v1-db-key"`, 32-byte output key.

### `pairings_meta.json` (unencrypted bootstrap file)
Stores device names + signing public keys + KA public keys + auth counters.  
**Must be kept in sync with the `iphone_pairing` DB table** whenever pairings change.  
Used to verify ECDSA challenges before the DB is open.

## iPhone Auth Protocol (v2)

**Transport**: HTTP TCP local — Mac ouvre un port aléatoire, iPhone fait un POST vers `host:port` lu dans le QR. Mac et iPhone doivent être sur le même réseau Wi-Fi.

**Pairing** (QR scan sur iPhone):
- iPhone envoie `iphone_ka_public_key` (P-256 x963, base64url) dans le POST `/pair`
- Mac stocke dans `iphone_pairing.ka_public_key` et `pairings_meta.json`

**Authentication** (QR scan sur iPhone):
- QR contient `wrapped_key=<base64url>` (le bundle ECIES pour la clé KA de cet iPhone)
- iPhone déchiffre le bundle dans le Secure Enclave → obtient la clé DB → inclut `db_key` dans le POST `/auth`
- Mac vérifie la signature ECDSA, puis ouvre la DB via `db::open_and_migrate(app, Some(&db_key))`
- `DbState.conn` passe à `Some(conn)`, débloquant toutes les commandes de données

**iOS à implémenter** (repo séparé, non encore fait):
- Créer une `SecureEnclave.P256.KeyAgreement.PrivateKey` lors du pairing
- Envoyer `iphone_ka_public_key` dans le POST de pairing
- En auth : ECIES-déchiffrer le `wrapped_key` du QR, inclure `db_key` dans le POST (voir l'en-tête de `ecies.rs` pour le code CryptoKit équivalent)
