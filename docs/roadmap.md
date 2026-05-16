# Roadmap — Reste à faire

État au 2026-05-16. Le projet est scaffolé à 100% (frontend + backend + DB + auth + tests + docs) **et l'installer NSIS Windows est généré**. Reste : smoke test fonctionnel, durcissement, Phase 2.

> Mise à jour 2026-05-16 :
> - ✅ Rust toolchain MSVC + Strawberry Perl 5.42 opérationnels.
> - ✅ `cargo test --lib` : 9/9 Rust passent ; `vitest run` : 192/192 TS passent.
> - ✅ Smart App Control désactivé (irréversible — accepté par l'utilisateur).
> - ✅ Boucle infinie `npm run build` ↔ `tauri.beforeBuildCommand` corrigée : `beforeBuildCommand: "vite build"` + scripts npm explicites (`tauri:build`, `tauri:dev`).
> - ✅ **Installer NSIS produit** : `src-tauri/target/release/bundle/nsis/PCR Manager_0.1.0_x64-setup.exe` (4.45 MB, build release 10m40).

## État actuel (rappel)

| Couche | Statut |
|---|---|
| Frontend (React 18 + TS + Tailwind + Vite) | ✅ Buildable, 192/192 tests |
| Backend (Tauri 2 + Rust + SQLCipher + Passkey) | ✅ Code écrit, 11 tests `#[cfg(test)]` non exécutés |
| Migrations SQL (V1) | ✅ 10 tables + vue + 5 triggers |
| TypeScript (`tsc --noEmit`) | ✅ 0 erreur |
| `vite build` | ✅ OK (266 KB JS / 13 KB CSS) |
| Documentation `docs/` | ✅ 9 fichiers (1460 lignes) |
| Git | ✅ 13 commits propres, working tree clean |

---

## 🔴 Bloquant pour livraison

### 1. Installer Rust toolchain et valider le backend

```powershell
winget install Rustlang.Rustup
rustup default stable
cargo --version  # >= 1.75
```

Puis depuis la racine du projet :
```powershell
cargo check --manifest-path src-tauri/Cargo.toml --tests
cargo test --manifest-path src-tauri/Cargo.toml
```

**Critères de succès** :
- `cargo check` : aucune erreur de compilation côté Rust.
- `cargo test` : les 11 tests `#[cfg(test)]` passent (migrations, CRUD round-trips, trigger `trg_generer_cq_internes`).

**Risque** : la feature `bundled-sqlcipher-vendored-openssl` de `rusqlite` requiert un compilateur C local (MSVC sur Windows). Si la build échoue, installer **Visual Studio Build Tools** avec le workload "Desktop development with C++".

### 2. Build Tauri complet (installeurs) — ✅ FAIT (Windows)

```powershell
# PATH doit contenir Strawberry Perl AVANT Git Bash pour compiler openssl-sys :
$env:PATH = "C:\Strawberry\perl\bin;C:\Strawberry\c\bin;$env:PATH"
npm run tauri:build       # produit target/release/bundle/nsis/*.exe
```

Résultat 2026-05-16 : `PCR Manager_0.1.0_x64-setup.exe` (4.45 MB) — non signé.

Reste :
- [ ] Tester l'installation de l'`.exe` sur une machine propre (UAC, désinstallation propre).
- [ ] Code signing (certificat EV pour éviter SmartScreen) — voir `docs/`.

**macOS DMG** : nécessite un runner macOS (impossible depuis Windows). À déléguer à GitHub Actions.

### 3. Smoke test fonctionnel de l'app

```powershell
npm run tauri dev
```

Scénarios à valider manuellement :
- [ ] **Premier lancement** : aucune passkey enregistrée → onboarding "Créer une passkey" (Windows Hello / PIN).
- [ ] **Second lancement** : authentification passkey → ouverture app.
- [ ] **Établissement** : créer un établissement, uploader un PDF K-Bis, le rouvrir.
- [ ] **Travailleurs** : créer 1 travailleur, remplir les 2 onglets (Données / Habilitation), valider 9/9 compétences sur un appareil.
- [ ] **Appareils** : créer 1 appareil, ajouter une vérification annuelle interne, créer un CQ externe → vérifier que les 3 CQ internes apparaissent à J+90 / J+180 / J+270.
- [ ] **Actions** : tous les filtres (Tout / En retard / À venir / Formation / Contrôle / Visite med) renvoient des résultats cohérents.
- [ ] **Dashboard** : alertes par catégorie + statuts couleur (vert/orange/rouge).

---

## 🟡 Important

### 4. Définir les 9 compétences réelles

La migration `V1__initial.sql` seed `competence_ref` avec :
1. Mise sous tension de l'appareil
2. Mise en marche de l'appareil
3. Enregistrement patient (vérification identité)
4. Détection patients à risque
5. Compétence 5 *(générique)*
6. Compétence 6 *(générique)*
7. Compétence 7 *(générique)*
8. Compétence 8 *(générique)*
9. Compétence 9 *(générique)*

**À faire** : remplacer les 5 derniers libellés par les vraies compétences définies avec le métier (cf. cahier des charges §5.5). Soit via une **migration V2** dédiée, soit en éditant directement la V1 si aucun déploiement n'a encore eu lieu.

### 5. Confirmer la gestion de la clé SQLCipher

Le code généré (`src-tauri/src/db.rs`) doit :
- Générer une clé maître au premier lancement (`uuid::Uuid::new_v4()` ou `rand`).
- La stocker dans un **keychain OS** (DPAPI sur Windows, Keychain sur macOS) — pas en clair dans `AppData`.
- La récupérer aux lancements suivants pour `PRAGMA key = '<key>'`.

**À vérifier** : ouvrir `src-tauri/src/db.rs` et confirmer que la clé n'est PAS stockée dans un fichier en clair. Si ce n'est pas le cas, ajouter `tauri-plugin-stronghold` ou implémenter DPAPI via `windows` crate.

### 6. Couverture des tests + audit qualité

```powershell
npx vitest run --coverage     # rapport v8, ouvre coverage/index.html
npm run lint                  # 0 warning (max-warnings 0 dans le script)
```

**À traquer** :
- Statements coverage par fichier `src/modules/**` (probablement < 70% pour les modules complexes).
- Lignes non testées dans `src/lib/api.ts` (227 lignes, seulement quelques méthodes testées).

### 7. Audit npm

```powershell
npm audit       # 10 vulnérabilités signalées (4 moderate, 6 high)
npm audit fix   # fix non-breaking
```

À évaluer cas par cas : les hauts probablement dans la chaîne ESLint 8 (déprécié) ou des transitive deps. Migration ESLint 9 envisageable.

---

## 🟢 Améliorations

### 8. CI GitHub Actions

Workflow `.github/workflows/ci.yml` avec :
- Matrice `windows-latest` + `macos-latest`.
- Steps : `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `cargo test --manifest-path src-tauri/Cargo.toml`.
- Job de release sur tag `v*` : `npm run tauri build` + upload des installeurs en artifact.

### 9. Audit React : recherche du pattern `{int && JSX}` ailleurs

Le bug corrigé dans `AppareilsList.tsx` (`{a.utilisation_partagee && <Badge>}` rendait `0`) peut exister ailleurs. Commande :
```bash
grep -rn '{[a-z_]\+ && <' src/modules src/components
```
Pour chaque match, vérifier que le LHS est bien un booléen (sinon : `Boolean(x) && ...` ou `x ? <X/> : null`).

### 10. Phase 2 du cahier des charges

Liste explicite (cf. `cahier_des_charges_radioprotection_v2.md` §10) :
- [ ] Export PDF des fiches et rapports
- [ ] Sauvegarde chiffrée exportable (`.zip` AES)
- [ ] Historique complet des modifications (audit trail)
- [ ] Notifications système (alertes OS natives)
- [ ] Gestion documentaire intégrée
- [ ] Journal d'audit réglementaire (ASN)
- [ ] Gestion des dosimètres personnels
- [ ] Statistiques conformité établissement
- [ ] Rapports régulateurs (ASN, etc.)
- [ ] Import / synchronisation entre postes (chiffré)

### 11. Module Actions — validation des filtres par catégorie

Les filtres "Formation" / "Contrôle" / "Visite méd." sont déclarés dans le `PillFilter` mais leur logique de filtrage n'a pas été testée intégrativement avec un jeu de données mixte. À valider :
- Avec des actions de chaque catégorie en DB, chaque filtre n'affiche que les bonnes.
- Le compteur dans la sidebar (badge avec nombre d'alertes) est cohérent.

### 12. Internationalisation (i18n) — optionnel

Tout est en français hardcodé. Si une version anglophone est envisagée, intégrer `react-i18next` avant que le volume de chaînes ne devienne trop important.

### 13. Tests E2E (Playwright + Tauri)

Vitest+RTL teste les composants en isolation. Pour valider les flows complets (passkey + DB + UI), envisager **Playwright** avec [`tauri-driver`](https://tauri.app/develop/tests/webdriver/). 2-3 scénarios suffisent (login, créer travailleur+habilitation, ajouter CQ).

---

## Quick wins (< 30 min chacun)

- `npm audit fix` (non-breaking).
- Ajouter `.editorconfig` (LF, UTF-8, 2 espaces).
- Configurer `.gitattributes` avec `* text=auto eol=lf` pour éliminer les warnings CRLF sur Windows.
- Ajouter un `LICENSE` + badge dans `README.md` (le fichier `LICENSE` existe déjà, le référencer).
- Configurer Husky + lint-staged pour bloquer les commits avec erreurs TS/lint.

---

## Référence rapide

| Commande | Effet |
|---|---|
| `npm install` | Installe les deps frontend |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest watch mode |
| `npm run test:run` | Vitest single run |
| `npm run test:coverage` | Vitest + coverage v8 |
| `npm run lint` | ESLint (0 warning toléré) |
| `npm run dev` | `tauri dev` (app desktop en dev) |
| `npm run build` | `tauri build` (installeurs) |
| `npx vite build` | Build frontend seul (vers `dist/`) |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Type-check Rust |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Tests Rust |
