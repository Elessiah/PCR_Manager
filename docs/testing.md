# Tests

## Stack

Le projet utilise la pile de test suivante pour le frontend :

- **Vitest 1.1.0** — test runner Vite-natif avec support des modules ES
- **@testing-library/react 14.2.0** — utilitaires de test orientés user interactions
- **jsdom 24.0.0** — environnement DOM léger sans navigateur

Versions exactes depuis `package.json`.

## Configuration Vitest

Le fichier `vitest.config.ts` configure :

- **environment** : `jsdom` — simule un DOM sans lancer un navigateur
- **globals** : `true` — rend `describe`, `it`, `expect` disponibles sans import
- **setupFiles** : `['./src/test/setup.ts']` — exécuté avant chaque fichier de test
- **css** : `false` — ignore les imports CSS (les styles Tailwind sont statiques)
- **coverage** : provider `v8`, reporters `text` et `html`

### Setup initial (src/test/setup.ts)

Le fichier setup effectue le bootstrapping des mocks globaux :

- Importe `@testing-library/jest-dom/vitest` pour les matchers DOM
- Mock `@tauri-apps/api/core` via `vi.mock()` :
  ```js
  vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
  }))
  ```
  `invoke` retourne un `vi.fn()` réinitialisable (utilisé pour tester les appels Tauri)
- Nettoie après chaque test : `vi.clearAllMocks()` + `cleanup()` de React Testing Library

### Test utils (src/test/test-utils.tsx)

Helper principal : `renderWithProviders(ui, options)` wrappe les composants avec :

- **QueryClientProvider** — gère le cache React Query (retry: false, gcTime: 0 en test)
- **MemoryRouter** — navigation in-process, pas de changement URL réel
- **Routes** — accepte `route` (URL initiale) et `path` (pattern, ex: `'/:id'`)
- **Auto-déduction de route** — si `route = '/travailleurs/1'` et `path = '*'`, dérive automatiquement `/:id`

Signature simplifiée :
```ts
renderWithProviders(
  <YourComponent />,
  { route?: string, path?: string, ...renderOptions }
)
```

## Structure des tests

### Localisation

Tests co-localisés en sous-dossiers `__tests__/` adjacents au code :

```
src/lib/
  status.ts
  __tests__/
    status.test.ts
src/components/ui/
  Button.tsx
  __tests__/
    Button.test.tsx
```

### Couverture actuelle

24 fichiers test structurés par domaine :

| Domaine | Fichiers | Module |
|---------|----------|--------|
| **lib** | 4 | Logique pure : `status`, `habilitation`, `cn`, `api` |
| **UI primitives** | 9 | `Button`, `Badge`, `Card`, `Dot`, `KpiTile`, `FormField`, `PillFilter`, `Tabs`, `Table` |
| **Layout** | 3 | `AppShell`, `Sidebar`, `Topbar` |
| **Modules** | 8 | `Dashboard`, `Actions`, `Établissement`, `Travailleurs` (List, Fiche, Habilitation), `Appareils` (List, Fiche) |

## Exemple de test

Extrait copié de `src/lib/__tests__/status.test.ts` :

```ts
describe('status', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('statusFromDate', () => {
    it('should return non_applicable for null', () => {
      expect(statusFromDate(null)).toBe('non_applicable');
    });

    it('should return en_retard for passed deadline', () => {
      expect(statusFromDate('2026-05-14T00:00:00Z')).toBe('en_retard');
    });

    it('should return a_prevoir for deadline within alert months (default 1)', () => {
      expect(statusFromDate('2026-05-20T00:00:00Z')).toBe('a_prevoir');
    });
  });
});
```

Exemple avec composant (extrait de `src/components/ui/__tests__/Button.test.tsx`) :

```ts
describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Hello</Button>);
    expect(screen.getByRole('button', { name: 'Hello' })).toBeInTheDocument();
  });

  it('handles click event', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });
    const user = userEvent.setup();
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies primary variant classes', () => {
    render(<Button variant="primary">Primary</Button>);
    const button = screen.getByRole('button', { name: 'Primary' });
    expect(button).toHaveClass('bg-accent');
  });
});
```

## État actuel honnête

### Frontend

- **24 fichiers test** identifiés et localisés
- **Exécution non effectuée** — `npm test` n'a pas été lancé pour compter les cas de test réels
- **Pas d'accès aux métriques de passage/échec** — les assertions détaillées et les taux d'échec ne sont pas observables sans exécution
- Si des échecs existent dans les modules `Travailleurs` ou `Appareils`, ils ne sont pas visibles en lecture statique

### Rust

- **9 tests** trouvés via grep `#[test]` :
  - 3 dans `src-tauri/src/db.rs`
  - 2 dans `src-tauri/src/commands/travailleur.rs`
  - 2 dans `src-tauri/src/commands/etablissement.rs`
  - 1 dans `src-tauri/src/commands/controle_qualite.rs`
  - 1 dans `src-tauri/src/commands/appareil.rs`

- **Cargo non installé** — validation déléguée à la CI (exécution locale impossible)

## Tests Rust

### Localisation

Tests définis inline dans les modules source via `#[cfg(test)]` (exemple, `src-tauri/src/db.rs:64-139`) :

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_db() -> Result<Connection> {
        let dir = tempfile::tempdir()?;
        let db_path = dir.path().join("test.db");
        let mut conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA key = 'test-key';")?;
        Ok(conn)
    }

    #[test]
    fn test_migrations_create_expected_tables() {
        let mut conn = create_test_db().expect("Failed to create test DB");
        run_migrations(&mut conn).expect("Failed to run migrations");
        // ... assertions
    }
}
```

### Bootstrap

- Utilitaire : `create_test_db()` ouvre une base en mémoire via `tempfile::tempdir()`
- Chiffrement : `PRAGMA key = 'test-key'` (clé fixe pour tests, pas de SQLCipher complet)
- `Cargo.toml` : dépend de `rusqlite` avec feature `bundled-sqlcipher-vendored-openssl`, `tempfile` et `serial_test` en dev-dependencies

## Scripts utilitaires

Les fichiers suivants sont listés en `git status` mais n'existent pas :

- `run-tests.sh` — non trouvé
- `run-travailleurs-tests.sh` — non trouvé

Utiliser les commandes `npm` décrites ci-dessous à la place.

## Lancer les tests

### Frontend

```bash
npm test              # Vitest en mode watch
npm run test:run      # Vitest une seule exécution (CI)
npm run test:ui       # Interface web interactive
npm run test:coverage # Rapport de couverture (V8)
```

Ces commandes appellent `vitest` depuis `package.json`.

### Rust

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Non exécuté localement (Cargo absent). Les tests s'exécutent en CI.

## Liens

- [frontend.md](./frontend.md) — architecture React et modules
- [backend.md](./backend.md) — architecture Rust et API Tauri
- [business-logic.md](./business-logic.md) — règles métier testées
