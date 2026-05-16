# Roadmap — Reste à faire

État au 2026-05-17. Le projet est scaffolé à 100% (frontend + backend + DB + auth + tests + docs) **et l'installer NSIS Windows est généré**.

> Mise à jour 2026-05-17 :
> - ✅ `.editorconfig` + `.gitattributes` LF/UTF-8 ajoutés.
> - ✅ Audit React `{int && <JSX>}` : 16 patterns inspectés, 1 corrigé (`utilisation_partagee` dans `AppareilsList`).
> - ✅ Fix types implicites `VerifRow`/`CycleRow` + garde `null` sur `date_realisation` (`AppareilFiche`).
> - ✅ **Bibliothèque de compétences** : commandes Rust `competence_ref_create/update/delete`, wrappers `api.ts`, page CRUD `CompetencesList.tsx` (modales création / édition / suppression avec confirmation), route `/competences`, entrée Sidebar `BookOpen` — 6 tests RTL.
> - ✅ **CI GitHub Actions** : `.github/workflows/ci.yml` — 4 jobs (lint+typecheck, test-frontend, test-rust, build-windows avec Strawberry Perl + upload artifact NSIS).
> - ✅ `cargo test --lib` : 9/9 tests Rust revalidés après ajout des nouvelles commandes.
> - ✅ TypeScript : 0 erreur (`tsc --noEmit`).
> - ✅ Vitest : 258/258 tests (26 fichiers).

## État actuel (rappel)

| Couche | Statut |
|---|---|
| Frontend (React 18 + TS + Tailwind + Vite) | ✅ Buildable, 258/258 tests |
| Backend (Tauri 2 + Rust + SQLCipher + Passkey) | ✅ 9/9 tests `#[cfg(test)]` |
| Migrations SQL (V1) | ✅ 10 tables + vue + 5 triggers |
| TypeScript (`tsc --noEmit`) | ✅ 0 erreur |
| `vite build` | ✅ OK (266 KB JS / 13 KB CSS) |
| Documentation `docs/` | ✅ 9 fichiers |
| CI GitHub Actions | ✅ `.github/workflows/ci.yml` (4 jobs) |
| Installer Windows NSIS | ✅ `PCR Manager_0.1.0_x64-setup.exe` (4.45 MB) |
| Git | ✅ Commits propres, working tree clean |

---

## 🔴 Bloquant pour livraison

### 1. Smoke test fonctionnel de l'app

```powershell
$env:PATH = "C:\Strawberry\perl\bin;C:\Strawberry\c\bin;$env:PATH"
npm run tauri:dev
```

Scénarios à valider manuellement :
- [ ] **Premier lancement** : aucune passkey enregistrée → onboarding "Créer une passkey" (Windows Hello / PIN).
- [ ] **Second lancement** : authentification passkey → ouverture app.
- [ ] **Établissement** : créer un établissement, uploader un PDF K-Bis, le rouvrir.
- [ ] **Travailleurs** : créer 1 travailleur, remplir les 2 onglets (Données / Habilitation), valider 9/9 compétences sur un appareil.
- [ ] **Appareils** : créer 1 appareil, ajouter une vérification annuelle interne, créer un CQ externe → vérifier que les 3 CQ internes apparaissent à J+90 / J+180 / J+270.
- [ ] **Compétences** : ouvrir `/competences`, ajouter une compétence, éditer son libellé, supprimer → vérifier que la liste se met à jour.
- [ ] **Actions** : tous les filtres (Tout / En retard / À venir / Formation / Contrôle / Visite med) renvoient des résultats cohérents.
- [ ] **Dashboard** : alertes par catégorie + statuts couleur (vert/orange/rouge).

### 2. Tester l'installation sur une machine propre

- [ ] Installer `PCR Manager_0.1.0_x64-setup.exe` sur une VM / machine sans les outils dev.
- [ ] Vérifier UAC, désinstallation propre via Paramètres Windows.
- [ ] Code signing (certificat EV pour éviter SmartScreen) — voir `docs/build-deploy.md`.

---

## 🟡 Important

### 3. Confirmer la gestion de la clé SQLCipher

Le code généré (`src-tauri/src/db.rs`) doit :
- Générer une clé maître au premier lancement (`uuid::Uuid::new_v4()` ou `rand`).
- La stocker dans un **keychain OS** (DPAPI sur Windows, Keychain sur macOS) — pas en clair dans `AppData`.
- La récupérer aux lancements suivants pour `PRAGMA key = '<key>'`.

