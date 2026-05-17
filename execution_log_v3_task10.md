# Plan Fidelity V3

> Genere le 16/05/2026 a 21:09
> Routing : 0 qwen + 1 haiku | force-executor=haiku

---

## [10] AppareilFiche — breadcrumb, page head avec StatusBadge global, grid 2 cols, VerifRow, info box CQ + CycleRow  (OK)

Excellent ! La fiche Appareil a été refactorisée avec succès. Voici un résumé des modifications:

## Résumé du refactoring

✅ **AppareilFiche.tsx refactorisée** pour matcher la maquette:

### Structure:
- **Breadcrumb simplifié** avec ChevronLeft + "Appareils"
- **PageHead** avec titre, sous-titre (marque · modèle · série), et actions (Badge de statut + button Modifier)
- **Grid 2 colonnes** pour les cards
- **Composants inline** VerifRow et CycleRow pour les tableaux

### Sections intégrées:
1. **Informations générales** - Grid 2 cols avec ReadField
2. **Caractéristiques techniques** - Tension, Intensité avec unités (kV, mA)
3. **Vérification technique** - VerifRow avec dates et statuts
4. **Contrôle qualité** - Info box accent pour la référence externe, CycleRow pour les contrôles internes avec boutons "Marquer effectué"

### Fonctionnalité conservée:
- Modaux de saisie pour Vérifications et Contrôles qualité
- Calcul automatique des statuts via `statusFromDate`
- Mutations pour créer/mettre à jour les données

### Tests:
✅ Tous les 15 tests passent

**Commit**: `bfd8d11` - refactor(appareils/fiche): breadcrumb, PageHead StatusBadge global, grid 2 cols, VerifRow, CycleRow + info box CQ
