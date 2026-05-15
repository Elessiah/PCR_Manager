# Frontend React

## Bootstrap

React 18 est initialisé dans `src/main.tsx` avec `ReactDOM.createRoot()`. Le rendu s'effectue dans l'élément `#root` du DOM.

TanStack Query v5 est configuré dans `main.tsx` via un `QueryClient` sans options explicites de retry, gcTime ou staleTime (utilise les défauts). Le client est fourni à l'application via `QueryClientProvider`.

L'application utilise `BrowserRouter` de React Router v6. `App.tsx` constitue la racine des routes.

```tsx
<QueryClientProvider client={queryClient}>
  <BrowserRouter>
    <App />
  </BrowserRouter>
</QueryClientProvider>
```

## Routage

| Chemin | Composant | Module |
|--------|-----------|--------|
| `/` | `Dashboard` | dashboard |
| `/etablissement` | `Etablissement` | etablissement |
| `/travailleurs` | `TravailleursList` | travailleurs |
| `/travailleurs/:id` | `TravailleurFiche` | travailleurs |
| `/appareils` | `AppareilsList` | appareils |
| `/appareils/:id` | `AppareilFiche` | appareils |
| `/actions` | `Actions` | actions |

Toutes les routes sont imbriquées dans `<AppShell />` qui fournit le layout principal.

## Données : TanStack Query

Les données métier sont récupérées via `useQuery` depuis `src/lib/api.ts` :

- `['travailleurs']` → `api.travailleur.list()`
- `['appareils']` → `api.appareil.list()`
- `['verifications']` → `api.verification.list()`
- `['controles']` → `api.controleQualite.list()`

Les mutations utilisent `useMutation` avec invalidation implicite du cache via les commandes backend. Pas de configuration explicite d'`invalidateQueries` en frontend actuellement.

## Wrapper IPC — src/lib/api.ts

L'objet `api` expose des sous-objets par domaine métier. Chaque méthode invoque `invoke()` de `@tauri-apps/api/core`.

Exemples de signatures :

- `api.travailleur.list()` → `Promise<Travailleur[]>`
- `api.appareil.create(input)` → `Promise<number>` (retourne l'ID créé)
- `api.competence.set(input)` → `Promise<void>`

Domaines : `etablissement`, `travailleur`, `habilitation`, `competence`, `appareil`, `verification`, `controleQualite`, `document`, `passkey`.

## Design System

### Tailwind + OKLCH

Tailwind CSS 3.4 est configuré dans `tailwind.config.ts` avec des variables CSS OKLCH définies dans `src/index.css` :

- Neutres : `--bg`, `--surface`, `--surface-2`, `--surface-hover`, `--border`, `--border-strong`, `--text`, `--text-muted`, `--text-soft`
- Accent (bleu) : `--accent`, `--accent-hover`, `--accent-soft`, `--accent-soft-border`
- Statuts : `--ok`, `--ok-bg`, `--ok-border` ; `--warn`, `--warn-bg`, `--warn-border` ; `--danger`, `--danger-bg`, `--danger-border` ; `--neutral`, `--neutral-bg`, `--neutral-border`
- Rayon : `--radius: 6px`, `--radius-sm: 4px`

Fonts : Public Sans (sans-serif), JetBrains Mono (monospace).

### Helper cn()

`src/lib/cn.ts` fournit une fonction pour fusionner des class strings conditionnels :

```ts
export function cn(...args: (string | false | null | undefined)[]): string {
  return args.filter(Boolean).join(' ');
}
```

Utilisée par tous les composants pour composer les classes Tailwind dynamiquement.

## Primitives UI — src/components/ui/

| Composant | Props clés | Usage |
|-----------|-----------|-------|
| `Button` | `variant` ('default', 'primary', 'ghost', 'dangerGhost'), `size` ('default', 'sm', 'icon') | Boutons d'action |
| `Card` / `CardHead` / `CardBody` / `CardTitle` | `className`, `children` | Cartes de contenu |
| `Badge` | `variant` ('ok', 'warn', 'danger', 'neutral', 'accent'), `icon` | Badges de statut |
| `Dot` | — | Indicateur de couleur |
| `Table` / `THead` / `TBody` / `TR` / `TH` / `TD` | `className` | Tableaux de données |
| `Field` / `Label` / `Input` / `Select` / `Textarea` | Attributs HTML standards | Formulaires |
| `KpiTile` | `label`, `value`, `footer` | Tuiles de KPI |
| `Tabs` / `TabList` / `Tab` / `TabPanel` | — | Onglets |
| `PillFilter` | — | Filtres en pilules |

Tous les composants utilisent `React.forwardRef` et acceptent `className` pour surcharge.

## Layout

### AppShell

Structure : grid 2 colonnes (240px sidebar + 1fr main).

```tsx
<div className="grid grid-cols-[240px_1fr] h-screen">
  <Sidebar />
  <main className="overflow-auto flex flex-col">
    <Topbar />
    <div className="px-8 pt-7 pb-14 max-w-[1320px] mx-auto w-full">
      <Outlet />
    </div>
  </main>
</div>
```

### Sidebar

Navigation avec 5 items : Dashboard, Établissement, Travailleurs, Appareils, Actions. Chaque item possède une icône lucide-react. Le statut actif est marqué par `isActive` de `NavLink`.

Pied de page : avatar + label "PCR Manager" / "Admin".

### Topbar

Breadcrumb de navigation + barre de recherche + avatar utilisateur. Sticky.

## Modules Métier

| Dossier | Pages |
|---------|-------|
| `actions` | `Actions.tsx` |
| `appareils` | `AppareilsList.tsx`, `AppareilFiche.tsx`, `VerificationsSection.tsx`, `ControlesQualiteSection.tsx` |
| `dashboard` | `Dashboard.tsx`, `AlertesCard.tsx` |
| `etablissement` | `Etablissement.tsx`, `KbisSection.tsx` |
| `travailleurs` | `TravailleursList.tsx`, `TravailleurFiche.tsx`, `DonneesPersonnellesTab.tsx`, `HabilitationTab.tsx`, `CompetencesAppareilSubsheet.tsx` |

## Types Partagés

`src/types/domain.ts` exporte les interfaces métier :

- `Etablissement` : id, denomination, statut_juridique, siret, …, created_at, updated_at
- `Travailleur` : id, etablissement_id, nom, prenom, sexe, date_naissance, …, created_at, updated_at
- `HabilitationStatus` : statut ('validee', 'partielle', 'non_validee'), details (formation_rp_ok, dosimetries_ok, …)
- `Appareil`, `VerificationTechnique`, `ControleQualite`, `Document` définissent le domaine technique

## Liens

- [backend.md](./backend.md) — Commandes Tauri et logique serveur
- [business-logic.md](./business-logic.md) — Règles métier (habilitation, validations)
