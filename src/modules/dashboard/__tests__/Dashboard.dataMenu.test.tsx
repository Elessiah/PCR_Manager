import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../../test/test-utils';
import Dashboard from '../Dashboard';
import { invoke } from '@tauri-apps/api/core';
import userEvent from '@testing-library/user-event';

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
  ],
  verifications: [],
  controles: [],
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

describe('Dashboard - Menu Données', () => {
  it('le menu Données affiche les entrées Exporter et Importer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />, { route: '/' });

    // Attendre que le bouton Données soit affiché
    const dataMenuButton = await screen.findByRole('button', { name: /Données/i });
    expect(dataMenuButton).toBeInTheDocument();

    // Cliquer sur le menu
    await user.click(dataMenuButton);

    // Vérifier que les deux options sont visibles
    expect(screen.getByText('Exporter (chiffré)')).toBeInTheDocument();
    expect(screen.getByText('Importer (chiffré)')).toBeInTheDocument();
  });

  it('le menu Données se ferme quand on clique en dehors', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />, { route: '/' });

    const dataMenuButton = await screen.findByRole('button', { name: /Données/i });
    await user.click(dataMenuButton);

    expect(screen.getByText('Exporter (chiffré)')).toBeInTheDocument();

    // Cliquer en dehors du menu (sur le titre par exemple)
    const title = screen.getByText('Tableau de bord');
    await user.click(title);

    // Attendre que le menu se ferme
    await waitFor(() => {
      expect(screen.queryByText('Exporter (chiffré)')).not.toBeInTheDocument();
    });
  });

  it('le menu Données se ferme après avoir cliqué sur Exporter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />, { route: '/' });

    const dataMenuButton = await screen.findByRole('button', { name: /Données/i });
    await user.click(dataMenuButton);

    const exportButton = screen.getByText('Exporter (chiffré)');
    await user.click(exportButton);

    // Attendre que le menu se ferme
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Exporter \(chiffré\)/i })).not.toBeInTheDocument();
    });
  });

  it('le menu Données se ferme après avoir cliqué sur Importer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />, { route: '/' });

    const dataMenuButton = await screen.findByRole('button', { name: /Données/i });
    await user.click(dataMenuButton);

    const importButton = screen.getByText('Importer (chiffré)');
    await user.click(importButton);

    // Attendre que le menu se ferme
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Importer \(chiffré\)/i })).not.toBeInTheDocument();
    });
  });
});
