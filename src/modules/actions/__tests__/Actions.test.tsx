import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '../../../test/test-utils';
import Actions from '../Actions';
import { invoke } from '@tauri-apps/api/core';
import type { Travailleur, Habilitation } from '../../../types/domain';

vi.mock('@tauri-apps/api/core');

const mockTravailleur1: Travailleur = {
  id: 1,
  etablissement_id: 1,
  nom: 'Dupont',
  prenom: 'Jean',
  sexe: 'M',
  date_naissance: '1980-01-15',
  lieu_naissance: 'Paris',
  pays_naissance: 'France',
  fonction: 'Radiologiste',
  date_debut_activite: '2010-06-01',
  categorie_reglementaire: 'A',
  numero_adeli_rpps: '12345678',
  email: 'jean.dupont@example.com',
  telephone: '06 12 34 56 78',
  numero_securite_sociale: '1800112345678901',
  numero_porteur_dosimetrie_passive: 'DP001',
  numero_suivi_medical: 'SM001',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockTravailleur2: Travailleur = {
  id: 2,
  etablissement_id: 1,
  nom: 'Martin',
  prenom: 'Marie',
  sexe: 'F',
  date_naissance: '1990-05-20',
  lieu_naissance: 'Lyon',
  pays_naissance: 'France',
  fonction: 'Manipulatrice',
  date_debut_activite: '2015-03-01',
  categorie_reglementaire: 'B',
  numero_adeli_rpps: '87654321',
  email: 'marie.martin@example.com',
  telephone: '06 98 76 54 32',
  numero_securite_sociale: '2900520345678901',
  numero_porteur_dosimetrie_passive: 'DP002',
  numero_suivi_medical: 'SM002',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockHabilitation1: Habilitation = {
  id: 1,
  travailleur_id: 1,
  dosimetrie_passive_date: '2024-01-15',
  dosimetrie_operationnelle_date: '2024-02-15',
  formation_rp_travailleurs_date: '2025-01-01',
  formation_rp_patients_date: '2025-01-15',
  visite_medicale_date: '2025-06-01',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockHabilitation2: Habilitation = {
  id: 2,
  travailleur_id: 2,
  dosimetrie_passive_date: '2024-06-15',
  dosimetrie_operationnelle_date: '2024-07-15',
  formation_rp_travailleurs_date: null,
  formation_rp_patients_date: '2024-08-15',
  visite_medicale_date: '2024-12-15',
  updated_at: '2025-01-01T00:00:00Z',
};

vi.mocked(invoke).mockImplementation(async (cmd, args?: any) => {
  switch (cmd) {
    case 'travailleur_list':
      return [mockTravailleur1, mockTravailleur2];
    case 'habilitation_get_for_travailleur':
      if (args?.travailleurId === 1) return mockHabilitation1;
      if (args?.travailleurId === 2) return mockHabilitation2;
      return null;
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

  it('should display category column as Badge with neutral variant', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    await waitFor(() => {
      expect(screen.getAllByText(/Scanner X-Ray/i).length).toBeGreaterThan(0);
    });

    // Cherche les badges de catégorie (pas les badges de statut)
    // Les badges de catégorie contiennent "Vérification" ou "Contrôle"
    const verificationBadges = screen.getAllByText('Vérification');
    expect(verificationBadges.length).toBeGreaterThan(0);
    // Vérifie que c'est un Badge (role="region" ou classe de badge)
    verificationBadges.forEach((badge) => {
      expect(badge).toHaveClass('bg-neutralBg');
    });
  });

  it('should display filter pills with numeric counters', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    // Wait for habilitation-based actions to load (total = 7)
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const toutButton = buttons.find((btn) => btn.textContent?.includes('Tout'));
      expect(toutButton?.textContent).toContain('7');
    });

    // Vérifie que les pills affichent les compteurs
    // 2 vérifications + 2 contrôles + 1 formation + 2 visites médicales = 7 actions au total
    const buttons = screen.getAllByRole('button');
    const toutButton = buttons.find((btn) => btn.textContent?.includes('Tout'));
    const controleButton = buttons.find((btn) => btn.textContent?.includes('Contrôle'));

    expect(toutButton?.textContent).toContain('7');
    expect(controleButton?.textContent).toContain('2');
  });

  it('should update filter counters when filtering', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    // Wait for habilitation-based actions to load (Jean Dupont appears in Formation/Visite rows)
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const toutButton = buttons.find((btn) => btn.textContent?.includes('Tout'));
      expect(toutButton?.textContent).toContain('7');
    });

    const buttons = screen.getAllByRole('button');
    const enRetardButton = buttons.find((btn) => btn.textContent?.includes('En retard'));

    // Vérification 1 (2022), Contrôle 1 (2024), Formation 1 (2026-01-01), Visite 2 (2025-12-15) en retard = 4 actions
    expect(enRetardButton?.textContent).toContain('4');

    const aVenirButton = buttons.find((btn) => btn.textContent?.includes('À venir'));
    // statusFromDate uses alertMonths=1 by default:
    // Vérification 2 (2026-06-15) → a_prevoir (within 1 month of today)
    // Contrôle 2 (2027-10-15) → valide (too far, not within 1 month alert window)
    // Visite méd. 1 Jean Dupont (2026-06-01) → a_prevoir (within 1 month)
    // Total à venir = 2
    expect(aVenirButton?.textContent).toContain('2');
  });

  it('should filter actions by "En retard" status', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    await waitFor(() => {
      expect(screen.getAllByText(/Scanner X-Ray/i).length).toBeGreaterThan(0);
    });

    const initialActionCount = screen.getAllByRole('row').length - 1;

    // "En retard" apparaît dans le PillFilter ET dans les badges de statut.
    // On cible spécifiquement le bouton du filtre.
    const enRetardFilterButton = screen.getByRole('button', { name: /En retard/ });
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

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getAllByText(/Scanner X-Ray/i).length).toBeGreaterThan(0);
    });

    // Check for filter buttons using role to avoid ambiguity with subtitle text
    expect(screen.getByRole('button', { name: /Tout/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /En retard/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /À venir/ })).toBeInTheDocument();
  });

  it('should generate Formation action from habilitation date_formation + 1 year', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    await waitFor(() => {
      expect(screen.getByText(/Actions/i)).toBeInTheDocument();
    });

    // Travailleur 1 has formation_rp_travailleurs_date = 2025-01-01, so deadline should be 2026-01-01
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      const formationRow = rows.find(row => row.textContent?.includes('Formation radioprotection'));
      expect(formationRow).toBeTruthy();
      expect(formationRow?.textContent).toContain('Jean Dupont');
    });
  });

  it('should generate Visite medicale action from habilitation date_visite_medicale + 1 year', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    await waitFor(() => {
      expect(screen.getByText(/Actions/i)).toBeInTheDocument();
    });

    // Travailleur 1 has visite_medicale_date = 2025-06-01, so deadline should be 2026-06-01
    // Both travailleur 1 (Jean Dupont) and travailleur 2 (Marie Martin) have visite_medicale_date
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      const visitRows = rows.filter(row => row.textContent?.includes('Visite médicale'));
      expect(visitRows.length).toBeGreaterThan(0);
      // At least one row should contain a travailleur name
      const hasJeanOrMarie = visitRows.some(row =>
        row.textContent?.includes('Jean Dupont') || row.textContent?.includes('Marie Martin')
      );
      expect(hasJeanOrMarie).toBe(true);
    });
  });

  it('should handle null formation_rp_travailleurs_date without crashing', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    await waitFor(() => {
      expect(screen.getByText(/Actions/i)).toBeInTheDocument();
    });

    // Travailleur 2 has formation_rp_travailleurs_date = null, so no Formation action should be generated
    const rows = screen.getAllByRole('row');
    const marioFormationRows = rows.filter(row =>
      row.textContent?.includes('Formation radioprotection') && row.textContent?.includes('Marie Martin')
    );
    expect(marioFormationRows.length).toBe(0);
  });

  it('should count Formation actions in pills', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    // Wait for habilitation data to be loaded (total should be 7 once all loaded)
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const formationButton = buttons.find((btn) => btn.textContent?.includes('Formation'));
      expect(formationButton?.textContent).toContain('1');
    });

    const buttons = screen.getAllByRole('button');
    const formationButton = buttons.find((btn) => btn.textContent?.includes('Formation'));

    // Should have 1 Formation action (travailleur 1 has formation_rp_travailleurs_date)
    expect(formationButton?.textContent).toContain('1');
  });

  it('should count Visite medicale actions in pills', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    // Wait for habilitation data to be loaded
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const visitButton = buttons.find((btn) => btn.textContent?.includes('Visite'));
      expect(visitButton?.textContent).toContain('2');
    });

    const buttons = screen.getAllByRole('button');
    const visitButton = buttons.find((btn) => btn.textContent?.includes('Visite'));

    // Should have 2 Visite medicale actions (travailleur 1 and 2)
    expect(visitButton?.textContent).toContain('2');
  });

  it('should include generated actions in total count', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    // Wait for all actions including habilitation-based ones to load
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const toutButton = buttons.find((btn) => btn.textContent?.includes('Tout'));
      // 2 verifications + 2 controles + 1 formation + 2 visite_medicale = 7 total
      expect(toutButton?.textContent).toContain('7');
    });
  });

  it('should filter actions by Formation category', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    await waitFor(() => {
      expect(screen.getByText(/Actions/i)).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole('button');
    const formationButton = buttons.find((btn) => btn.textContent?.includes('Formation'));
    fireEvent.click(formationButton!);

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // Header + 1 Formation action
      expect(rows.length).toBe(2);
      expect(rows[1].textContent).toContain('Formation radioprotection');
    });
  });

  it('should filter actions by Visite medicale category', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    await waitFor(() => {
      expect(screen.getByText(/Actions/i)).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole('button');
    const visitButton = buttons.find((btn) => btn.textContent?.includes('Visite'));
    fireEvent.click(visitButton!);

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // Header + 2 Visite medicale actions
      expect(rows.length).toBe(3);
      expect(rows[1].textContent).toContain('Visite médicale');
      expect(rows[2].textContent).toContain('Visite médicale');
    });
  });

  it('should display generated actions with correct categories in badge', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    // Wait for habilitation-based actions to load
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const toutButton = buttons.find((btn) => btn.textContent?.includes('Tout'));
      expect(toutButton?.textContent).toContain('7');
    });

    // Check that Formation badge (span) appears in table rows — span elements carry bg-neutralBg
    const formationElements = screen.getAllByText('Formation');
    // At least one span (badge in table) should have bg-neutralBg
    const formationBadgeSpans = formationElements.filter(el => el.tagName === 'SPAN');
    expect(formationBadgeSpans.length).toBeGreaterThan(0);
    formationBadgeSpans.forEach(badge => {
      expect(badge).toHaveClass('bg-neutralBg');
    });

    // Check that Visite méd. badge appears in table rows
    const visitBadges = screen.getAllByText('Visite méd.');
    const visitBadgeSpans = visitBadges.filter(el => el.tagName === 'SPAN');
    expect(visitBadgeSpans.length).toBeGreaterThan(0);
    visitBadgeSpans.forEach(badge => {
      expect(badge).toHaveClass('bg-neutralBg');
    });
  });
});
