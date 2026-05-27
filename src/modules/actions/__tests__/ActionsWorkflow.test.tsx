/**
 * Tests E2E — Page Actions : contenu et ordre de tri
 *
 * Date de référence : 2026-05-27 (vi.setSystemTime) → résultats déterministes.
 *
 * Règles métier testées :
 *  - Les travailleurs ayant un item "En retard" ou "À prévoir" apparaissent dans Actions.
 *  - Les travailleurs avec toutes les dates null ne génèrent aucune action.
 *  - Les items "Valide" et "N/A" n'apparaissent pas dans la liste.
 *  - Ordre de tri : En retard → À prévoir,
 *    dans chaque groupe par deadline croissante (plus en retard / plus proche d'abord),
 *    puis ordre alphabétique par label en cas d'égalité.
 *
 * Actions utilise alertMonths = 3 pour tous les statuts.
 * Seuil a_prevoir avec alertMonths=3 : deadline dans (2026-05-27, 2026-08-27].
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderWithProviders, screen, waitFor, fireEvent } from '../../../test/test-utils'
import { invoke } from '@tauri-apps/api/core'
import Actions from '../Actions'
import type { Travailleur, Habilitation, Appareil, VerificationTechnique, ControleQualite } from '../../../types/domain'

const FIXED_DATE = new Date('2026-05-27T00:00:00')

// ── Données ──────────────────────────────────────────────────────────────────

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

const makeTravailleur = (id: number, nom: string, prenom: string): Travailleur => ({
  id,
  etablissement_id: 1,
  nom,
  prenom,
  sexe: null,
  date_naissance: null,
  lieu_naissance: null,
  pays_naissance: null,
  fonction: 'Radiologiste',
  date_debut_activite: null,
  categorie_reglementaire: 'A',
  numero_adeli_rpps: null,
  email: null,
  telephone: null,
  numero_securite_sociale: null,
  numero_porteur_dosimetrie_passive: null,
  numero_suivi_medical: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
})

const makeAppareil = (id: number, designation: string): Appareil => ({
  id,
  etablissement_id: 1,
  designation,
  marque: null,
  modele: null,
  numero_serie: null,
  type_: null,
  annee_mise_en_service: null,
  lieu_utilisation: null,
  utilisation_partagee: 0,
  tension_nominale_kv: null,
  intensite_maximale_ma: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
})

// ── Tests de contenu ─────────────────────────────────────────────────────────

describe('Actions — travailleurs avec items en retard/à prévoir', () => {

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(FIXED_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Un travailleur avec formation en retard apparaît dans Actions', () => {
    beforeEach(() => {
      vi.mocked(invoke).mockImplementation(async (cmd, args?: unknown) => {
        const a = args as { travailleurId?: number } | undefined
        switch (cmd) {
          case 'travailleur_list':
            return [makeTravailleur(1, 'Dupont', 'Jean')]
          case 'habilitation_get_for_travailleur':
            return baseHab(1, {
              // formation RP travailleurs : deadline 2025-01-01 → en_retard
              formation_rp_travailleurs_date: '2022-01-01',
            })
          case 'appareil_list':
            return []
          case 'verification_list':
            return []
          case 'controle_qualite_list':
            return []
          default:
            return []
        }
      })
    })

    it('Jean Dupont est visible dans la liste des actions', async () => {
      renderWithProviders(<Actions />, { route: '/actions' })
      await waitFor(() => {
        expect(screen.getByText('Jean Dupont')).toBeInTheDocument()
      })
    })

    it('son action est labelisée "Formation radioprotection travailleurs"', async () => {
      renderWithProviders(<Actions />, { route: '/actions' })
      await waitFor(() => {
        expect(screen.getByText('Formation radioprotection travailleurs')).toBeInTheDocument()
      })
    })

    it('le badge de statut dans la ligne est "En retard" avec la classe danger', async () => {
      renderWithProviders(<Actions />, { route: '/actions' })
      await waitFor(() => {
        // getAllByText car le bouton filtre contient aussi "En retard" (avec le compteur)
        const elements = screen.getAllByText('En retard')
        const statusBadge = elements.find(el =>
          el.closest('span')?.classList.contains('bg-dangerBg')
        )
        expect(statusBadge).toBeDefined()
      })
    })

    it('le filtre "En retard" compte 1 action', async () => {
      renderWithProviders(<Actions />, { route: '/actions' })
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /En retard/ })
        expect(btn.textContent).toContain('1')
      })
    })
  })

  describe('Un travailleur avec dosimétrie à prévoir apparaît dans Actions', () => {
    beforeEach(() => {
      vi.mocked(invoke).mockImplementation(async (cmd) => {
        switch (cmd) {
          case 'travailleur_list':
            return [makeTravailleur(2, 'Martin', 'Marie')]
          case 'habilitation_get_for_travailleur':
            return baseHab(2, {
              // deadline 2026-06-01 ≤ 2026-08-27 → a_prevoir (alertMonths=3 dans Actions)
              dosimetrie_passive_date: '2024-06-01',
            })
          case 'appareil_list':
            return []
          case 'verification_list':
            return []
          case 'controle_qualite_list':
            return []
          default:
            return []
        }
      })
    })

    it('Marie Martin est visible dans la liste des actions', async () => {
      renderWithProviders(<Actions />, { route: '/actions' })
      await waitFor(() => {
        expect(screen.getByText('Marie Martin')).toBeInTheDocument()
      })
    })

    it('le badge de statut est "À prévoir"', async () => {
      renderWithProviders(<Actions />, { route: '/actions' })
      await waitFor(() => {
        const badge = screen.getByText('À prévoir')
        expect(badge.closest('span')).toHaveClass('bg-warnBg')
      })
    })

    it('le filtre "À venir" compte 1 action', async () => {
      renderWithProviders(<Actions />, { route: '/actions' })
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /À venir/ })
        expect(btn.textContent).toContain('1')
      })
    })
  })

  describe('Un travailleur avec toutes les dates null ne génère aucune action', () => {
    beforeEach(() => {
      vi.mocked(invoke).mockImplementation(async (cmd) => {
        switch (cmd) {
          case 'travailleur_list':
            return [makeTravailleur(3, 'Arnaud', 'Pierre')]
          case 'habilitation_get_for_travailleur':
            return baseHab(3) // all null
          case 'appareil_list':
            return []
          case 'verification_list':
            return []
          case 'controle_qualite_list':
            return []
          default:
            return []
        }
      })
    })

    it('Pierre Arnaud n\'est pas dans la liste', async () => {
      renderWithProviders(<Actions />, { route: '/actions' })
      await waitFor(() => {
        // Attend que le composant soit rendu (vérifie le titre)
        expect(screen.getByText('Actions')).toBeInTheDocument()
      })
      expect(screen.queryByText('Pierre Arnaud')).toBeNull()
    })

    it('le compteur "Tout" est à 0', async () => {
      renderWithProviders(<Actions />, { route: '/actions' })
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /Tout/ })
        expect(btn.textContent).toMatch(/Tout\s*0/)
      })
    })
  })
})

// ── Tests de tri ──────────────────────────────────────────────────────────────

describe('Actions — ordre de tri : En retard → À prévoir, deadline croissante dans chaque groupe', () => {

  // Scénario :
  //   En retard  Travailleur : "Jean Dupont"  (formation deadline 2025-01-01) ← le plus en retard
  //   En retard  Appareil : "Alpha Scanner"   (vérif deadline 2026-03-01)
  //   En retard  Travailleur : "Marie Martin" (dosimétrie deadline 2026-04-01)  ← M avant Z
  //   En retard  Appareil : "Zeta IRM"        (vérif deadline 2026-04-01)
  //   À prévoir  Travailleur : "Pierre Arnaud" (formation deadline 2026-06-01) ← le plus proche
  //   À prévoir  Appareil : "Beta Gamma"       (CQ deadline 2026-07-01)
  //   (Alice Zebra : toutes dates null → pas d'action)

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(FIXED_DATE)

    const appareils: Appareil[] = [
      makeAppareil(100, 'Alpha Scanner'),
      makeAppareil(200, 'Zeta IRM'),
      makeAppareil(300, 'Beta Gamma'),
    ]

    const verifications: VerificationTechnique[] = [
      // Alpha Scanner : deadline 2026-03-01 → en_retard
      {
        id: 1, appareil_id: 100, type_: 'annuelle_interne',
        date_realisation: '2025-03-01',
        realise_par: null, organisme: null, observations: null,
        created_at: '2025-03-01',
      },
      // Zeta IRM : deadline 2026-04-01 → en_retard
      {
        id: 2, appareil_id: 200, type_: 'annuelle_interne',
        date_realisation: '2025-04-01',
        realise_par: null, organisme: null, observations: null,
        created_at: '2025-04-01',
      },
    ]

    const controles: ControleQualite[] = [
      // Beta Gamma : date_echeance 2026-07-01 → a_prevoir (alertMonths=3)
      {
        id: 10, appareil_id: 300, type_: 'externe',
        date_realisation: null,
        date_echeance: '2026-07-01',
        controle_externe_id: null, organisme: null, realise_par: null,
        statut: 'planifie', observations: null,
        created_at: '2026-01-01',
      },
    ]

    const travailleurs: Travailleur[] = [
      makeTravailleur(10, 'Dupont', 'Jean'),
      makeTravailleur(20, 'Martin', 'Marie'),
      makeTravailleur(30, 'Arnaud', 'Pierre'),
      makeTravailleur(40, 'Zebra', 'Alice'),
    ]

    const habilitations: Record<number, Partial<Habilitation>> = {
      // Jean Dupont : formation deadline 2025-01-01 → en_retard
      10: { formation_rp_travailleurs_date: '2022-01-01' },
      // Marie Martin : dosimétrie deadline 2026-04-01 → en_retard
      20: { dosimetrie_passive_date: '2024-04-01' },
      // Pierre Arnaud : formation deadline 2026-06-01 → a_prevoir
      30: { formation_rp_travailleurs_date: '2023-06-01' },
      // Alice Zebra : toutes dates null → aucune action
      40: {},
    }

    vi.mocked(invoke).mockImplementation(async (cmd, args?: unknown) => {
      const a = args as { travailleurId?: number } | undefined
      switch (cmd) {
        case 'travailleur_list':
          return travailleurs
        case 'habilitation_get_for_travailleur': {
          const tId = a?.travailleurId ?? 0
          return baseHab(tId, habilitations[tId] ?? {})
        }
        case 'appareil_list':
          return appareils
        case 'verification_list':
          return verifications
        case 'controle_qualite_list':
          return controles
        default:
          return []
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('affiche exactement 6 actions au total (4 en retard + 2 à prévoir)', async () => {
    renderWithProviders(<Actions />, { route: '/actions' })
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Tout/ })
      expect(btn.textContent).toContain('6')
    })
  })

  it('le filtre "En retard" compte 4 actions', async () => {
    renderWithProviders(<Actions />, { route: '/actions' })
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /En retard/ })
      expect(btn.textContent).toContain('4')
    })
  })

  it('le filtre "À venir" compte 2 actions', async () => {
    renderWithProviders(<Actions />, { route: '/actions' })
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /À venir/ })
      expect(btn.textContent).toContain('2')
    })
  })

  it('ordre En retard : deadline croissante — Jean Dupont (2025-01-01) → Alpha Scanner (2026-03-01) → Marie Martin (2026-04-01) → Zeta IRM (2026-04-01)', async () => {
    renderWithProviders(<Actions />, { route: '/actions' })

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      // rows[0] = header
      // En retard triés par deadline croissante (plus en retard d'abord),
      // puis alphabétique par label en cas d'égalité
      expect(rows[1]).toHaveTextContent('Jean Dupont')   // deadline 2025-01-01 — le plus en retard
      expect(rows[2]).toHaveTextContent('Alpha Scanner') // deadline 2026-03-01
      expect(rows[3]).toHaveTextContent('Marie Martin')  // deadline 2026-04-01 (M < Z alphabétique)
      expect(rows[4]).toHaveTextContent('Zeta IRM')      // deadline 2026-04-01
    })
  })

  it('ordre À prévoir : deadline croissante — Pierre Arnaud (2026-06-01) → Beta Gamma (2026-07-01)', async () => {
    renderWithProviders(<Actions />, { route: '/actions' })

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      // À prévoir triés par deadline croissante (plus proche d'abord)
      expect(rows[5]).toHaveTextContent('Pierre Arnaud') // deadline 2026-06-01 — plus proche
      expect(rows[6]).toHaveTextContent('Beta Gamma')    // deadline 2026-07-01
    })
  })

  it('Alice Zebra (toutes dates null) n\'apparaît pas dans la liste', async () => {
    renderWithProviders(<Actions />, { route: '/actions' })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Tout/ }).textContent).toContain('6')
    })
    expect(screen.queryByText('Alice Zebra')).toBeNull()
  })

  it('après filtrage "En retard", tri par deadline croissante', async () => {
    renderWithProviders(<Actions />, { route: '/actions' })

    // Attendre le chargement
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Tout/ }).textContent).toContain('6')
    })

    // Cliquer sur le filtre "En retard"
    fireEvent.click(screen.getByRole('button', { name: /En retard/ }))

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      // 1 header + 4 data rows
      expect(rows).toHaveLength(5)
      expect(rows[1]).toHaveTextContent('Jean Dupont')   // deadline 2025-01-01 — le plus en retard
      expect(rows[2]).toHaveTextContent('Alpha Scanner') // deadline 2026-03-01
      expect(rows[3]).toHaveTextContent('Marie Martin')  // deadline 2026-04-01 (M < Z)
      expect(rows[4]).toHaveTextContent('Zeta IRM')      // deadline 2026-04-01
    })
  })
})
