## ✅ Corrigés (branche fix/e2e-dashboard-dosimetrie)

### Dashboard — KPI "En retard" vs page Actions
**Cause** : le dashboard comptait toutes les vérifications historiques (sans déduplication), alors qu'Actions ne garde que la plus récente par (appareil, type).
**Fix** : `Dashboard.tsx` — même logique de déduplication que `Actions.tsx`.

### T4.4 Fiche Travailleur — Dosimétrie passive / opérationnelle
**Cause** : clic sur "Dosimétrie opérationnelle" était redirigé vers la modale commune `'dosimetries'` (les deux champs visibles).
**Fix** : `HabilitationTab.tsx` — deux modales distinctes : `EditModalDosimetries` (passive seule) et `EditModalDosimetriesOp` (opérationnelle seule).

---

## En cours de test
