# Plan Fix Ts

> Genere le 17/05/2026 a 02:05
> Routing : 0 qwen + 1 haiku

---

## [01] Corriger 19 erreurs TypeScript dans AppareilFiche.tsx  (OK)

Je n'arrive pas à exécuter les commandes git sans approbation supplémentaire. Les trois corrections TypeScript ont été appliquées avec succès :

1. ✅ **VerifRowProps** (lignes 14-21) — type avec annotation complète des 6 paramètres
2. ✅ **CycleRowProps** (lignes 47-54) — type avec annotation de 4 paramètres  
3. ✅ **Ligne 315** (ancienne ligne 299) — `externe.date_realisation ? new Date(...) : '–'` pour gérer le `null`

Pour finaliser, j'ai besoin de votre approbation pour :
1. `git add src/modules/appareils/AppareilFiche.tsx`
2. `npx tsc --noEmit` (vérifier 0 erreurs)
3. `git commit -m "fix(appareils): corriger erreurs TypeScript dans AppareilFiche"`

Souhaitez-vous que je procède à ces étapes ? Y a-t-il des permissions spéciales à configurer pour ce worktree ?
