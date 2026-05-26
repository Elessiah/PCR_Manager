# T4.4 — Fiche travailleur — Habilitation

## 2 - 3
Ajoute la possibilité d'interagir avec les touches Entrées et Echap

---

## ✅ Corrigés (branche fix/e2e-dashboard-dosimetrie)

### Dashboard — KPI "En retard" vs page Actions (compteur sidebar bloqué à 0)
**Cause** : le dashboard calculait `formationsDanger`, `visitesDanger`, `dosimetrieDanger` via les flags booléens backend (`!formation_rp_ok`, etc.) qui sont `false` même quand la date n'a jamais été saisie — pas seulement quand elle est expirée. Résultat : le KPI "en retard" comptait des travailleurs sans données, tandis que la page Actions et la sidebar (qui utilisent `statusFromDate()` sur les dates réelles) affichaient 0.
**Fix** : `Dashboard.tsx` — remplacement des checks `!ok` par des calculs `statusFromDate()` sur `habilitationRawQueries`, identique à la logique de `Actions.tsx`. Fusion du loop warn+danger en un seul parcours. Ajout de `formation_rp_patients_date` (7 ans) manquant.
**Fix** : `Sidebar.tsx` — ajout du check `formation_rp_patients_date` (7 ans) absent, alignant la sidebar avec la page Actions.

### Dashboard — KPI "En retard" vs page Actions (déduplication vérifications)
**Cause** : le dashboard comptait toutes les vérifications historiques (sans déduplication), alors qu'Actions ne garde que la plus récente par (appareil, type).
**Fix** : `Dashboard.tsx` — même logique de déduplication que `Actions.tsx`.

### T4.4 Fiche Travailleur — Dosimétrie passive / opérationnelle
**Cause** : clic sur "Dosimétrie opérationnelle" était redirigé vers la modale commune `'dosimetries'` (les deux champs visibles).
**Fix** : `HabilitationTab.tsx` — deux modales distinctes : `EditModalDosimetries` (passive seule) et `EditModalDosimetriesOp` (opérationnelle seule).
