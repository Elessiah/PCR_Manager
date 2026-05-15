# Résolution des 21 échecs vitest restants

## Contexte

Le projet PCR Manager est dans :
`C:\work\PCR Manager\.claude\worktrees\dreamy-villani-248f39`

Une couverture de tests a été générée précédemment : **192 tests, 171 passent, 21 échouent**. Cause racine : les tests ont été écrits par Haiku **sans lire le code des composants cibles**, donc ils asserent sur des libellés inventés (ex : "Compétences par appareil", "4 habilitation items", "KPI tiles", noms de boutons) qui ne correspondent pas à l'implémentation réelle.

Le but de ce plan : **aligner chaque test avec son composant réel**. Stratégie :
1. **Lire le composant cible** (Read tool obligatoire).
2. Identifier les libellés/aria-labels/textes réellement rendus.
3. **Modifier les assertions** du test (et SEULEMENT du test) :
   - remplacer `getByText('libellé inventé')` par le vrai libellé OU par un matcher plus tolérant (`getByText(/regex/i)`, `getByRole('heading', {name: /…/i})`).
   - si la fonctionnalité testée n'existe **pas** dans le composant (ex : bouton inexistant), marquer le test `.skip` avec un commentaire explicite `// SKIP: <raison>`, ne pas l'inventer.
   - éviter `getByText` qui dépendent de chemins fragiles ; préférer `findByText`/`waitFor` avec regex insensibles à la casse.
4. **NE PAS modifier** le composant applicatif. Si une vraie incohérence (bug réel) est repérée, RAPPORTER sans corriger.

## Répartition des échecs

| Fichier de test | Nb échecs |
|---|---|
| `src/modules/travailleurs/__tests__/Habilitation.test.tsx` | 6 |
| `src/modules/travailleurs/__tests__/Fiche.test.tsx` | 5 |
| `src/modules/appareils/__tests__/AppareilFiche.test.tsx` | 3 |
| `src/modules/actions/__tests__/Actions.test.tsx` | 2 |
| `src/modules/appareils/__tests__/AppareilsList.test.tsx` | 1 |
| `src/modules/dashboard/__tests__/Dashboard.test.tsx` | 1 |
| `src/modules/etablissement/__tests__/Etablissement.test.tsx` | 1 |
| `src/components/layout/__tests__/Sidebar.test.tsx` | 1 |
| `src/components/layout/__tests__/AppShell.test.tsx` | 1 |

## Méthode imposée par tâche

Pour chaque tâche (groupée par module) :

1. **Identifier le périmètre fichier** (SCOPE STRICT) :
   - Le ou les fichiers `*.test.tsx` du module concerné.
   - **INTERDIT** : tout fichier `.tsx` hors `__tests__/`, tout fichier `.ts` applicatif, `package.json`, `vitest.config.ts`, `src/test/setup.ts`, `src/test/test-utils.tsx`.
2. **Read OBLIGATOIRE** :
   - Le composant testé (chemin absolu fourni dans le prompt).
   - Le test actuel (chemin absolu fourni).
3. **Lancer `npx vitest run <chemin du test>` AVANT** modification pour reproduire l'échec et observer le DOM rendu.
4. **Ajuster les assertions** pour matcher l'implémentation réelle. Préférer :
   - `screen.findByText(/Habilitation/i)` plutôt que `screen.getByText('Habilitation')` (la regex tolère les balises wrapping et la casse).
   - `screen.getAllByText(...)` quand plusieurs occurrences existent.
   - `getByRole('tab', { name: /habilitation/i })` quand applicable.
   - `expect(container.textContent).toMatch(/regex/i)` en dernier recours.
5. **`.skip` pour les fonctionnalités absentes** : si le test cible un bouton/section qui n'existe pas dans le composant, ne pas inventer un fix — utiliser `it.skip('...', ...)` avec un `// SKIP: feature X absente du composant <Name>, à implémenter si requise par la spec`.
6. **Validation finale** : `npx vitest run <chemin du test>` doit retourner 0 failure dans ce fichier.

## Couverture des layouts (Sidebar / AppShell)

Les 2 échecs layout sont possiblement liés au fix de routing fait précédemment (route pattern auto). Lire `src/test/test-utils.tsx` pour comprendre le nouveau wrapper, puis adapter les tests. Si l'échec persiste après lecture, marquer `.skip` avec raison.

## Contraintes

- **SCOPE STRICT** par tâche : exactement les fichiers de test du module concerné.
- **NE PAS toucher** : composants applicatifs (`src/modules/**/*.tsx` hors `__tests__/`, `src/components/**/*.tsx` hors `__tests__/`, `src/lib/**`, `src/types/**`).
- **NE PAS toucher** : `vitest.config.ts`, `src/test/setup.ts`, `src/test/test-utils.tsx`, `package.json`, fichiers Rust.
- **Pas de placeholder TODO**. Soit le test passe, soit il est `.skip` avec raison explicite.
- **Pas de Co-Authored-By** dans les commits.
- Cargo non installé : ne pas tenter de lancer cargo.
- Pas de dev server lancé.
- Commande de validation par tâche : `npx vitest run <chemins du module>` doit retourner 0 failure (les tests `.skip` sont OK).

## Plan attendu (7 tâches)

1. **Fix tests Travailleurs Habilitation (6 échecs)** — fichier : `src/modules/travailleurs/__tests__/Habilitation.test.tsx`. Composants à lire : `src/modules/travailleurs/TravailleurFiche.tsx`, `HabilitationTab.tsx`, `CompetencesAppareilSubsheet.tsx`.
2. **Fix tests Travailleurs Fiche (5 échecs)** — fichier : `src/modules/travailleurs/__tests__/Fiche.test.tsx`. Composants : `TravailleurFiche.tsx`, `DonneesPersonnellesTab.tsx`, `HabilitationTab.tsx`.
3. **Fix tests Appareils AppareilFiche (3 échecs)** — fichier : `src/modules/appareils/__tests__/AppareilFiche.test.tsx`. Composants : `AppareilFiche.tsx`, `VerificationsSection.tsx`, `ControlesQualiteSection.tsx`.
4. **Fix tests Actions (2 échecs) + AppareilsList (1 échec)** — fichiers : `src/modules/actions/__tests__/Actions.test.tsx`, `src/modules/appareils/__tests__/AppareilsList.test.tsx`. Composants : `Actions.tsx`, `AppareilsList.tsx`.
5. **Fix tests Etablissement (1 échec) + Dashboard (1 échec)** — fichiers : `src/modules/etablissement/__tests__/Etablissement.test.tsx`, `src/modules/dashboard/__tests__/Dashboard.test.tsx`. Composants : `Etablissement.tsx`, `KbisSection.tsx`, `Dashboard.tsx`, `AlertesCard.tsx`.
6. **Fix tests Layout (Sidebar 1 + AppShell 1)** — fichiers : `src/components/layout/__tests__/Sidebar.test.tsx`, `src/components/layout/__tests__/AppShell.test.tsx`. Composants : `Sidebar.tsx`, `AppShell.tsx`, `Topbar.tsx`. Lire AUSSI `src/test/test-utils.tsx` (le nouveau wrapper Routes).
7. **Validation finale** — lancer `npx vitest run --reporter=basic` sur la suite complète. Rapporter le nouveau total (X/192). Si > 0 échec restant, lister précisément.

Chaque tâche : autonome, SCOPE STRICT, chemins absolus, Read obligatoire, `.skip` autorisé en dernier recours.
