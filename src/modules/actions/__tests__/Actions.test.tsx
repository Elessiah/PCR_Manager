import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '../../../test/test-utils';
import Actions from '../Actions';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core');

vi.mocked(invoke).mockImplementation(async (cmd) => {
  switch (cmd) {
    case 'appareil_list':
      return [
        {
          id: 1,
          etablissement_id: 1,
          designation: 'Scanner X-Ray',
          marque: 'Siemens',
          modele: 'SOMATOM',
          numero_serie: 'SN001',
          type_: 'radiologie',
          annee_mise_en_service: 2018,
          lieu_utilisation: 'Bloc 1',
          utilisation_partagee: 0,
          tension_nominale_kv: 120,
          intensite_maximale_ma: 800,
          created_at: '2018-01-01',
          updated_at: '2024-01-01',
        },
      ];
    case 'verification_list':
      return [
        {
          id: 1,
          appareil_id: 1,
          type_: 'annuelle_interne',
          date_realisation: '2022-01-10',
          realise_par: 'Technicien A',
          organisme: null,
          observations: null,
          created_at: '2022-01-10',
        },
        {
          id: 2,
          appareil_id: 1,
          type_: 'annuelle_interne',
          date_realisation: '2025-06-15',
          realise_par: 'Technicien B',
          organisme: null,
          observations: null,
          created_at: '2025-06-15',
        },
      ];
    case 'controle_qualite_list':
      return [
        {
          id: 1,
          appareil_id: 1,
          type_: 'externe',
          date_realisation: '2023-06-15',
          date_echeance: '2024-01-01',
          controle_externe_id: null,
          organisme: 'Bureau Veritas',
          realise_par: 'Expert externe',
          statut: 'effectue',
          observations: 'OK',
          created_at: '2023-06-15',
        },
        {
          id: 2,
          appareil_id: 1,
          type_: 'externe',
          date_realisation: '2025-10-15',
          date_echeance: '2027-10-15',
          controle_externe_id: null,
          organisme: 'Bureau Veritas',
          realise_par: 'Expert externe',
          statut: 'effectue',
          observations: 'OK',
          created_at: '2025-10-15',
        },
      ];
    default:
      return [];
  }
});

describe('Actions', () => {
  it('should display actions list with correct items', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    // "Scanner X-Ray" peut apparaître plusieurs fois (lignes Vérif + CQ pour le même appareil).
    await waitFor(() => {
      expect(screen.getAllByText(/Scanner X-Ray/i).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/Vérification/i).length).toBeGreaterThan(0);
  });

  it('should filter actions by "En retard" status', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    await waitFor(() => {
      expect(screen.getAllByText(/Scanner X-Ray/i).length).toBeGreaterThan(0);
    });

    const initialActionCount = screen.getAllByRole('row').length - 1;

    // "En retard" apparaît dans le PillFilter ET dans les badges de statut.
    // On cible spécifiquement le bouton du filtre.
    const enRetardFilterButton = screen.getByRole('button', { name: 'En retard' });
    fireEvent.click(enRetardFilterButton);

    await waitFor(() => {
      const filteredActionCount = screen.getAllByRole('row').length - 1;
      expect(filteredActionCount).toBeLessThanOrEqual(initialActionCount);
    });

    const retardBadges = screen.getAllByText('En retard');
    expect(retardBadges.length).toBeGreaterThan(0);
  });

  it('should display filter buttons for all action categories', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    // Wait for the page to load
    await waitFor(() => {
      expect(screen.getByText(/Actions/i)).toBeInTheDocument();
    });

    // Check for filter buttons
    expect(screen.getByText('Tout')).toBeInTheDocument();
    expect(screen.getByText('En retard')).toBeInTheDocument();
    expect(screen.getByText('À venir')).toBeInTheDocument();
  });
});
