import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../../test/test-utils';
import Sidebar from '../Sidebar';
import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

describe('Sidebar', () => {
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
      if (command === 'travailleur_list') {
        return Promise.resolve([
          { id: 1, nom: 'Dupont', prenom: 'Jean', etablissement_id: 1 },
          { id: 2, nom: 'Martin', prenom: 'Marie', etablissement_id: 1 },
          { id: 3, nom: 'Bernard', prenom: 'Pierre', etablissement_id: 1 },
          { id: 4, nom: 'Durand', prenom: 'Paul', etablissement_id: 1 },
          { id: 5, nom: 'Lefevre', prenom: 'Sophie', etablissement_id: 1 },
        ]);
      }
      if (command === 'appareil_list') {
        return Promise.resolve(
          Array.from({ length: 12 }, (_, i) => ({
            id: i + 1,
            designation: `Appareil ${i + 1}`,
            etablissement_id: 1,
            utilisation_partagee: 0,
          }))
        );
      }
      if (command === 'verification_list') {
        const today = new Date();
        const pastDate = new Date(today);
        pastDate.setDate(pastDate.getDate() - 400);
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + 100);
        return Promise.resolve([
          { id: 1, appareil_id: 1, type_: 'annuelle_interne', date_realisation: pastDate.toISOString().split('T')[0] },
        ]);
      }
      if (command === 'controle_qualite_list') {
        const today = new Date();
        const pastDate = new Date(today);
        pastDate.setDate(pastDate.getDate() - 10);
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + 100);
        return Promise.resolve([
          { id: 1, appareil_id: 1, type_: 'externe', date_echeance: pastDate.toISOString().split('T')[0] },
          { id: 2, appareil_id: 2, type_: 'partiel_interne', date_echeance: futureDate.toISOString().split('T')[0] },
          { id: 3, appareil_id: 3, type_: 'complet_interne', date_echeance: futureDate.toISOString().split('T')[0] },
        ]);
      }
      return Promise.resolve({});
    });
  });

  it('should render brand with logo and title', async () => {
    renderWithProviders(<Sidebar />, { route: '/' });

    await waitFor(() => {
      const logo = screen.getByAltText('PCR Manager');
      expect(logo).toBeInTheDocument();
      expect(logo.tagName).toBe('IMG');
      expect(logo).toHaveAttribute('src', '/logo.png');
      expect(screen.getByText('Gestionnaire PCR')).toBeInTheDocument();
    });
  });

  it('should render brand subtitle "Suivi radioprotection"', async () => {
    renderWithProviders(<Sidebar />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText('Suivi radioprotection')).toBeInTheDocument();
    });
  });

  it('should render navigation label "Navigation"', async () => {
    renderWithProviders(<Sidebar />, { route: '/' });

    await waitFor(() => {
      const navLabel = screen.getByText('Navigation');
      expect(navLabel).toBeInTheDocument();
      expect(navLabel).toHaveClass('uppercase');
    });
  });

  it('should render all navigation links', () => {
    renderWithProviders(<Sidebar />, { route: '/' });

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /établissement/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /travailleurs/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /appareils/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /actions/i })).toBeInTheDocument();
  });

  it('should display etablissement section with denomination, ville, and siret', async () => {
    renderWithProviders(<Sidebar />, { route: '/' });

    await waitFor(() => {
      // denomination appears in both the etablissement section and footer
      expect(screen.getAllByText('Centre Hospitalier Universitaire').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Paris')).toBeInTheDocument();
      expect(screen.getByText(/SIRET 12345678900012/)).toBeInTheDocument();
    });
  });

  it('should display footer with etablissement initials, name, and role', async () => {
    renderWithProviders(<Sidebar />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText('CHU')).toBeInTheDocument();
      expect(screen.getAllByText('Centre Hospitalier Universitaire').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('PCR · Administrateur')).toBeInTheDocument();
    });
  });

  it('should highlight the active link when on /travailleurs', () => {
    renderWithProviders(<Sidebar />, { route: '/travailleurs' });

    const travailleurLink = screen.getByRole('link', { name: /travailleurs/i });
    expect(travailleurLink).toHaveClass('bg-accentSoft');
    expect(travailleurLink).toHaveClass('text-accent');
  });

  it('should not highlight non-active links', () => {
    renderWithProviders(<Sidebar />, { route: '/travailleurs' });

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).not.toHaveClass('bg-accentSoft');
    expect(dashboardLink).not.toHaveClass('text-accent');
  });

  it('should set correct href for each navigation link', () => {
    renderWithProviders(<Sidebar />, { route: '/' });

    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /établissement/i })).toHaveAttribute('href', '/etablissement');
    expect(screen.getByRole('link', { name: /travailleurs/i })).toHaveAttribute('href', '/travailleurs');
    expect(screen.getByRole('link', { name: /appareils/i })).toHaveAttribute('href', '/appareils');
    expect(screen.getByRole('link', { name: /actions/i })).toHaveAttribute('href', '/actions');
  });

  it('should display placeholders when etablissement api fails', async () => {
    mockInvoke.mockRejectedValue(new Error('API Error'));

    renderWithProviders(<Sidebar />, { route: '/' });

    await waitFor(() => {
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('should display counter for Travailleurs with count=5', async () => {
    renderWithProviders(<Sidebar />, { route: '/' });

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /travailleurs/i });
      expect(link.textContent).toMatch('Travailleurs');
      expect(link.textContent).toMatch('5');
    });
  });

  it('should display counter for Appareils with count=12', async () => {
    renderWithProviders(<Sidebar />, { route: '/' });

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /appareils/i });
      expect(link.textContent).toMatch('Appareils');
      expect(link.textContent).toMatch('12');
    });
  });

  it('should display counter for Actions with count of late actions and danger variant', async () => {
    renderWithProviders(<Sidebar />, { route: '/' });

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /actions/i });
      expect(link.textContent).toMatch('Actions');
      expect(link.textContent).toMatch('2');
      const badge = link.querySelector('span[class*="text-danger"]');
      expect(badge).toBeInTheDocument();
    });
  });

  it('should not display counter when count is undefined', async () => {
    renderWithProviders(<Sidebar />, { route: '/' });

    await waitFor(() => {
      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      expect(dashboardLink).toBeInTheDocument();
      const childSpans = Array.from(dashboardLink.querySelectorAll('span'));
      const badgeSpan = childSpans.find(s => /^\d+$/.test(s.textContent?.trim() || ''));
      // Dashboard nav item has no count, so no numeric badge span should be found
      expect(badgeSpan).toBeUndefined();
    });
  });

  it('should handle api.action.list rejection gracefully', async () => {
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
      if (command === 'travailleur_list') {
        return Promise.resolve([{ id: 1, nom: 'Dupont', prenom: 'Jean' }]);
      }
      if (command === 'appareil_list') {
        return Promise.resolve([{ id: 1, designation: 'Appareil 1' }]);
      }
      if (command === 'verification_list') {
        return Promise.reject(new Error('Verification API Error'));
      }
      if (command === 'controle_qualite_list') {
        return Promise.resolve([]);
      }
      return Promise.resolve({});
    });

    renderWithProviders(<Sidebar />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText('Gestionnaire PCR')).toBeInTheDocument();
    });
  });

  it('should render etablissement label "Établissement" with proper styling', async () => {
    renderWithProviders(<Sidebar />, { route: '/' });

    await waitFor(() => {
      // "Établissement" appears twice: in nav link and in section label — target the section label div
      const labels = screen.getAllByText('Établissement');
      const sectionLabel = labels.find(el => el.tagName === 'DIV');
      expect(sectionLabel).toBeInTheDocument();
      expect(sectionLabel).toHaveClass('font-semibold');
      expect(sectionLabel).toHaveClass('text-textSoft');
      expect(sectionLabel).toHaveClass('uppercase');
    });
  });

  it('should render etablissement section with box containing denomination, ville, and SIRET', async () => {
    renderWithProviders(<Sidebar />, { route: '/' });

    await waitFor(() => {
      // "Centre Hospitalier Universitaire" appears twice (box + footer), target the one inside .bg-surface2
      const allDenominations = screen.getAllByText('Centre Hospitalier Universitaire');
      const box = allDenominations.map(el => el.closest('.bg-surface2')).find(Boolean);
      expect(box).toBeInTheDocument();
      expect(box).toHaveClass('bg-surface2');
      expect(box).toHaveClass('rounded');
      expect(box).toHaveClass('border');
      expect(box).toHaveClass('border-border');

      expect(screen.getAllByText('Centre Hospitalier Universitaire').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Paris')).toBeInTheDocument();
      expect(screen.getByText(/SIRET 12345678900012/)).toBeInTheDocument();
    });
  });

  it('should render fallback dashes when etablissement fields are missing', async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'etablissement_get') {
        return Promise.resolve({
          id: 1,
          denomination: null,
          ville: null,
          siret: null,
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
      if (command === 'travailleur_list') {
        return Promise.resolve([]);
      }
      if (command === 'appareil_list') {
        return Promise.resolve([]);
      }
      if (command === 'verification_list') {
        return Promise.resolve([]);
      }
      if (command === 'controle_qualite_list') {
        return Promise.resolve([]);
      }
      return Promise.resolve({});
    });

    renderWithProviders(<Sidebar />, { route: '/' });

    await waitFor(() => {
      const box = document.querySelector('.bg-surface2');
      expect(box).toBeInTheDocument();
      const dashes = box?.querySelectorAll('div');
      const textContent = box?.textContent || '';
      expect(textContent).toContain('—');
    });
  });
});
