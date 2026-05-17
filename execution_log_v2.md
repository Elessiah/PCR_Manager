# Plan Patch V2

> Genere le 16/05/2026 a 11:19
> Modele : `claude-haiku-4-5-20251001` | backend : `cli`

---

## [01] Étendre KpiTile avec props tone et chip  (OK)

J'ai besoin que vous approuviez la création du fichier `.claude/settings.json` avec les permissions pour `npm run test:run`. Cela réduira les demandes de permission lors de l'exécution des tests.

Avez-vous d'accord pour que je crée ce fichier avec la configuration suivante ?

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run test:run *)"
    ]
  }
}
```

Si vous approuvez, je vais :
1. Créer le fichier settings.json
2. Exécuter les tests de KpiTile 
3. Exécuter tous les tests pour vérifier qu'on n'a rien cassé
4. Committer les changements

---

## [02] Dashboard : KPI tiles avec tone+chip et fix calcul À jour  (OK)

Attente de permission pour exécuter npm test...

---

## [03] Dashboard : échéances prioritaires sujet/type/statut  (OK)

Les commandes git requièrent une approbation de sécurité. J'ai préparé les modifications et elles sont prêtes à être commitées. Vérifions le résumé des changements.

Les modifications appliquées au Dashboard.tsx :

✅ **SUJET** (lignes 278-281) : Affiche `action.cible.label` en `font-medium text-sm` + `action.libelle` en sous-titre `text-xs text-textMuted mt-0.5`.

✅ **TYPE** (lignes 282-284) : Texte `text-accent text-sm font-medium` ("Vérification" ou "Contrôle") sans Badge.

✅ **STATUT** (lignes 291-302) : Badge avec icônes lucide-react :
   - `en_retard` → `<AlertTriangle size={12}/>` + "Invalide"
   - `a_prevoir` → `<Clock size={12}/>` + "À prévoir"
   - `valide` → `<CheckCircle size={12}/>` + "À jour"

Dashboard.test.tsx : 4 nouveaux tests ajoutés pour valider :
1. Type "Vérification" affiché
2. Subject avec label + libelle distincts
3. Status "en_retard" → "Invalide"
4. Status "valide" → "À jour"

**Prochaine étape requise** : Approuver et exécuter :
```bash
git add src/modules/dashboard/Dashboard.tsx src/modules/dashboard/Dashboard.test.tsx
git commit -m "feat(dashboard): echeances prioritaires sujet/type/statut"
npm run test:run
```

---

## [04] Dashboard : sources alertes masquer les zéros  (OK)

Je ne peux pas exécuter les commandes git directement en raison de restrictions de permission. Voici un résumé des modifications complétées :

## Modifications effectuées

**1. Dashboard.tsx (lignes 314-348)** — Section "Sources des alertes"
- Ajout de logique conditionnelle pour afficher les badges seulement si la valeur > 0
- Si tous les counts (danger, warn, ok) valent 0 → affichage du badge "À jour" avec icône CheckCircle

**2. Dashboard.test.tsx (lignes 412-642)** — Tests pour "Alert Sources"
- Test 1 : Badges avec valeurs mixtes (danger=2, warn=0, ok=1) → seuls danger et ok affichés
- Test 2 : Tous les counts à 0 → badge "À jour" rendu pour chaque catégorie
- Test 3 : Cas limite (danger=5, warn=0, ok=3) → danger et ok affichés, warn omis

## Pour créer le commit, exécutez :

```bash
cd "C:\work\PCR Manager\.claude\worktrees\nice-elbakyan-8c32df"
git add src/modules/dashboard/Dashboard.tsx src/modules/dashboard/Dashboard.test.tsx
git commit -m "feat(dashboard): sources alertes masquer les zeros"
```

Puis validez avec :
```bash
npm run test:run
```

---

## [05] Sidebar : sous-titre brand et label NAVIGATION  (OK)

## Rapport Final

**Modifications réalisées :**
- Sidebar.tsx : sous-titre "Suivi radioprotection" ajouté sous le titre brand (ligne 95), label "Navigation" ajouté avant la nav (ligne 99)
- Sidebar.test.tsx : 3 tests ajoutés (sous-titre, label navigation, régression du titre)

**Tests :** Les tests attendent approbation pour s'exécuter (`npm run test:run -- src/components/layout/Sidebar.test.tsx`)

**Git :** Les changements sont prêts à être ajoutés/commitées mais attendent votre approbation pour les commandes git.

Les fichiers modifiés :
- M src/components/layout/Sidebar.tsx  
- M src/components/layout/__tests__/Sidebar.test.tsx

---

## [06] Sidebar : box établissement avec label et fond surface  (OK)

I've completed the modifications to the Sidebar. Here's what I've done:

**Modified `Sidebar.tsx`** (lines 126-142):
- Added "Établissement" label with proper styling (`text-xs font-semibold text-textSoft uppercase tracking-widest`)
- Wrapped the trois infos (denomination, ville, SIRET) in a box with `bg-surface2 rounded p-3 border border-border`
- Added "SIRET" prefix to the SIRET display
- All fields fall back to `—` when missing

**Added tests to `Sidebar.test.tsx`**:
1. Test for the "Établissement" label with proper CSS classes
2. Test for the box structure with correct Tailwind classes (`bg-surface2`, `rounded`, `p-3`, `border`, `border-border`)
3. Test for fallback behavior when établissement fields are null

**To validate and commit, run:**
```powershell
# Run the tests
npm run test:run -- src/components/layout/__tests__/Sidebar.test.tsx

# Stage and commit
git add src/components/layout/Sidebar.tsx src/components/layout/__tests__/Sidebar.test.tsx
git commit -m "feat(sidebar): box etablissement avec label et fond surface"

# Verify with
git log --oneline -1
```

The changes use the actual Tailwind color names from your config: `bg-surface2`, `border-border`, `text-textSoft`, `text-textMuted`, `text-text`.
