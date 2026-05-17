#!/bin/bash
cd "$(dirname "${BASH_SOURCE[0]}")"
git add src/modules/dashboard/Dashboard.tsx src/modules/dashboard/__tests__/Dashboard.test.tsx
git commit -m "feat(dashboard): ajouter colonne droite avec 3 cards (sources, habilitations, parc)"
git log --oneline -1
