import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../../test/test-utils';
import Dashboard from '../Dashboard';
import { invoke } from '@tauri-apps/api/core';

vi.mocked(invoke).mockImplementation(async (cmd) => {
  switch (cmd) {
    case 'travailleur_list':
      return [
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
      ];
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
      ];
    case 'verification_list':
      return [
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
      ];
    case 'controle_qualite_list':
      return [
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
      ];
    default:
      return [];
  }
});

describe('Dashboard', () => {
  it('should display KPI tiles with correct values', async () => {
    renderWithProviders(<Dashboard />, { route: '/' });

    // Wait for queries to resolve
    await waitFor(() => {
      expect(screen.getByText('Travailleurs actifs')).toBeInTheDocument();
    });

    // Check KPI values
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 travailleurs
    expect(screen.getByText('Appareils suivis')).toBeInTheDocument();
  });

  it('should display loading state initially', async () => {
    // Mock with delayed response to catch loading state
    vi.mocked(invoke).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return [];
    });

    renderWithProviders(<Dashboard />, { route: '/' });

    // Check for loading text (may be brief)
    await waitFor(() => {
      expect(screen.getByText(/Chargement des données/i)).toBeInTheDocument();
    });
  });
});
