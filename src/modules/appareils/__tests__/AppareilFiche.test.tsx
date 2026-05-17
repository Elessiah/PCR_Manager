import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import AppareilFiche from '../AppareilFiche';
import { renderWithProviders } from '../../../test/test-utils';
import type { Appareil, VerificationTechnique, ControleQualite } from '../../../types/domain';

vi.mock('@tauri-apps/api/core');

describe('AppareilFiche', () => {
  const mockAppareil: Appareil = {
    id: 1,
    etablissement_id: 1,
    designation: 'Appareil Radiographique X100',
    marque: 'Siemens',
    modele: 'AXIOM Alpha',
    numero_serie: 'SN-2023-001',
    type_: 'Radiographe dentaire',
    annee_mise_en_service: 2023,
    lieu_utilisation: 'Cabinet dentaire principal',
    utilisation_partagee: 0,
    tension_nominale_kv: 70,
    intensite_maximale_ma: 10,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  const mockVerifications: VerificationTechnique[] = [
    {
      id: 1,
      appareil_id: 1,
      type_: 'annuelle_interne',
      date_realisation: '2024-01-15',
      realise_par: 'Technicien PCR',
      organisme: 'PCR Interne',
      observations: 'Vérification annuelle OK',
      created_at: '2024-01-15T00:00:00Z',
    },
    {
      id: 2,
      appareil_id: 1,
      type_: 'triennale_externe',
      date_realisation: '2023-06-20',
      realise_par: 'Bureau technique externe',
      organisme: 'Organisme agréé XYZ',
      observations: 'Vérification triennale conforme',
      created_at: '2023-06-20T00:00:00Z',
    },
  ];

  const mockControles: ControleQualite[] = [
    {
      id: 1,
      appareil_id: 1,
      type_: 'externe',
      date_realisation: '2024-01-10',
      date_echeance: '2025-01-10',
      controle_externe_id: null,
      organisme: 'Labo contrôle qualité',
      realise_par: 'Labo',
      statut: 'realise',
      observations: 'Contrôle externe conforme',
      created_at: '2024-01-10T00:00:00Z',
    },
    {
      id: 2,
      appareil_id: 1,
      type_: 'partiel_interne',
      date_realisation: null,
      date_echeance: '2024-04-10',
      controle_externe_id: 1,
      organisme: null,
      realise_par: null,
      statut: 'planifie',
      observations: null,
      created_at: '2024-01-10T00:00:00Z',
    },
    {
      id: 3,
      appareil_id: 1,
      type_: 'complet_interne',
      date_realisation: null,
      date_echeance: '2024-07-10',
      controle_externe_id: 1,
      organisme: null,
      realise_par: null,
      statut: 'planifie',
      observations: null,
      created_at: '2024-01-10T00:00:00Z',
    },
    {
      id: 4,
      appareil_id: 1,
      type_: 'partiel_interne',
      date_realisation: null,
      date_echeance: '2025-01-10',
      controle_externe_id: 1,
      organisme: null,
      realise_par: null,
      statut: 'planifie',
      observations: null,
      created_at: '2024-01-10T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    const invoiceMock = vi.mocked(invoke);
    invoiceMock.mockImplementation((command: string, args?: unknown) => {
      switch (command) {
        case 'appareil_get':
          if ((args as { id?: number })?.id === 1) {
            return Promise.resolve(mockAppareil);
          }
          return Promise.reject(new Error('Not found'));
        case 'verification_list':
          return Promise.resolve(mockVerifications);
        case 'controle_qualite_list':
          return Promise.resolve(mockControles);
        default:
          return Promise.resolve(null);
      }
    });
  });

  it('should render appareil details', async () => {
    renderWithProviders(<AppareilFiche />, { route: '/appareils/1' });

    // La désignation peut apparaître dans le breadcrumb ET dans le titre/header.
    await waitFor(() => {
      expect(screen.getAllByText('Appareil Radiographique X100').length).toBeGreaterThan(0);
    });

    // "AXIOM Alpha" et "SN-2023-001" peuvent apparaître plusieurs fois (header + section technique).
    expect(screen.getAllByText('AXIOM Alpha').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SN-2023-001').length).toBeGreaterThan(0);
  });

  it('should display general information section', async () => {
    renderWithProviders(<AppareilFiche />, { route: '/appareils/1' });

    await waitFor(() => {
      expect(screen.getByText('Informations générales')).toBeInTheDocument();
    });

    // "Siemens" peut apparaître plusieurs fois (label marque + valeur d'affichage compacte).
    expect(screen.getAllByText('Siemens').length).toBeGreaterThan(0);
    expect(screen.getByText('Cabinet dentaire principal')).toBeInTheDocument();
  });

  it('should display technical characteristics section', async () => {
    renderWithProviders(<AppareilFiche />, { route: '/appareils/1' });

    await waitFor(() => {
      expect(screen.getByText('Caractéristiques techniques')).toBeInTheDocument();
    });

    expect(screen.getByText('70 kV')).toBeInTheDocument();
    expect(screen.getByText('10 mA')).toBeInTheDocument();
  });

  it('should display verification technique section', async () => {
    renderWithProviders(<AppareilFiche />, { route: '/appareils/1' });

    await waitFor(() => {
      expect(screen.getByText('Vérification technique')).toBeInTheDocument();
    });

    expect(screen.getByText('Vérification annuelle interne')).toBeInTheDocument();
    expect(screen.getByText('Vérification triennale externe')).toBeInTheDocument();
  });

  it('should display controle qualite section with multiple items', async () => {
    renderWithProviders(<AppareilFiche />, { route: '/appareils/1' });

    await waitFor(() => {
      expect(screen.getByText('Contrôle qualité')).toBeInTheDocument();
      expect(screen.getByText('Contrôle qualité externe — point de départ du cycle')).toBeInTheDocument();
      expect(screen.getByText('Contrôle qualité partiel interne (3 mois)')).toBeInTheDocument();
      expect(screen.getByText('Contrôle qualité complet interne (6 mois)')).toBeInTheDocument();
      expect(screen.getByText('Contrôle qualité partiel interne (9 mois)')).toBeInTheDocument();
    });
  });

  it('should display button to add verification', async () => {
    renderWithProviders(<AppareilFiche />, { route: '/appareils/1' });

    const saisirButton = await screen.findByRole('button', { name: /^Saisir$/ });
    expect(saisirButton).toBeInTheDocument();
  });

  it('should display button to add controle qualite externe', async () => {
    renderWithProviders(<AppareilFiche />, { route: '/appareils/1' });

    await waitFor(() => {
      expect(screen.getByText('Saisir CQ externe')).toBeInTheDocument();
    });
  });

  it('should allow clicking Saisir button for verification', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppareilFiche />, { route: '/appareils/1' });

    const saisirButton = await screen.findByRole('button', { name: /^Saisir$/ });
    await user.click(saisirButton);

    await waitFor(() => {
      expect(screen.getByText('Nouvelle vérification technique')).toBeInTheDocument();
    });
  });

  it('should allow clicking Saisir CQ externe button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppareilFiche />, { route: '/appareils/1' });

    const saisirCQButton = await screen.findByText('Saisir CQ externe');
    await user.click(saisirCQButton);

    await waitFor(() => {
      expect(screen.getByText('Nouveau contrôle qualité externe')).toBeInTheDocument();
    });
  });

  it('should display "Marquer effectué" button for planned controls', async () => {
    renderWithProviders(<AppareilFiche />, { route: '/appareils/1' });

    await waitFor(() => {
      const marquerButtons = screen.queryAllByText('Marquer effectué');
      expect(marquerButtons.length).toBeGreaterThan(0);
    });
  });

  it('should display verification dates from mock data', async () => {
    renderWithProviders(<AppareilFiche />, { route: '/appareils/1' });

    await waitFor(() => {
      expect(screen.getByText('15/01/2024')).toBeInTheDocument();
      expect(screen.getByText('20/06/2023')).toBeInTheDocument();
    });
  });
});
