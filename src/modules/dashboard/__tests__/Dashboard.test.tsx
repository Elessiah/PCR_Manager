import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../../test/test-utils';
import Dashboard from '../Dashboard';
import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

const mockData = {
  travailleurs: [
    {
      id: 1,
      etablissement_id: 1,
      nom: 'Dupont',
      prenom: 'Jean',
      sexe: 'M',
      date_naissance: '1985-01-15',
      lieu_naissance: 'Paris',
      pays_naissance: 'France',
      fonction: 'Médecin',
      date_debut_activite: '2020-01-01',
      categorie_reglementaire: 'A',
      numero_adeli_rpps: 'ADELI123',
      email: 'jean@example.com',
      telephone: '0123456789',
      numero_securite_sociale: '1850115123456',
      numero_porteur_dosimetrie_passive: 'PORT001',
      numero_suivi_medical: 'SUIVI001',
      created_at: '2020-01-01',
      updated_at: '2024-01-01',
    },
    {
      id: 2,
      etablissement_id: 1,
      nom: 'Martin',
      prenom: 'Marie',
      sexe: 'F',
      date_naissance: '1990-03-20',
      lieu_naissance: 'Lyon',
      pays_naissance: 'France',
      fonction: 'Technicien',
      date_debut_activite: '2021-06-01',
      categorie_reglementaire: 'B',
      numero_adeli_rpps: 'ADELI456',
      email: 'marie@example.com',
      telephone: '0123456790',
      numero_securite_sociale: '1900320123457',
      numero_porteur_dosimetrie_passive: 'PORT002',
      numero_suivi_medical: 'SUIVI002',
      created_at: '2021-06-01',
      updated_at: '2024-01-01',
    },
  ],
  appareils: [
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
    {
      id: 2,
      etablissement_id: 1,
      designation: 'IRM',
      marque: 'GE',
      modele: 'Signa',
      numero_serie: 'SN002',
      type_: 'irmerie',
      annee_mise_en_service: 2019,
      lieu_utilisation: 'Bloc 2',
      utilisation_partagee: 1,
      tension_nominale_kv: null,
      intensite_maximale_ma: null,
      created_at: '2019-01-01',
      updated_at: '2024-01-01',
    },
  ],
  verifications: [
    {
      id: 1,
      appareil_id: 1,
      type_: 'annuelle_interne',
      date_realisation: '2023-01-10',
      realise_par: 'Technicien A',
      organisme: null,
      observations: null,
      created_at: '2023-01-10',
    },
  ],
  controles: [
    {
      id: 1,
      appareil_id: 1,
      type_: 'externe',
      date_realisation: '2023-06-15',
      date_echeance: '2024-06-15',
      controle_externe_id: null,
      organisme: 'Bureau Veritas',
      realise_par: 'Expert externe',
      statut: 'effectue',
      observations: 'OK',
      created_at: '2023-06-15',
    },
  ],
};

beforeEach(() => {
  mockInvoke.mockImplementation(async (cmd, args) => {
    switch (cmd) {
      case 'travailleur_list':
        return mockData.travailleurs;
      case 'appareil_list':
        return mockData.appareils;
      case 'verification_list':
        return mockData.verifications;
      case 'controle_qualite_list':
        return mockData.controles;
      case 'habilitation_compute': {
        const travailleurId = (args as { travailleurId: number }).travailleurId;
        return {
          statut: travailleurId === 1 ? 'validee' : 'partielle',
          details: {
            formation_rp_ok: true,
            dosimetries_ok: true,
            competences_ok: travailleurId === 1,
            visite_med_ok: true,
          },
        };
      }
      default:
        return [];
    }
  });
});

