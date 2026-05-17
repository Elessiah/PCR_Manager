# Sujet : Améliorations roadmap PCR Manager

## Contexte du projet

PCR Manager est une app desktop Tauri 2 (React 18 + TypeScript + Tailwind + Rust + SQLCipher) pour la gestion de la radioprotection en établissements médicaux. Le scaffold est complet, l'installeur NSIS Windows est généré (4.45 MB), 192/192 tests TS passent, 9/9 tests Rust passent. La maquette est fidèlement implémentée.

**Repo (worktree) :** `C:\work\PCR Manager\.claude\worktrees\compassionate-wilbur-9861c8`
**Branch :** `feature/compassionate-wilbur-9861c8`
**Stack :** Tauri 2.x, React 18, TypeScript strict, Tailwind (tokens OKLCH), Vite, Vitest+RTL, Rust, rusqlite+SQLCipher, webauthn-rs 0.5

## Fichiers clés

- `src/modules/appareils/` — module appareils (liste + fiche)
- `src/modules/travailleurs/` — module travailleurs
- `src/modules/actions/Actions.tsx` — vue consolidée filtrable
- `src/modules/dashboard/Dashboard.tsx`
- `src-tauri/src/commands/competence.rs` — CRUD competence_ref et competence_travailleur
- `src-tauri/migrations/V1__initial.sql` — schema complet (competence_ref seedée avec 9 compétences dont 5 génériques)
- `src/lib/api.ts` — wrapper invoke Tauri
- `src/lib/domain.ts` — types TS
- `.github/` — n'existe pas encore

## Tâches à réaliser

### T1 — Bibliothèque de compétences : UI de gestion (CRUD)

**Objectif :** Ajouter un écran "Bibliothèque de compétences" accessible depuis la sidebar permettant à l'administrateur PCR de gérer les 9 compétences (libellés, ordre) — et potentiellement d'en ajouter/supprimer.

**Ce qui existe déjà :**
- `src-tauri/src/commands/competence.rs` : commandes `competence_list`, `competence_create`, `competence_update`, `competence_delete`
- `src/lib/api.ts` : wrappers `api.competence.list()`, `.create()`, `.update()`, `.delete()`
- `src/lib/domain.ts` : type `CompetenceRef { id, libelle, ordre }`
- `src-tauri/migrations/V1__initial.sql` : table `competence_ref (id INTEGER PK, libelle TEXT NOT NULL, ordre INTEGER DEFAULT 0)` seedée avec 9 entrées

**Ce qu'il faut créer :**
1. `src/modules/competences/CompetencesList.tsx` — Page de gestion de la bibliothèque :
   - PageHead "Bibliothèque de compétences" (style identique aux autres pages)
   - Tableau triable par ordre avec colonnes : ordre, libellé, actions (éditer, supprimer)
   - Bouton "Ajouter une compétence" → modale inline (libellé, ordre)
   - Édition inline ou modale pour modifier libellé/ordre
   - Confirmation avant suppression
   - useMutation + invalidation queryKey `['competences']`
   
2. Ajouter la route dans `src/App.tsx` : `/competences` → `<CompetencesList />`

3. Ajouter l'entrée dans `src/components/Sidebar.tsx` avec l'icône `BookOpen` (lucide-react) entre "Travailleurs" et "Actions"

**Contraintes UI :**
- Respecter exactement les composants primitifs : `PageHead`, `Table/THead/TBody/TR/TH/TD`, `Button` (variants primary/ghost/destructive), `Badge`, `Field/Label/Input`
- Pas de composants tiers ou inline styles
- Modale = div conditionnelle dans le JSX (pas de Portal), fond semi-transparent avec `fixed inset-0 bg-black/40`

### T2 — CI GitHub Actions

**Objectif :** Créer `.github/workflows/ci.yml` opérationnel.

**Jobs :**
1. `lint-typecheck` (ubuntu-latest) : `npm ci` → `npm run typecheck` → `npm run lint`
2. `test-frontend` (ubuntu-latest) : `npm ci` → `npm run test:run`
3. `test-rust` (ubuntu-latest) : `rustup default stable` → `cargo test --manifest-path src-tauri/Cargo.toml --lib`
4. `build-windows` (windows-latest, déclenché sur push main + tags v*) : nécessite Strawberry Perl pour openssl-sys → `npm ci` → `npm run tauri:build` → upload artifact `.exe`

**Trigger :** `on: [push, pull_request]` sauf branches `dependabot/**`

**Notes :**
- Le job `build-windows` doit ajouter `C:\Strawberry\perl\bin` en tête de PATH avant npm run tauri:build (openssl-sys le requiert)
- Utiliser `actions/upload-artifact@v4` pour l'exe
- `test-rust` n'a pas besoin de Strawberry Perl (tests lib Rust sans feature vendored-openssl)
- Cache : `actions/cache@v4` pour `~/.cargo/registry` et `node_modules`

### T3 — Audit React : corriger les patterns `{int && <JSX>}`

**Objectif :** Trouver et corriger tous les patterns `{someVariable && <Component>}` où `someVariable` pourrait être un entier (rendrait `"0"` dans le DOM).

**Commande de recherche :**
```bash
grep -rn '{[a-zA-Z_][a-zA-Z0-9_.]* && <' src/modules src/components src/lib
```

Pour chaque match :
- Si le LHS est un entier potentiel (count, length, id, nombre...) → remplacer par `{Boolean(x) && <...>}` ou `{x > 0 && <...>}` ou `{x ? <X/> : null}`
- Si le LHS est déjà un booléen natif (isLoading, isOpen, hasData...) → laisser tel quel

**Exemple du bug corrigé précédemment :**
`AppareilsList.tsx` : `{a.utilisation_partagee && <Badge>}` → `{Boolean(a.utilisation_partagee) && <Badge>}`

### T4 — Quick wins : .editorconfig + .gitattributes

**T4a — `.editorconfig`** (à la racine) :
```
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab
```

**T4b — `.gitattributes`** (à la racine) :
```
# Auto-normalize line endings
* text=auto eol=lf

# Force LF for specific types
*.ts text eol=lf
*.tsx text eol=lf
*.rs text eol=lf
*.sql text eol=lf
*.json text eol=lf
*.md text eol=lf
*.toml text eol=lf
*.css text eol=lf
*.html text eol=lf

# Binary files — don't touch
*.png binary
*.ico binary
*.exe binary
*.dll binary
```

## Contraintes globales

1. **Lire avant d'écrire** : toujours `read` un fichier existant avant de l'éditer (editor conflicts).
2. **Vérifier les versions d'API** : avant d'écrire du code Rust qui appelle des crates, lire `src-tauri/Cargo.toml` pour les versions exactes.
3. **Respecter les imports existants** : tous les composants UI viennent de `@/components/ui` (alias configuré dans `tsconfig.json` + `vite.config.ts`).
4. **Pas d'invention de champs** : ne pas ajouter de champs non présents dans `V1__initial.sql` ou `domain.ts`.
5. **Routing React Router v6** : toutes les routes sont dans `src/App.tsx` avec la syntaxe JSX `<Route path="..." element={...} />`.
6. **`use client` interdit** : c'est du Vite/React, pas du Next.js.
7. **Sidebar** : le composant est dans `src/components/Sidebar.tsx`, lire avant de modifier.
