/**
 * Tests E2E — Dashboard : compteurs KPI "En retard" et "À prévoir"
 *
 * Date de référence : 2026-05-27 (vi.setSystemTime) → résultats déterministes.
 *
 * Règles métier testées :
 *  - Les items habilitation en retard (dosimétrie, formation, visite) font
 *    monter le compteur "En retard" du Dashboard.
 *  - Les items à prévoir font monter le compteur "À prévoir".
 *  - Chaque travailleur contribue indépendamment aux compteurs.
 *  - Les dates null (non renseignées) ne contribuent à aucun compteur.
 *
 * Seuils dans Dashboard (alertCategories) :
 *   dosimétrie     → alertMonths = 1 (default), seulement danger
 *   formation_trav → alertMonths = 3, danger + warn
 *   formation_pat  → alertMonths = 1 (default), seulement danger
 *   visite méd     → alertMonths = 3, danger + warn
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderWithProviders, screen, waitFor } from '../../../test/test-utils'
import { invoke } from '@tauri-apps/api/core'
import Dashboard from '../Dashboard'
import type { Travailleur, Habilitation, HabilitationStatus } from '../../../types/domain'

const FIXED_DATE = new Date('2026-05-27T00:00:00')

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeTravailleur = (id: number, nom: string): Travailleur => ({
  id,
  etablissement_id: 1,
  nom,
  prenom: 'Test',
  sexe: null,
  date_naissance: null,
  lieu_naissance: null,
  pays_naissance: null,
  fonction: null,
  date_debut_activite: null,
  categorie_reglementaire: null,
  numero_adeli_rpps: null,
  email: null,
  telephone: null,
  numero_securite_sociale: null,
  numero_porteur_dosimetrie_passive: null,
  numero_suivi_medical: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
})

const baseHab = (travailleurId: number, overrides: Partial<Habilitation> = {}): Habilitation => ({
  id: travailleurId,
  travailleur_id: travailleurId,
  dosimetrie_passive_date: null,
  dosimetrie_operationnelle_date: null,
  formation_rp_travailleurs_date: null,
  formation_rp_patients_date: null,
  visite_medicale_date: null,
  visite_medicale_date_peremption: null,
  visite_medicale_duree_mois: null,
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides,
})

const habStatus = (statut: HabilitationStatus['statut']): HabilitationStatus => ({
  statut,
  details: {
    formation_rp_ok: statut === 'validee',
    formation_rp_patients_ok: statut === 'validee',
    dosimetries_ok: statut === 'validee',
    competences_ok: statut === 'validee',
    visite_med_ok: statut === 'validee',
  },
})

function setupMocks(
  travailleurs: Travailleur[],
  habilitations: Record<number, Partial<Habilitation>>,
  habStatuses: Record<number, HabilitationStatus['statut']> = {}
) {
  vi.mocked(invoke).mockImplementation(async (cmd, args?: unknown) => {
    const a = args as { travailleurId?: number } | undefined
    switch (cmd) {
      case 'travailleur_list':
        return travailleurs
      case 'habilitation_compute': {
        const tId = a?.travailleurId ?? 0
        return habStatus(habStatuses[tId] ?? 'non_validee')
      }
      case 'habilitation_get_for_travailleur': {
        const tId = a?.travailleurId ?? 0
        return baseHab(tId, habilitations[tId] ?? {})
      }
      case 'appareil_list':
        return []
      case 'verification_list':
        return []
      case 'controle_qualite_list':
        return []
      case 'competence_list':
        return []
      case 'competence_general_get_for_travailleur':
        return []
      case 'competence_get_for_travailleur':
        return []
      default:
        return []
    }
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Dashboard — compteurs KPI basés sur les habilitations', () => {

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(FIXED_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Dosimétrie passive + opérationnelle en retard → "2 retard" dans Dosimétrie', () => {
    beforeEach(() => {
      setupMocks(
        [makeTravailleur(1, 'Dupont')],
        {
          1: {
            // deadline 2026-04-01 < 2026-05-27 → en_retard (alertMonths=1)
            dosimetrie_passive_date: '2024-04-01',
            dosimetrie_operationnelle_date: '2024-04-01',
          },
        }
      )
    })

    it('la source Dosimétrie affiche "2 retard"', async () => {
      renderWithProviders(<Dashboard />, { route: '/' })
      await waitFor(() => {
        expect(screen.getByText('Dosimétrie')).toBeInTheDocument()
      })
      await waitFor(() => {
        expect(screen.getByText('2 retard')).toBeInTheDocument()
      })
    })
  })

  describe('Formation RP travailleurs en retard → "1 retard" dans Formations', () => {
    beforeEach(() => {
      setupMocks(
        [makeTravailleur(1, 'Dupont')],
        {
          1: {
            // deadline 2025-01-01 < 2026-05-27 → en_retard (alertMonths=3)
            formation_rp_travailleurs_date: '2022-01-01',
          },
        }
      )
    })

    it('la source Formations affiche "1 retard"', async () => {
      renderWithProviders(<Dashboard />, { route: '/' })
      await waitFor(() => {
        expect(screen.getByText('Formations')).toBeInTheDocument()
      })
      await waitFor(() => {
        expect(screen.getByText('1 retard')).toBeInTheDocument()
      })
    })
  })

  describe('Visite médicale en retard → "1 retard" dans Visites médicales', () => {
    beforeEach(() => {
      setupMocks(
        [makeTravailleur(1, 'Dupont')],
        {
          1: {
            // péremption 2026-04-01 < 2026-05-27 → en_retard (alertMonths=3)
            visite_medicale_date_peremption: '2026-04-01',
          },
        }
      )
    })

    it('la source Visites médicales affiche "1 retard"', async () => {
      renderWithProviders(<Dashboard />, { route: '/' })
      await waitFor(() => {
        expect(screen.getByText('Visites médicales')).toBeInTheDocument()
      })
      await waitFor(() => {
        expect(screen.getByText('1 retard')).toBeInTheDocument()
      })
    })
  })

  describe('Formation RP travailleurs à prévoir → "1 à prévoir" dans Formations', () => {
    beforeEach(() => {
      setupMocks(
        [makeTravailleur(1, 'Dupont')],
        {
          1: {
            // deadline 2026-06-01 ≤ 2026-08-27 (today + 3 mois) → a_prevoir (alertMonths=3)
            formation_rp_travailleurs_date: '2023-06-01',
          },
        }
      )
    })

    it('la source Formations affiche "1 à prévoir"', async () => {
      renderWithProviders(<Dashboard />, { route: '/' })
      await waitFor(() => {
        expect(screen.getByText('Formations')).toBeInTheDocument()
      })
      await waitFor(() => {
        expect(screen.getByText('1 à prévoir')).toBeInTheDocument()
      })
    })
  })

  describe('Visite médicale à prévoir → "1 à prévoir" dans Visites médicales', () => {
    beforeEach(() => {
      setupMocks(
        [makeTravailleur(1, 'Dupont')],
        {
          1: {
            // péremption 2026-07-01 ≤ 2026-08-27 → a_prevoir (alertMonths=3)
            visite_medicale_date_peremption: '2026-07-01',
          },
        }
      )
    })

    it('la source Visites médicales affiche "1 à prévoir"', async () => {
      renderWithProviders(<Dashboard />, { route: '/' })
      await waitFor(() => {
        expect(screen.getByText('Visites médicales')).toBeInTheDocument()
      })
      await waitFor(() => {
        expect(screen.getByText('1 à prévoir')).toBeInTheDocument()
      })
    })
  })

  describe('Dates null ne contribuent pas aux compteurs', () => {
    beforeEach(() => {
      setupMocks(
        [makeTravailleur(1, 'Dupont')],
        { 1: {} } // toutes dates null
      )
    })

    it('toutes les sources affichent "À jour" (aucun danger ni warn)', async () => {
      renderWithProviders(<Dashboard />, { route: '/' })
      await waitFor(() => {
        expect(screen.getByText('Dosimétrie')).toBeInTheDocument()
      })
      await waitFor(() => {
        // Aucun badge "N retard" ou "N à prévoir" ne doit être présent
        expect(screen.queryByText(/\d+ retard/)).toBeNull()
        expect(screen.queryByText(/\d+ à prévoir/)).toBeNull()
      })
    })
  })

  describe('Plusieurs travailleurs contribuent indépendamment', () => {
    beforeEach(() => {
      setupMocks(
        [makeTravailleur(1, 'Dupont'), makeTravailleur(2, 'Martin')],
        {
          1: {
            // Dupont : dosimétrie passive en retard
            dosimetrie_passive_date: '2024-04-01',
          },
          2: {
            // Martin : dosimétrie opérationnelle en retard
            dosimetrie_operationnelle_date: '2024-04-01',
          },
        }
      )
    })

    it('la source Dosimétrie affiche "2 retard" (1 par travailleur)', async () => {
      renderWithProviders(<Dashboard />, { route: '/' })
      await waitFor(() => {
        expect(screen.getByText('Dosimétrie')).toBeInTheDocument()
      })
      await waitFor(() => {
        expect(screen.getByText('2 retard')).toBeInTheDocument()
      })
    })
  })

  describe('Mix en retard + à prévoir pour le même travailleur', () => {
    beforeEach(() => {
      setupMocks(
        [makeTravailleur(1, 'Dupont')],
        {
          1: {
            // dosimétrie passive en retard
            dosimetrie_passive_date: '2024-04-01',
            // formation RP travailleurs à prévoir
            formation_rp_travailleurs_date: '2023-06-01',
            // visite médicale en retard
            visite_medicale_date_peremption: '2026-04-01',
          },
        }
      )
    })

    it('Dosimétrie affiche "1 retard", Formations affiche "1 à prévoir", Visites "1 retard"', async () => {
      renderWithProviders(<Dashboard />, { route: '/' })
      await waitFor(() => {
        expect(screen.getByText('Dosimétrie')).toBeInTheDocument()
      })
      await waitFor(() => {
        // Deux sources distinctes avec danger=1 → deux badges "1 retard"
        const badges = screen.getAllByText('1 retard')
        expect(badges.length).toBeGreaterThanOrEqual(2) // dosimétrie + visites
      })
      await waitFor(() => {
        expect(screen.getByText('1 à prévoir')).toBeInTheDocument()
      })
    })
  })
})
