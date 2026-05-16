import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../../test/test-utils';
import Topbar from '../Topbar';
import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

describe('Topbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'etablissement_get') {
        return Promise.resolve({
          id: 1,
          denomination: 'Centre Hospitalier Universitaire',
          ville: 'Paris',
          siret: '12345678900012',
          statut_juridique: null,
          adresse: null,
          code_postal: null,
          telephone: null,
          email: null,
          site_internet: null,
          kbis_chemin: null,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        });
      }
      if (command === 'verification_list') {
        const today = new Date();
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + 100);
        return Promise.resolve([
          { id: 1, appareil_id: 1, type_: 'annuelle_interne', date_realisation: futureDate.toISOString().split('T')[0] },
        ]);
      }
      if (command === 'controle_qualite_list') {
        const today = new Date();
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + 100);
        return Promise.resolve([
          { id: 1, appareil_id: 1, type_: 'externe', date_echeance: futureDate.toISOString().split('T')[0] },
        ]);
      }
      if (command === 'travailleur_get') {
        return Promise.resolve({
          id: 1,
          nom: 'Dupont',
          prenom: 'Jean',
          etablissement_id: 1,
        });
      }
      if (command === 'appareil_get') {
        return Promise.resolve({
          id: 1,
          designation: 'Appareil X-Ray',
          etablissement_id: 1,
        });
      }
      return Promise.resolve({});
    });
  });

  it('should render search input with placeholder', async () => {
    renderWithProviders(<Topbar />);

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/rechercher travailleur/i);
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('type', 'text');
    });
  });

  it('should render search with ⌘K shortcut', async () => {
    renderWithProviders(<Topbar />);

    await waitFor(() => {
      const kbd = screen.getByText('⌘K');
      expect(kbd).toBeInTheDocument();
      expect(kbd.tagName).toBe('KBD');
    });
  });

  it('should render notification bell button', async () => {
    renderWithProviders(<Topbar />);

    await waitFor(() => {
      const bellButton = screen.getByRole('button');
      expect(bellButton).toBeInTheDocument();
    });
  });

  it('should display establishment denomination in breadcrumb', async () => {
    renderWithProviders(<Topbar />);

    await waitFor(() => {
      expect(screen.getByText('Centre Hospitalier Universitaire')).toBeInTheDocument();
    });
  });

  it('should display Tableau de bord on root path', async () => {
    renderWithProviders(<Topbar />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText('Tableau de bord')).toBeInTheDocument();
    });
  });

  it('should display Établissement on establishment path', async () => {
    renderWithProviders(<Topbar />, { route: '/etablissement' });

    await waitFor(() => {
      expect(screen.getByText('Établissement')).toBeInTheDocument();
    });
  });

  it('should display Travailleurs on travailleurs list path', async () => {
    renderWithProviders(<Topbar />, { route: '/travailleurs' });

    await waitFor(() => {
      expect(screen.getByText('Travailleurs')).toBeInTheDocument();
    });
  });

  it('should display Appareils on appareils list path', async () => {
    renderWithProviders(<Topbar />, { route: '/appareils' });

    await waitFor(() => {
      expect(screen.getByText('Appareils')).toBeInTheDocument();
    });
  });

  it('should display Actions on actions path', async () => {
    renderWithProviders(<Topbar />, { route: '/actions' });

    await waitFor(() => {
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  it('should display travailleur name on detail path', async () => {
    renderWithProviders(<Topbar />, { route: '/travailleurs/1', path: '/travailleurs/:id' });

    await waitFor(() => {
      expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    });
  });

  it('should display appareil designation on detail path', async () => {
    renderWithProviders(<Topbar />, { route: '/appareils/1', path: '/appareils/:id' });

    await waitFor(() => {
      expect(screen.getByText('Appareil X-Ray')).toBeInTheDocument();
    });
  });
});
