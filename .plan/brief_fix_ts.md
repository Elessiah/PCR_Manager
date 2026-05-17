# Brief — Correction erreurs TypeScript post-refactor

## Contexte
Repo : `C:\work\PCR Manager\.claude\worktrees\romantic-lalande-25cac8`
La roadmap initiale (T1-T14) est complète. Un refactor UI récent (commit bfd8d11) a introduit
des fonctions inline `VerifRow` et `CycleRow` dans `AppareilFiche.tsx` sans annotations de types,
provoquant 19 erreurs `tsc --noEmit`.

## Erreurs actuelles (`npx tsc --noEmit`)

### Groupe 1 — TS7031 : paramètres destructurés sans type (lignes 14 et 44)
```
src/modules/appareils/AppareilFiche.tsx(14,21): TS7031 Binding element 'label' implicitly has 'any'
src/modules/appareils/AppareilFiche.tsx(14,28): TS7031 Binding element 'sub' implicitly has 'any'
src/modules/appareils/AppareilFiche.tsx(14,33): TS7031 Binding element 'last' implicitly has 'any'
src/modules/appareils/AppareilFiche.tsx(14,39): TS7031 Binding element 'dateLast' implicitly has 'any'
src/modules/appareils/AppareilFiche.tsx(14,49): TS7031 Binding element 'dateDeadline' implicitly has 'any'
src/modules/appareils/AppareilFiche.tsx(14,63): TS7031 Binding element 'status' implicitly has 'any'
src/modules/appareils/AppareilFiche.tsx(44,21): TS7031 Binding element 'label' implicitly has 'any'
src/modules/appareils/AppareilFiche.tsx(44,28): TS7031 Binding element 'sub' implicitly has 'any'
src/modules/appareils/AppareilFiche.tsx(44,33): TS7031 Binding element 'dateDeadline' implicitly has 'any'
src/modules/appareils/AppareilFiche.tsx(44,47): TS7031 Binding element 'status' implicitly has 'any'
```

### Groupe 2 — TS7053 : indexation de Record avec `any` (lignes 34 et 71)
```
statusToBadgeVariant[status]  => 'status' est any, ne peut pas indexer Record<StatusColor, ...>
```
Correction : `status as StatusColor` dans les deux endroits.

### Groupe 3 — TS2769 : new Date() reçoit string | null (ligne 299)
```
AppareilFiche.tsx(299,58): TS2769 : 'string | null' is not assignable to 'string | number | Date'
```
Correction : `extern.date_realisation` doit être protégé par `externe.date_realisation ?? ''`
ou reformaté avec une guard function déjà présente dans le fichier (`formatDate`).

## Objectif
Corriger exactement ces 3 groupes d'erreurs dans `AppareilFiche.tsx`.
`npx tsc --noEmit` doit passer avec 0 erreur après correction.

## Contraintes
- Un seul fichier à modifier : `src/modules/appareils/AppareilFiche.tsx`
- Lire le fichier entier avant de modifier (pour voir le contexte exact)
- Ne pas refactorer ou restructurer au-delà du strict nécessaire
- Validation : `npx tsc --noEmit` depuis la racine du worktree