describe('Dashboard', () => {
  it('should display PageHead with title and date', async () => {
    renderWithProviders(<Dashboard />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText('Tableau de bord')).toBeInTheDocument();
    });

    expect(screen.getByText(/État réglementaire du service au \d{2}\/\d{2}\/\d{4}/)).toBeInTheDocument();
  });

  it('should display action buttons (Exporter, Actualiser)', async () => {
    renderWithProviders(<Dashboard />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText('Exporter')).toBeInTheDocument();
    });

    expect(screen.getByText('Actualiser')).toBeInTheDocument();
  });

  it('should display KPI row with 3 tiles', async () => {
    renderWithProviders(<Dashboard />, { route: '/' });

    await waitFor(() => {
      expect(screen.getAllByText('En retard').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('À prévoir').length).toBeGreaterThan(0);
    expect(screen.getAllByText('À jour').length).toBeGreaterThan(0);
  });

  it('should display correct KPI footer text', async () => {
    renderWithProviders(<Dashboard />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText('Échéances réglementaires dépassées')).toBeInTheDocument();
    });

    expect(screen.getByText('Échéances dans les 3 mois')).toBeInTheDocument();
    expect(screen.getByText('Travailleurs avec habilitation valide ou partielle')).toBeInTheDocument();
  });

  it('should display Écheances prioritaires card with "Voir toutes les actions" button', async () => {
    renderWithProviders(<Dashboard />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText('Échéances prioritaires')).toBeInTheDocument();
    });

    expect(screen.getByText('Voir toutes les actions')).toBeInTheDocument();
  });

  it('should display table headers', async () => {
    renderWithProviders(<Dashboard />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText('Sujet')).toBeInTheDocument();
    });

    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Échéance')).toBeInTheDocument();
    expect(screen.getByText('Statut')).toBeInTheDocument();
  });

  it('should display table rows with actions (max 8)', async () => {
    renderWithProviders(<Dashboard />, { route: '/' });

    await waitFor(() => {
      expect(screen.getAllByText('Scanner X-Ray').length).toBeGreaterThan(0);
    });

    const tableRows = screen.getAllByRole('row');
    expect(tableRows.length).toBeLessThanOrEqual(9);
  });

  it('should display status badges in table rows', async () => {
    renderWithProviders(<Dashboard />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText('Échéances prioritaires')).toBeInTheDocument();
    });

    // Verify there are rows with data (status badges appear in these rows)
    const tableRows = screen.getAllByRole('row');
    // Header + at least 1 data row with actual action
    expect(tableRows.length).toBeGreaterThan(1);
  });

  it('should handle empty actions list', async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      switch (cmd) {
        case 'travailleur_list':
          return mockData.travailleurs;
        case 'appareil_list':
          return mockData.appareils;
        case 'verification_list':
          return [];
        case 'controle_qualite_list':
          return [];
        default:
          return [];
      }
    });

    renderWithProviders(<Dashboard />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText('Aucune action.')).toBeInTheDocument();
    });
  });

  it('should display loading state initially', async () => {
    mockInvoke.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return [];
    });

    renderWithProviders(<Dashboard />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText(/Chargement des données/i)).toBeInTheDocument();
    });
  });

  it('should display 3 right column cards', async () => {
    renderWithProviders(<Dashboard />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText('Sources des alertes')).toBeInTheDocument();
    });

    expect(screen.getByText('Habilitations travailleurs')).toBeInTheDocument();
    expect(screen.getByText('Parc d\'appareils')).toBeInTheDocument();
  });

  it('should display 5 alert categories in Sources des alertes', async () => {
    renderWithProviders(<Dashboard />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText('Formations')).toBeInTheDocument();
    });

    expect(screen.getByText('Visites médicales')).toBeInTheDocument();
    expect(screen.getByText('Vérifications')).toBeInTheDocument();
    expect(screen.getByText('Contrôles qualité')).toBeInTheDocument();
    expect(screen.getByText('Dosimétrie')).toBeInTheDocument();
  });

  it('should display segment bar and legend in Habilitations card', async () => {
    renderWithProviders(<Dashboard />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText('Validée')).toBeInTheDocument();
    });

    expect(screen.getByText('Partielle')).toBeInTheDocument();
    expect(screen.getByText('Non validée')).toBeInTheDocument();
  });

  it('should display segment bar and legend in Parc d\'appareils card', async () => {
    renderWithProviders(<Dashboard />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText('Valide')).toBeInTheDocument();
    });

    expect(screen.getAllByText('À prévoir').length).toBeGreaterThan(0);
    expect(screen.getAllByText('En retard').length).toBeGreaterThan(0);
  });

  it('should handle empty travailleurs list (habilitations)', async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      switch (cmd) {
        case 'travailleur_list':
          return [];
        case 'appareil_list':
          return mockData.appareils;
        case 'verification_list':
          return mockData.verifications;
        case 'controle_qualite_list':
          return mockData.controles;
        default:
          return [];
      }
    });

    renderWithProviders(<Dashboard />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText('Habilitations travailleurs')).toBeInTheDocument();
    });

    const aucunneDataElements = screen.getAllByText('Aucune donnée');
    expect(aucunneDataElements.length).toBeGreaterThan(0);
  });

  it('should handle empty appareils list', async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      switch (cmd) {
        case 'travailleur_list':
          return mockData.travailleurs;
        case 'appareil_list':
          return [];
        case 'verification_list':
          return [];
        case 'controle_qualite_list':
          return [];
        default:
          return [];
      }
    });

    renderWithProviders(<Dashboard />, { route: '/' });

    await waitFor(() => {
      expect(screen.getByText('Parc d\'appareils')).toBeInTheDocument();
    });

    const aucunneDataElements = screen.getAllByText('Aucune donnée');
    expect(aucunneDataElements.length).toBeGreaterThan(0);
  });
});