**À vérifier** : ouvrir `src-tauri/src/db.rs` et confirmer que la clé n'est PAS stockée dans un fichier en clair. Si ce n'est pas le cas, ajouter `tauri-plugin-stronghold` ou implémenter DPAPI via `windows` crate.

### 4. Audit npm + couverture tests

```powershell
npm audit         # 10 vulnérabilités (4 moderate, 6 high)
npm audit fix     # fix non-breaking d'abord
npx vitest run --coverage     # rapport v8 → coverage/index.html
npm run lint                  # 0 warning (max-warnings 0)
```

**À traquer** :
- Statements coverage < 70% pour les modules complexes (`src/modules/**`).
- Lignes non testées dans `src/lib/api.ts` (maintenant ~240 lignes avec les nouvelles méthodes compétences).

### 5. Définir les 9 compétences réelles

La migration `V1__initial.sql` seed `competence_ref` avec 5 libellés génériques ("Compétence 5..9").
**La page `/competences` permet maintenant de les modifier directement dans l'app** sans migration SQL.
Alternativement, créer une **migration V2** si un déploiement a déjà eu lieu.

---

## 🟢 Améliorations

### 6. Quick wins restants (< 30 min chacun)

- [ ] `npm audit fix` (non-breaking).
- [ ] Ajouter un `LICENSE` badge dans `README.md` (le fichier `LICENSE` existe déjà).
- [ ] Configurer Husky + lint-staged pour bloquer les commits avec erreurs TS/lint.

### 7. Tests E2E (Playwright + Tauri)

Vitest+RTL teste les composants en isolation. Pour valider les flows complets (passkey + DB + UI), envisager **Playwright** avec [`tauri-driver`](https://tauri.app/develop/tests/webdriver/). 2-3 scénarios suffisent :
- Login passkey → dashboard.
- Créer travailleur + habilitation.
- Ajouter CQ externe → vérifier génération des 3 CQ internes.

### 8. Module Actions — validation des filtres par catégorie

Les filtres "Formation" / "Contrôle" / "Visite méd." sont déclarés dans le `PillFilter` mais leur logique de filtrage n'a pas été testée intégrativement avec un jeu de données mixte. À valider :
- Avec des actions de chaque catégorie en DB, chaque filtre n'affiche que les bonnes.
- Le compteur dans la sidebar (badge avec nombre d'alertes) est cohérent.

### 9. Phase 2 du cahier des charges

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

### 10. Cloche de notifications — panneau au clic

**État actuel** : le badge rouge dans `Topbar.tsx` est fonctionnel (compte en live les vérifications techniques en retard + CQ dont `date_echeance` est dépassée). Le clic sur la cloche ne fait rien (`<button>` sans `onClick`).

**À développer** :
- Composant `NotificationDropdown` (positionnement absolu sous la cloche, `useRef` + `useClickOutside` pour fermer au clic extérieur).
- Liste des items en retard avec lien direct (vérifs → fiche Appareil, CQ → page Actions).
- Badge avec le nombre exact d'alertes afloat sur la cloche.

**Estimation** : ~2-3h. Les données sont déjà fetchées dans `Topbar.tsx` (`verifications`, `controleQualites`) — pas de nouvel appel API nécessaire.

**Fichiers concernés** :
- `src/components/layout/Topbar.tsx` (ajouter onClick + état ouvert/fermé)
- `src/components/layout/NotificationDropdown.tsx` (nouveau)
- `src/hooks/useClickOutside.ts` (nouveau ou réutiliser si déjà présent)

### 11. Internationalisation (i18n) — optionnel

Tout est en français hardcodé. Si une version anglophone est envisagée, intégrer `react-i18next` avant que le volume de chaînes ne devienne trop important.

### 12. macOS DMG

Nécessite un runner macOS (impossible depuis Windows). À déléguer à GitHub Actions (le job `build-windows` dans `.github/workflows/ci.yml` est le modèle — dupliquer avec `macos-latest`).

---

## Référence rapide

| Commande | Effet |
|---|---|
| `npm install` | Installe les deps frontend |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest watch mode |
| `npm run test:run` | Vitest single run (258 tests) |
| `npm run test:coverage` | Vitest + coverage v8 |
| `npm run lint` | ESLint (0 warning toléré) |
| `npm run dev` | `tauri dev` (app desktop en dev) |
| `npm run tauri:build` | Tauri build (installeurs) — nécessite Strawberry Perl dans PATH |
| `npx vite build` | Build frontend seul (vers `dist/`) |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Type-check Rust |
| `cargo test --manifest-path src-tauri/Cargo.toml --lib` | 9 tests Rust (nécessite Strawberry Perl dans PATH) |
