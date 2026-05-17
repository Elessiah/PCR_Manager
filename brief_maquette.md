# Brief — Correction maquette PCR Manager

Contexte : Application React 18 + TypeScript + Tailwind CSS (PCR Manager, gestion radioprotection).
Worktree : `C:\work\PCR Manager\.claude\worktrees\nice-elbakyan-8c32df\`

La maquette de référence est dans `maquette/gestionnaire-pcr/project/src/`.
Après analyse comparative, voici les **4 écarts** à corriger pixel-perfect dans l'implémentation TypeScript.

---

## ÉCART 1 — Dashboard (`src/modules/dashboard/Dashboard.tsx`)

La maquette montre un dashboard en 2 colonnes avec :
- **KPI row (3 tuiles)** : "En retard" (tone danger, count actions invalides), "À prévoir" (tone warn, count <90j), "À jour" (tone ok, ratio travailleurs habilités)
- **Colonne gauche (1.6fr)** : Card "Échéances prioritaires" = table des 8 premières actions triées (Sujet = cible.label, Type badge, Échéance formatée + relDay, Statut badge)
- **Colonne droite (1fr)** : 3 cards empilées :
  1. "Sources des alertes" : 5 lignes (Formations, Visites médicales, Vérifications, Contrôles qualité, Dosimétrie), chaque ligne = icon 30×30 + label + badges danger/warn/ok avec counts
  2. "Habilitations travailleurs" : barre proportionnelle (3 segments : validée/partielle/non) + légende
  3. "Parc d'appareils" : barre proportionnelle (3 segments : valide/à prévoir/en retard) + légende

Pour les habilitations travailleurs : `useQuery` sur `api.travailleur.list()` + `api.habilitation.compute(id)` pour chaque travailleur — fallback 0/0/0 si API échoue.
Segments : `div` avec `style={{ flex: count }}` + couleurs `var(--ok)`, `var(--warn)`, `var(--danger)`.
Supprimer AlertesCard et Card warning. Supprimer `p-8` dans le JSX (AppShell l'ajoute déjà).

**Fichier** : `src/modules/dashboard/Dashboard.tsx`

---

## ÉCART 2 — TravailleursList (`src/modules/travailleurs/TravailleursList.tsx`)

La maquette montre :
- **Avatar** (cercle 32×32 initiales hashées) avant le nom
- **Pill-filter** (4 boutons : Tous / Validée / Partielle / Non validée) filtrant sur le statut habilitation
- **Colonne "Catégorie"** après Fonction (`t.categorie_reglementaire`)
- **Badge habilitation** calculé via `api.habilitation.compute(t.id)` — plus de hardcode `non_validee`
- Dernière colonne : **ChevronRight** uniquement (supprimer bouton Pencil)
- Pills avec compteurs

Hash couleur : `const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360`

**Fichier** : `src/modules/travailleurs/TravailleursList.tsx`

---

## ÉCART 3 — Sidebar (`src/components/layout/Sidebar.tsx`)

La maquette montre :
- **Brand** : badge 32×32 "RP" (fond accent, texte blanc, mono) + "Gestionnaire PCR"
- **Counts** dans nav items : Travailleurs/Appareils/Actions (en retard)
- **Section établissement** (avant footer) : dénomination, ville, SIRET mono
- **Footer** : initiales établissement, nom établissement, "PCR · Administrateur"

Counts via `useQuery` avec `staleTime: 60_000`. Importer `statusFromDate` et `api`.

**Fichier** : `src/components/layout/Sidebar.tsx`

---

## ÉCART 4 — Actions (`src/modules/actions/Actions.tsx`)

La maquette montre :
- **Filtres avec compteurs** : chaque pill affiche un badge numérique
- **Catégorie Formation + Visite méd.** depuis habilitations des travailleurs :
  - Formation : deadline = habilitation.date_formation + 1 an
  - Visite médicale : deadline = habilitation.date_visite_medicale + 1 an
- **Colonne Type** avec Badge (variant neutre) au lieu de texte plain

**Fichier** : `src/modules/actions/Actions.tsx`

---

## Contraintes d'implémentation

1. Lire chaque fichier AVANT d'éditer
2. Respecter les types TypeScript existants (domain.ts, api.ts)
3. Ne pas modifier les composants UI atomiques (Badge, Table, KpiTile, etc.)
4. Lire `src/lib/api.ts` pour connaître l'interface exacte de `api.habilitation.compute()`
5. Lire `src/types/domain.ts` pour les types `Habilitation`
6. Ne créer aucun nouveau fichier (tout inline dans les 4 fichiers cibles)
