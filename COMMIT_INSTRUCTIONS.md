# Commit Instructions for Dashboard Changes

## Files Modified
- `src/modules/dashboard/Dashboard.tsx` - Added 3 right column cards
- `src/modules/dashboard/__tests__/Dashboard.test.tsx` - Added tests for new cards

## Changes Summary

### Dashboard.tsx
- **Imports**: Added `useQueries` from react-query v5, `HabilitationStatus` type, and lucide-react icons
- **Habilitations**: useQueries to fetch `api.habilitation.compute()` for each travailleur
- **Alert Categories**: Aggregated actions by category with danger/warn/ok counts
- **Stats Calculations**:
  - `habilitationsStats`: Count of validée/partielle/non_validée habilitations
  - `appareilsStats`: Count of valide/a_prevoir/en_retard based on latest ControleQualite status
- **Right Column Cards** (3 stacked):
  1. **Sources des alertes**: 5 categories with 3 Badge counts each
  2. **Habilitations travailleurs**: Segment bar + legend (validée/partielle/non_validée)
  3. **Parc d'appareils**: Segment bar + legend (valide/à_prévoir/en_retard)

### Dashboard.test.tsx
- Updated mock to include `habilitation_compute` response
- Added 8 new test cases covering:
  - 3 right column cards presence
  - 5 alert categories display
  - Habilitations segment bar and legend
  - Parc segment bar and legend
  - Empty data handling (travailleurs and appareils)

## Validation Commands

```bash
# Type check
npm run typecheck

# Run Dashboard tests
npm test -- --testPathPattern=dashboard --run

# View all tests
npm test -- --run
```

## Commit Command

```bash
cd "C:\work\PCR Manager\.claude\worktrees\nice-elbakyan-8c32df"

git add src/modules/dashboard/Dashboard.tsx src/modules/dashboard/__tests__/Dashboard.test.tsx

git commit -m "feat(dashboard): ajouter colonne droite avec 3 cards (sources, habilitations, parc)

Colonne droite composée de 3 cartes empilées :
- Sources des alertes : 5 catégories avec badges danger/warn/ok
- Habilitations travailleurs : barre de progression avec segments validée/partielle/non_validée
- Parc d'appareils : barre de progression avec segments valide/à_prévoir/en_retard

Utilise useQueries pour récupérer les habilitations, avec fallback gracieux.
Tests couvrent les 3 cartes et les cas limites (données vides).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Cleanup

Remove temporary scripts:
```bash
rm do-commit.sh commit-changes.sh test-dashboard.ps1 COMMIT_INSTRUCTIONS.md
```
