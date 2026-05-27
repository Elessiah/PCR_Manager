import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const FIXED_DATE = new Date('2026-05-27T00:00:00');
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
  dosimetrie_passive_date: '2024-01-15',        // deadline 2026-01-15 → en_retard
  dosimetrie_operationnelle_date: '2024-02-15', // deadline 2026-02-15 → en_retard
  formation_rp_travailleurs_date: '2023-01-01', // deadline 2026-01-01 (3yr) → en_retard
  formation_rp_patients_date: '2019-01-15',     // deadline 2026-01-15 (7yr) → en_retard
  visite_medicale_date: '2025-06-01',
  visite_medicale_date_peremption: '2026-06-01', // → a_prevoir
  visite_medicale_duree_mois: 12,
  updated_at: '2025-01-01T00:00:00Z',
};

const mockHabilitation2: Habilitation = {
  id: 2,
  travailleur_id: 2,
  dosimetrie_passive_date: '2024-06-15',        // deadline 2026-06-15 → a_prevoir
  dosimetrie_operationnelle_date: '2024-07-15', // deadline 2026-07-15 → a_prevoir
  formation_rp_travailleurs_date: null,
  formation_rp_patients_date: '2019-07-01',     // deadline 2026-07-01 (7yr) → a_prevoir
  visite_medicale_date: '2024-12-15',
  visite_medicale_date_peremption: '2025-12-15', // → en_retard
  visite_medicale_duree_mois: 12,
  updated_at: '2025-01-01T00:00:00Z',
};

vi.mocked(invoke).mockImplementation(async (cmd, args?: unknown) => {
  switch (cmd) {
    case 'travailleur_list':
      return [mockTravailleur1, mockTravailleur2];
    case 'habilitation_get_for_travailleur': {
      const a = args as { travailleurId?: number } | undefined;
      if (a?.travailleurId === 1) return mockHabilitation1;
      if (a?.travailleurId === 2) return mockHabilitation2;
      return null;
    }
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
          date_echeance: '2026-06-15', // a_prevoir sous 2026-05-27 (était 2027-10-15 → valide)
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
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(FIXED_DATE)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

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

    // Wait for habilitation-based actions to load (total = 12)
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const toutButton = buttons.find((btn) => btn.textContent?.includes('Tout'));
      expect(toutButton?.textContent).toContain('12');
    });

    // 1 vérif + 2 contrôles + 3 formations + 2 visites médicales + 2 dosimétrie passive + 2 dosimétrie op = 12
    const buttons = screen.getAllByRole('button');
    const toutButton = buttons.find((btn) => btn.textContent?.includes('Tout'));
    const controleButton = buttons.find((btn) => btn.textContent?.includes('Contrôle'));

    expect(toutButton?.textContent).toContain('12');
    expect(controleButton?.textContent).toContain('2');
  });

  it('should update filter counters when filtering', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    // Wait for habilitation-based actions to load
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const toutButton = buttons.find((btn) => btn.textContent?.includes('Tout'));
      expect(toutButton?.textContent).toContain('12');
    });

    const buttons = screen.getAllByRole('button');
    const enRetardButton = buttons.find((btn) => btn.textContent?.includes('En retard'));

    // CQ 1 (2024-01-01) → en_retard
    // Formation trav Jean (2023-01-01 + 3yr = 2026-01-01) → en_retard
    // Formation pat Jean (2019-01-15 + 7yr = 2026-01-15) → en_retard
    // Dosimétrie passive Jean (2024-01-15 + 2yr = 2026-01-15) → en_retard
    // Dosimétrie op Jean (2024-02-15 + 2yr = 2026-02-15) → en_retard
    // Visite Marie Martin (peremption 2025-12-15) → en_retard
    // Total en retard = 6
    expect(enRetardButton?.textContent).toContain('6');

    const aVenirButton = buttons.find((btn) => btn.textContent?.includes('À venir'));
    // Vérification (2025-06-15 + 1yr = 2026-06-15) → a_prevoir
    // CQ 2 (2026-06-15) → a_prevoir
    // Visite Jean Dupont (peremption 2026-06-01) → a_prevoir
    // Formation pat Marie (2019-07-01 + 7yr = 2026-07-01) → a_prevoir
    // Dosimétrie passive Marie (2024-06-15 + 2yr = 2026-06-15) → a_prevoir
    // Dosimétrie op Marie (2024-07-15 + 2yr = 2026-07-15) → a_prevoir
    // Total à venir = 6
    expect(aVenirButton?.textContent).toContain('6');
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

    // Travailleur 1 has formation_rp_travailleurs_date = 2023-01-01, so deadline should be 2026-01-01 → en_retard
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

    // Travailleur 2 has formation_rp_travailleurs_date = null → pas de formation travailleurs
    // mais formation_rp_patients_date est renseignée → une formation patients est générée
    const rows = screen.getAllByRole('row');
    const marioTravailleursRows = rows.filter(row =>
      row.textContent?.includes('Formation radioprotection travailleurs') && row.textContent?.includes('Marie Martin')
    );
    expect(marioTravailleursRows.length).toBe(0);
  });

  it('should count Formation actions in pills', async () => {
    renderWithProviders(<Actions />, { route: '/actions' });

    // Wait for habilitation data to be loaded (total should be 8 once all loaded)
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const formationButton = buttons.find((btn) => btn.textContent?.includes('Formation'));
      expect(formationButton?.textContent).toContain('3');
    });

    const buttons = screen.getAllByRole('button');
    const formationButton = buttons.find((btn) => btn.textContent?.includes('Formation'));

    // 3 Formation actions: travailleurs Jean Dupont + patients Jean Dupont + patients Marie Martin
    expect(formationButton?.textContent).toContain('3');
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
      // 1 vérif + 2 contrôles + 3 formations + 2 visites méd + 2 dosimétrie passive + 2 dosimétrie op = 12
      expect(toutButton?.textContent).toContain('12');
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
      // Header + 3 Formation actions (travailleurs Jean, patients Jean, patients Marie)
      expect(rows.length).toBe(4);
      for (let i = 1; i <= 3; i++) {
        expect(rows[i].textContent).toContain('Formation radioprotection');
      }
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
      expect(toutButton?.textContent).toContain('12');
    });

    // Check that Formation badge (span) appears in table rows — span elements carry bg-neutralBg
    const formationElements = screen.getAllByText('Formation');
    // At least one span (badge in table) should have bg-neutralBg
    const formationBadgeSpans = formationElements.filter(el => el.tagName === 'SPAN');
    expect(formationBadgeSpans.length).toBeGreaterThan(0);
    formationBadgeSpans.forEach(badge => {
      expect(badge).toHaveClass('bg-neutralBg');
    });

    // Check that Visite médicale badge appears in table rows
    const visitBadges = screen.getAllByText('Visite médicale');
    const visitBadgeSpans = visitBadges.filter(el => el.tagName === 'SPAN');
    expect(visitBadgeSpans.length).toBeGreaterThan(0);
    visitBadgeSpans.forEach(badge => {
      expect(badge).toHaveClass('bg-neutralBg');
    });
  });
});
