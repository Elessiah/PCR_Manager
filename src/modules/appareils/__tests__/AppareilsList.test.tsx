import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import AppareilsList from '../AppareilsList';
import { renderWithProviders } from '../../../test/test-utils';
import type { Appareil, VerificationTechnique, ControleQualite } from '../../../types/domain';

vi.mock('@tauri-apps/api/core');

describe('AppareilsList', () => {
  const mockAppareils: Appareil[] = [
    {
      id: 1,
      etablissement_id: 1,
      designation: 'Appareil Radiographique X100',
      marque: 'Siemens',
      modele: 'AXIOM Alpha',
      numero_serie: 'SN-2023-001',
      type_: 'Radiographe dentaire',
      annee_mise_en_service: 2023,
      lieu_utilisation: 'Cabinet dentaire A',
      utilisation_partagee: 0,
      tension_nominale_kv: 70,
      intensite_maximale_ma: 10,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    },
    {
      id: 2,
      etablissement_id: 1,
      designation: 'Panoramique Digital',
      marque: 'Planmeca',
      modele: 'Viso G7',
      numero_serie: 'SN-2023-002',
      type_: 'Panoramique',
      annee_mise_en_service: 2022,
      lieu_utilisation: 'Cabinet dentaire B',
      utilisation_partagee: 1,
      tension_nominale_kv: 60,
      intensite_maximale_ma: 8,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    },
  ];

  const mockVerifications: VerificationTechnique[] = [
    {
      id: 1,
      appareil_id: 1,
      type_: 'annuelle_interne',
      date_realisation: '2024-01-15',
      realise_par: 'Technicien PCR',
      organisme: 'PCR Interne',
      observations: 'Vérification OK',
      created_at: '2024-01-15T00:00:00Z',
    },
    {
      id: 2,
      appareil_id: 1,
      type_: 'triennale_externe',
      date_realisation: '2023-06-20',
      realise_par: 'Bureau technique',
      organisme: 'Organisme agréé',
      observations: null,
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
      organisme: 'Labo test',
      realise_par: 'Labo',
      statut: 'realise',
      observations: null,
      created_at: '2024-01-10T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    const invoiceMock = vi.mocked(invoke);
    invoiceMock.mockImplementation((command: string, _args?: any) => {
      switch (command) {
        case 'appareil_list':
          return Promise.resolve(mockAppareils);
        case 'verification_list':
          return Promise.resolve(mockVerifications);
        case 'controle_qualite_list':
          return Promise.resolve(mockControles);
        default:
          return Promise.resolve(null);
      }
    });
  });

  it('should render list of appareils with basic info', async () => {
    renderWithProviders(<AppareilsList />, { route: '/appareils' });

    await waitFor(() => {
      expect(screen.getByText('Appareil Radiographique X100')).toBeInTheDocument();
    });

    expect(screen.getByText('Panoramique Digital')).toBeInTheDocument();
  });

  it('should display appareil details in table', async () => {
    renderWithProviders(<AppareilsList />, { route: '/appareils' });

    await waitFor(() => {
      expect(screen.getByText('SN-2023-001')).toBeInTheDocument();
    });

    expect(screen.getByText('SN-2023-002')).toBeInTheDocument();
    expect(screen.getByText('Cabinet dentaire A')).toBeInTheDocument();
    expect(screen.getByText('Cabinet dentaire B')).toBeInTheDocument();
  });

  it('should display count of appareils', async () => {
    renderWithProviders(<AppareilsList />, { route: '/appareils' });

    await waitFor(() => {
      expect(screen.getByText(/2 appareils radiologiques sous contrôle réglementaire/)).toBeInTheDocument();
    });
  });

  it('should filter appareils by search query', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppareilsList />, { route: '/appareils' });

    const searchInput = await screen.findByPlaceholderText('Rechercher un appareil');
    await user.type(searchInput, 'Panoramique');

    await waitFor(() => {
      expect(screen.getByText(/1 résultats/)).toBeInTheDocument();
    });

    expect(screen.queryByText('Appareil Radiographique X100')).not.toBeInTheDocument();
    expect(screen.getByText('Panoramique Digital')).toBeInTheDocument();
  });

  it('should open add modal when button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppareilsList />, { route: '/appareils' });

    const addButton = await screen.findByText('Ajouter un appareil');
    await user.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Désignation *')).toBeInTheDocument();
    });
  });

  it('should submit form with designation and call api.appareil.create', async () => {
    const user = userEvent.setup();
    const invoiceMock = vi.mocked(invoke);

    invoiceMock.mockImplementation((command: string, args?: any) => {
      if (command === 'appareil_list') return Promise.resolve(mockAppareils);
      if (command === 'verification_list') return Promise.resolve(mockVerifications);
      if (command === 'controle_qualite_list') return Promise.resolve(mockControles);
      if (command === 'appareil_create') return Promise.resolve(3);
      return Promise.resolve(null);
    });

    renderWithProviders(<AppareilsList />, { route: '/appareils' });

    const addButton = await screen.findByText('Ajouter un appareil');
    await user.click(addButton);

    const designationInput = await screen.findByPlaceholderText('Ex : Tube radiogène');
    await user.type(designationInput, 'Nouveau tube X');

    const submitButton = screen.getByRole('button', { name: /^Ajouter$/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('appareil_create', expect.objectContaining({
        etablissementId: 1,
        designation: 'Nouveau tube X',
      }));
    });
  });

  it('should disable submit button when designation is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppareilsList />, { route: '/appareils' });

    const addButton = await screen.findByText('Ajouter un appareil');
    await user.click(addButton);

    const submitButton = await screen.findByRole('button', { name: /^Ajouter$/ });
    expect(submitButton).toBeDisabled();
  });
});
