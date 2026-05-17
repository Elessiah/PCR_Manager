#!/bin/bash
set -e
cd "$(git rev-parse --show-toplevel)"
echo "Git repo root: $(pwd)"
git add src/modules/dashboard/Dashboard.tsx src/modules/dashboard/__tests__/Dashboard.test.tsx
echo "Files staged:"
git diff --cached --name-only
echo ""
git commit -m "$(cat <<'COMMIT_MSG'
feat(dashboard): ajouter colonne droite avec 3 cards (sources, habilitations, parc)

Colonne droite composée de 3 cartes empilées :
- Sources des alertes : 5 catégories (Formations, Visites médicales, Vérifications, Contrôles qualité, Dosimétrie) avec badges danger/warn/ok
- Habilitations travailleurs : barre de progression 3 segments (validée/partielle/non_validée)
- Parc d'appareils : barre de progression 3 segments (valide/à_prévoir/en_retard)

useQueries pour les habilitations, avec fallback gracieux en cas d'erreur.
Tests couvrent les 3 cartes + cas limites (données vides).

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
)"
echo ""
git log --oneline -1
