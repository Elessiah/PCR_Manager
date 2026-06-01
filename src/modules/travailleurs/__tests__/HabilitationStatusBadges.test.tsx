/**
 * Tests E2E — Statuts des badges par item dans l'onglet Habilitation
 *
 * Date de référence : 2026-05-27 (vi.setSystemTime) → résultats déterministes.
 *
 * Règles métier testées :
 *  - Chaque item affiche "En retard" / "À prévoir" / "À jour" / "Non renseigné"
 *    selon la date de validation et les seuils réglementaires.
 *  - Items "Non renseigné" (date null) ignorés si d'autres items ont un statut daté.
 *  - Si TOUS les items sont null → tous affichent "Non renseigné".
 *  - "En retard" est prioritaire sur "À prévoir".
 *
 * Seuils d'alerte par item :
 *   Dosimétrie passive/op   → date + 2 ans, alertMonths = 1
 *   Formation RP travailleurs → date + 3 ans, alertMonths = 1
 *   Formation RP patients     → date + 7 ans, alertMonths = 1
 *   Visite médicale           → date péremption, alertMonths = 3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderWithProviders, screen } from '../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { invoke } from '@tauri-apps/api/core'
import TravailleurFiche from '../TravailleurFiche'
import type { Travailleur, Habilitation, HabilitationStatus } from '../../../types/domain'

// ── Date de référence ────────────────────────────────────────────────────────
// 2026-05-27 → seuils d'alerte (1 mois) : jusqu'au 2026-06-27
//              seuil visite médicale (3 mois) : jusqu'au 2026-08-27
const FIXED_DATE = new Date('2026-05-27T00:00:00')

// ── Travailleur de test ──────────────────────────────────────────────────────
const mockTravailleur: Travailleur = {
  id: 1,
  etablissement_id: 1,
  nom: 'Bernard',
  prenom: 'Alice',
  sexe: 'F',
  date_naissance: '1985-03-15',
  lieu_naissance: 'Lyon',
  pays_naissance: 'France',
  fonction: 'Radiologiste',
  date_debut_activite: '2015-01-01',
  categorie_reglementaire: 'A',
  numero_adeli_rpps: '99999999',
  email: 'alice@example.com',
  telephone: null,
  numero_securite_sociale: null,
  numero_porteur_dosimetrie_passive: null,
  numero_suivi_medical: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const baseHab: Habilitation = {
  id: 1,
  travailleur_id: 1,
  dosimetrie_passive_date: null,
  dosimetrie_operationnelle_date: null,
  formation_rp_travailleurs_date: null,
  formation_rp_patients_date: null,
  visite_medicale_date: null,
  visite_medicale_date_peremption: null,
  visite_medicale_duree_mois: null,
  updated_at: '2025-01-01T00:00:00Z',
  delai_alerte_dosimetrie_passive: null,
  delai_alerte_dosimetrie_op: null,
  delai_alerte_formation_rp_trav: null,
  delai_alerte_formation_rp_pat: null,
  delai_alerte_visite_med: null,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupMocks(habOverrides: Partial<Habilitation>, habStatus: HabilitationStatus = {
  statut: 'non_validee',
  details: { formation_rp_ok: false, formation_rp_patients_ok: false, dosimetries_ok: false, competences_ok: false, visite_med_ok: false },
}) {
  vi.mocked(invoke).mockImplementation(async (cmd) => {
    switch (cmd) {
      case 'travailleur_get':
        return mockTravailleur
      case 'habilitation_compute':
        return habStatus
      case 'habilitation_get_for_travailleur':
        return { ...baseHab, ...habOverrides }
      case 'competence_list':
        return []
      case 'competence_general_get_for_travailleur':
        return []
      case 'competence_get_for_travailleur':
        return []
      case 'appareil_list':
        return []
      case 'travailleur_appareil_list':
        return []
      case 'habilitation_config_get':
        return []
      default:
        return null
    }
  })
}

async function openHabilitationTab() {
  const user = userEvent.setup()
  renderWithProviders(<TravailleurFiche />, { route: '/travailleurs/1' })
  const buttons = await screen.findAllByRole('button')
  const habTab = buttons.find(b => b.textContent?.includes('Habilitation'))
  if (habTab) await user.click(habTab)
  await screen.findByText("Items d'habilitation")
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('HabilitationTab — statuts des badges par item', () => {

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(FIXED_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Scénario 1 : tous les items EN RETARD ─────────────────────────────────
  describe('Scénario 1 : tous les items "En retard" (deadlines dépassées)', () => {
    beforeEach(() => {
      setupMocks({
        // dosimétrie passive : date + 2 ans = 2026-04-01 < 2026-05-27 → en_retard
        dosimetrie_passive_date: '2024-04-01',
        // dosimétrie opérationnelle : idem
        dosimetrie_operationnelle_date: '2024-04-01',
        // formation RP travailleurs : date + 3 ans = 2025-04-01 → en_retard
        formation_rp_travailleurs_date: '2022-04-01',
        // formation RP patients : date + 7 ans = 2025-04-01 → en_retard
        formation_rp_patients_date: '2018-04-01',
        // visite médicale : péremption directe passée → en_retard
        visite_medicale_date_peremption: '2026-04-01',
      })
    })

    it('les 5 items affichent exactement 5 badges "En retard" (+ 1 badge récapitulatif dans l\'en-tête)', async () => {
      await openHabilitationTab()
      // 5 badges dans le tableau + 1 badge récapitulatif dans l'en-tête de la fiche = 6 total
      expect(screen.getAllByText('En retard')).toHaveLength(6)
    })

    it('les badges "En retard" ont la classe danger (bg-dangerBg)', async () => {
      await openHabilitationTab()
      screen.getAllByText('En retard').forEach(badge =>
        expect(badge.closest('span')).toHaveClass('bg-dangerBg')
      )
    })

    it('aucun badge "À prévoir", "À jour" ou "Non renseigné" n\'est présent', async () => {
      await openHabilitationTab()
      expect(screen.queryByText('À prévoir')).toBeNull()
      expect(screen.queryByText('À jour')).toBeNull()
      expect(screen.queryByText('Non renseigné')).toBeNull()
    })
  })

  // ── Scénario 2 : tous les items À PRÉVOIR ────────────────────────────────
  describe('Scénario 2 : tous les items "À prévoir" (dans la fenêtre d\'alerte)', () => {
    beforeEach(() => {
      setupMocks({
        // deadline = 2026-06-01 ≤ 2026-06-27 (today + 1 mois) → a_prevoir
        dosimetrie_passive_date: '2024-06-01',
        dosimetrie_operationnelle_date: '2024-06-01',
        formation_rp_travailleurs_date: '2023-06-01',
        formation_rp_patients_date: '2019-06-01',
        // péremption 2026-07-01 ≤ 2026-08-27 (today + 3 mois) → a_prevoir
        visite_medicale_date_peremption: '2026-07-01',
      })
    })

    it('les 5 items affichent exactement 5 badges "À prévoir" (+ 1 badge récapitulatif dans l\'en-tête)', async () => {
      await openHabilitationTab()
      // 5 badges dans le tableau + 1 badge récapitulatif dans l'en-tête = 6 total
      expect(screen.getAllByText('À prévoir')).toHaveLength(6)
    })

    it('les badges "À prévoir" ont la classe warn (bg-warnBg)', async () => {
      await openHabilitationTab()
      screen.getAllByText('À prévoir').forEach(badge =>
        expect(badge.closest('span')).toHaveClass('bg-warnBg')
      )
    })

    it('aucun badge "En retard" n\'est présent', async () => {
      await openHabilitationTab()
      expect(screen.queryByText('En retard')).toBeNull()
    })
  })

  // ── Scénario 3 : tous les items À JOUR (valide) ──────────────────────────
  describe('Scénario 3 : tous les items "À jour" (deadlines dans le futur lointain)', () => {
    beforeEach(() => {
      setupMocks({
        // deadline = 2027-01-01 > 2026-06-27 → valide
        dosimetrie_passive_date: '2025-01-01',
        dosimetrie_operationnelle_date: '2025-01-01',
        // deadline = 2027-08-01 → valide
        formation_rp_travailleurs_date: '2024-08-01',
        formation_rp_patients_date: '2020-08-01',
        // péremption 2027-01-01 > 2026-08-27 → valide
        visite_medicale_date_peremption: '2027-01-01',
      }, {
        statut: 'validee',
        details: { formation_rp_ok: true, formation_rp_patients_ok: true, dosimetries_ok: true, competences_ok: true, visite_med_ok: true },
      })
    })

    it('les 5 items affichent exactement 5 badges "À jour" (+ 1 badge récapitulatif dans l\'en-tête)', async () => {
      await openHabilitationTab()
      // 5 badges dans le tableau + 1 badge récapitulatif dans l'en-tête = 6 total
      expect(screen.getAllByText('À jour')).toHaveLength(6)
    })

    it('les badges "À jour" ont la classe ok (bg-okBg)', async () => {
      await openHabilitationTab()
      screen.getAllByText('À jour').forEach(badge =>
        expect(badge.closest('span')).toHaveClass('bg-okBg')
      )
    })
  })

  // ── Scénario 4 : TOUTES les dates null → "Non renseigné" ─────────────────
  describe('Scénario 4 : toutes les dates null → "Non renseigné" pour chaque item', () => {
    beforeEach(() => {
      setupMocks({}) // baseHab a toutes les dates null
    })

    it('les 5 items affichent exactement 5 badges "Non renseigné" (+ 1 badge récapitulatif dans l\'en-tête)', async () => {
      await openHabilitationTab()
      // 5 badges dans le tableau + 1 badge récapitulatif dans l'en-tête = 6 total
      expect(screen.getAllByText('Non renseigné')).toHaveLength(6)
    })

    it('aucun badge "En retard" ou "À prévoir" n\'est présent', async () => {
      await openHabilitationTab()
      expect(screen.queryByText('En retard')).toBeNull()
      expect(screen.queryByText('À prévoir')).toBeNull()
    })
  })

  // ── Scénario 5 : "Non renseigné" ignoré si d'autres items ont un statut ──
  describe('Scénario 5 : 1 item en retard, 4 items null (non renseigné ignoré)', () => {
    beforeEach(() => {
      // Seule la dosimétrie passive est renseignée et en retard.
      // Les 4 autres items (dosimétrie op, formation RP trav/pat, visite) restent null.
      setupMocks({
        dosimetrie_passive_date: '2024-04-01', // deadline 2026-04-01 → en_retard
      })
    })

    it('affiche 1 badge "En retard" et 4 badges "Non renseigné"', async () => {
      await openHabilitationTab()
      // 1 badge item + 1 badge récapitulatif en-tête (worst = en_retard) = 2 "En retard"
      expect(screen.getAllByText('En retard')).toHaveLength(2)
      expect(screen.getAllByText('Non renseigné')).toHaveLength(4)
    })

    it('les items null ne deviennent pas "En retard"', async () => {
      await openHabilitationTab()
      // 1 item en retard (dosimétrie passive) + 1 badge récapitulatif en-tête = 2 total
      expect(screen.getAllByText('En retard')).toHaveLength(2)
    })
  })

  describe('Scénario 6 : 1 item à prévoir, 4 items null (non renseigné ignoré)', () => {
    beforeEach(() => {
      // Seule la formation RP travailleurs est renseignée et à prévoir.
      setupMocks({
        formation_rp_travailleurs_date: '2023-06-01', // deadline 2026-06-01 → a_prevoir
      })
    })

    it('affiche 1 badge "À prévoir" et 4 badges "Non renseigné"', async () => {
      await openHabilitationTab()
      // 1 badge item + 1 badge récapitulatif en-tête (worst = a_prevoir) = 2 "À prévoir"
      expect(screen.getAllByText('À prévoir')).toHaveLength(2)
      expect(screen.getAllByText('Non renseigné')).toHaveLength(4)
    })
  })

  // ── Scénario 7 : mix En retard + À prévoir + Non renseigné ───────────────
  describe('Scénario 7 : mix — "En retard" prioritaire sur "À prévoir"', () => {
    beforeEach(() => {
      setupMocks({
        dosimetrie_passive_date: '2024-04-01',       // deadline 2026-04-01 → en_retard
        dosimetrie_operationnelle_date: '2024-06-01', // deadline 2026-06-01 → a_prevoir
        formation_rp_travailleurs_date: '2023-06-01', // deadline 2026-06-01 → a_prevoir
        // formation_rp_patients_date et visite_medicale restent null
      })
    })

    it('affiche 1 badge "En retard", 2 badges "À prévoir" et 2 badges "Non renseigné"', async () => {
      await openHabilitationTab()
      // 1 badge item + 1 badge récapitulatif en-tête (worst = en_retard) = 2 "En retard"
      expect(screen.getAllByText('En retard')).toHaveLength(2)
      expect(screen.getAllByText('À prévoir')).toHaveLength(2)
      expect(screen.getAllByText('Non renseigné')).toHaveLength(2)
    })
  })

  // ── Scénario 9 : dates toutes "À jour" mais competences_ok = false ─────────
  describe('Scénario 9 : dates à jour mais compétences non validées → badge "Partielle"', () => {
    beforeEach(() => {
      setupMocks({
        // Toutes les dates bien dans le futur (seuil > 1 mois) → valide
        dosimetrie_passive_date: '2025-01-01',            // deadline 2027-01-01 → valide
        dosimetrie_operationnelle_date: '2025-01-01',
        formation_rp_travailleurs_date: '2024-08-01',     // deadline 2027-08-01 → valide
        formation_rp_patients_date: '2020-08-01',         // deadline 2027-08-01 → valide
        visite_medicale_date_peremption: '2027-01-01',    // → valide
      }, {
        statut: 'partielle',
        details: { formation_rp_ok: true, formation_rp_patients_ok: true, dosimetries_ok: true, competences_ok: false, visite_med_ok: true },
      })
    })

    it('le badge récapitulatif dans l\'en-tête affiche "Partielle"', async () => {
      await openHabilitationTab()
      expect(screen.getByText('Partielle')).toBeInTheDocument()
    })

    it('le badge "Partielle" a la classe warn (bg-warnBg)', async () => {
      await openHabilitationTab()
      expect(screen.getByText('Partielle').closest('span')).toHaveClass('bg-warnBg')
    })

    it('aucun badge "À jour" n\'est présent dans l\'en-tête (5 dans les items, pas dans l\'en-tête)', async () => {
      await openHabilitationTab()
      // Les 5 items HabilitationTab affichent "À jour" (calcul temporel pur)
      // Le badge en-tête n'est PAS "À jour" → exactement 5 occurrences
      expect(screen.getAllByText('À jour')).toHaveLength(5)
    })
  })

  // ── Scénario 8 : visite médicale via date + durée en mois ────────────────
  describe('Scénario 8 : visite médicale calculée par date + durée en mois', () => {
    describe('visite médicale en retard (date + 12 mois dépassée)', () => {
      beforeEach(() => {
        setupMocks({
          // visite_medicale_date + 12 mois = 2025-04-01 < 2026-05-27 → en_retard
          visite_medicale_date: '2024-04-01',
          visite_medicale_duree_mois: 12,
        })
      })

      it('la visite médicale affiche "En retard"', async () => {
        await openHabilitationTab()
        // 1 badge visite + 1 badge récapitulatif en-tête (worst = en_retard) = 2 "En retard"
        expect(screen.getAllByText('En retard')).toHaveLength(2)
      })
    })

    describe('visite médicale à prévoir (péremption dans 2 mois)', () => {
      beforeEach(() => {
        setupMocks({
          // péremption dans ~2 mois → dans la fenêtre d'alerte 3 mois → a_prevoir
          visite_medicale_date: '2025-07-15',
          visite_medicale_duree_mois: 12,
          // deadline = 2026-07-15 ≤ 2026-08-27 (today + 3 mois) → a_prevoir
        })
      })

      it('la visite médicale affiche "À prévoir"', async () => {
        await openHabilitationTab()
        // 1 badge visite + 1 badge récapitulatif en-tête (worst = a_prevoir) = 2 "À prévoir"
        expect(screen.getAllByText('À prévoir')).toHaveLength(2)
      })
    })
  })
})
