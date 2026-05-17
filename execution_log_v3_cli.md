# Plan Fidelity V3

> Genere le 16/05/2026 a 15:10
> Modele : `claude-haiku-4-5-20251001` | backend : `cli`

---

## [04] Dashboard — refonte complète : PageHead actions, KPI tones, card échéances avec action button et rows cliquables, sources alertes (icon box 30x30)  (OK)

## ✅ Dashboard refactorisé — Tâche complète

**Commit:** `2208ce3` — refactor(dashboard): structure complète maquette

### Changements effectués:

**Dashboard.tsx** — Structure complète maquette:
- ✅ **PageHead** avec title, date formatée, boutons Exporter/Actualiser
- ✅ **KPI Grid 3 cols** — Tones danger/warn/ok + Badges avec icônes auto (AlertTriangle/Clock/Check)
- ✅ **Table Échéances prioritaires** (1.6fr) — Bouton "Voir toutes les actions", rows cliquables `/appareils/:id`, statut badges auto
- ✅ **3 Cards droite** (1fr) — Sources des alertes (5), Habilitations (segment+legend Dot), Parc appareils (identique)
- ✅ `useNavigate` pour les clics rows et bouton actions

**Tests** — 16 tests ✅:
- PageHead + buttons + date
- KPI tiles + footers corrects
- Table headers + rows cliquables
- Sources 5 catégories
- Legends avec Dot component
- Empty states

**Build** — ✅ npm run build réussit sans erreurs

---

## [05] TravailleursList — refonte : PageHead actions, search+pill-filter+count, table avec avatar/badges/click navigate  (OK)

Travail terminé ! J'ai refactorisé TravailleursList pour matcher parfaitement la maquette.

**Changements appliqués :**

1. **PageHead** — Remplacé le titre/sous-titre custom par le composant PageHead avec actions button
2. **Layout optimisé** — Restructuré en ligne unique : search box (320px) + pill filters + count résultats
3. **Avatar** — Fonction inline utilisant oklch pour couleurs basées sur le hash du nom
4. **État simplifié** — useMemo pour habilitations, filters en tableau structuré, variables renommées (q, filter)
5. **Tests mis à jour** — 13/13 tests passant avec assertions adaptées

**Commit : 81b9cdd**

La page affiche maintenant PageHead + search/filters en une ligne + table avec avatars colorisés, correspondant exactement à la maquette.

---

## [06] AppareilsList — refonte : PageHead, search, table avec name+marque/modèle+série mono+lieu+badges statut  (OK)

Fait! AppareilsList a été refactorisé pour matcher la maquette.

**Changements:**
- PageHead avec title "Appareils", sub avec count, actions button "Ajouter un appareil"
- Search box inline avec icone Search (w-[340px])
- Table restructurée:
  - Désignation + marque · modele en sous-info gris
  - Numéro de série en monospace avec "—" si null
  - Lieu + badge "partagé" si applicable
  - Vérification technique avec badge + "Échéance {date}"
  - Contrôle qualité avec badge + "Prochain {date}"
  - ChevronRight à droite
- Labels de statut: valide→"À jour", en_retard→"Invalide"
- Click sur row navigue vers `/appareils/{id}`

Tests: ✅ 4/4 passing
Commit: **d562e50**

---

## [07] Actions — refonte : PageHead, pill-filter avec counts, table avec dot+sujet+action+type+date+statut+chevron  (OK)

✅ **Actions refactorisée pour matcher la maquette**

Changements effectués :
- **PageHead** : title "Actions", sub descriptif, bouton Exporter
- **Pills** : 6 filtres avec compteurs dynamiques (Tout, En retard, À venir, Formation, Contrôle, Visite méd.)
- **Table réorganisée** :
  - Colonne Sujet (cible label)
  - Colonne Action (libelle)
  - Colonne Type (badge neutral avec categorie)
  - Colonne Échéance (date + jour relatif)
  - Colonne Statut (badge coloré)
  - Dot indicator et ChevronRight navigation

- Logique Formation/Visite médicale depuis habilitations préservée
- Tri (en_retard d'abord, puis deadline croissant)
- Tests mise à jour pour "Visite médicale" (long form du badge)

**SHA**: `d9610a4`

---

## [08] Etablissement — PageHead avec edit/save buttons, grid 2 cols cards form, K-Bis card avec SIRET input + PDF badge  (OK)

Excellent ! Tout fonctionne. Voici le résumé :

**Refactorisation complète de la page Établissement** ✅

### Changements effectués :

1. **PageHead** — Remplacé le header manuel par le composant `PageHead` avec title, sub et actions (Edit/Save/Cancel)

2. **Layout 2 colonnes** — Restructuré le grid avec `gap-3.5` :
   - Identification + Coordonnées (2 colonnes)
   - Adresse (full width, col-span-2)
   - K-Bis (full width, col-span-2)

3. **K-Bis intégré inline** — Déplacé du composant séparé vers la structure cible :
   - SIRET row avec input disabled hors édition + Badge "SIRET valide"
   - PDF row avec badge PDF, nom du fichier, date, et buttons "Remplacer"/"Ouvrir" en édition

4. **Validation SIRET** — Ajout de la logique de validation avec Badge variant="ok"

5. **Tests mis à jour** — Modifiés pour correspondre à la nouvelle UI (boutons Remplacer/Ouvrir)

### Vérifications ✅
- Tests: **3 passed**
- Build: **✓ success** (1550 modules)
- Commit: **5f4a9c0** — `refactor(etablissement): PageHead edit/save, cards form 2 cols, K-Bis card avec PDF badge`

---

## [09] TravailleurFiche — breadcrumb, avatar 64x64, tabs, form-grid ReadField, HabRow (5 items), CompetenceRow (9 grid 2 cols)  (FAIL)

[ERREUR tache 9] claude exit 1 :: You've hit your limit · resets 7:10pm (Europe/Paris)
