import { describe, it, expect, vi } from 'vitest'
import { renderWithProviders, screen, waitFor } from '../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { invoke } from '@tauri-apps/api/core'
import TravailleurFiche from '../TravailleurFiche'
import type {
  Travailleur,
  HabilitationStatus,
  CompetenceTravailleur,
  Appareil,
  CompetenceRef,
} from '../../../types/domain'

vi.mocked(invoke)

const mockTravailleur: Travailleur = {
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
}

const mockHabilitationStatus: HabilitationStatus = {
  statut: 'partielle',
  details: {
    formation_rp_ok: true,
    formation_rp_patients_ok: true,
    dosimetries_ok: false,
    competences_ok: true,
    visite_med_ok: true,
  },
}

const mockCompetences: CompetenceTravailleur[] = [
  {
    id: 1,
    travailleur_id: 1,
    appareil_id: 1,
    competence_ref_id: 1,
    date_validation: '2024-01-15',
    validated: 1,
    date_peremption: null,
  },
  {
    id: 2,
    travailleur_id: 1,
    appareil_id: 1,
    competence_ref_id: 2,
    date_validation: null,
    validated: 0,
    date_peremption: null,
  },
  {
    id: 3,
    travailleur_id: 1,
    appareil_id: 1,
    competence_ref_id: 3,
    date_validation: '2024-02-20',
    validated: 1,
    date_peremption: null,
  },
]

const mockCompetenceRefs: CompetenceRef[] = [
  {
    id: 1,
    libelle: 'Compétence sur fluoroscopie',
    ordre: 1,
    description: null,
    propre_appareil: 1,
    duree_validite_mois: 12,
    duree_alerte_mois: 3,
  },
  {
    id: 2,
    libelle: 'Compétence sur radiographie',
    ordre: 2,
    description: null,
    propre_appareil: 1,
    duree_validite_mois: 24,
    duree_alerte_mois: 3,
  },
  {
    id: 3,
    libelle: 'Compétence sur scanner',
    ordre: 3,
    description: null,
    propre_appareil: 0,
    duree_validite_mois: null,
    duree_alerte_mois: 3,
  },
]

const mockAppareils: Appareil[] = [
  {
    id: 1,
    etablissement_id: 1,
    designation: 'Scanner CT General Electric',
    marque: 'General Electric',
    modele: 'LightSpeed',
    numero_serie: 'GE12345',
    type_: 'Scanner',
    annee_mise_en_service: 2015,
    lieu_utilisation: 'Département Radiologie',
    utilisation_partagee: 0,
    tension_nominale_kv: 120,
    intensite_maximale_ma: 300,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
]

vi.mocked(invoke).mockImplementation(async (cmd: string) => {
  switch (cmd) {
    case 'travailleur_get':
      return mockTravailleur
    case 'travailleur_list':
      return [mockTravailleur]
    case 'habilitation_compute':
      return mockHabilitationStatus
    case 'habilitation_get_for_travailleur':
      return {
        id: 1,
        travailleur_id: 1,
        dosimetrie_passive_date: null,
        dosimetrie_operationnelle_date: null,
        formation_rp_travailleurs_date: '2024-01-15',
        formation_rp_patients_date: null,
        visite_medicale_date: '2024-06-01',
        visite_medicale_duree_mois: 12,
        visite_medicale_date_peremption: null,
        updated_at: '2025-01-01T00:00:00Z',
      }
    case 'competence_get_for_travailleur':
      return mockCompetences
    case 'competence_general_get_for_travailleur':
      return []
    case 'competence_list':
      return mockCompetenceRefs
    case 'appareil_list':
      return mockAppareils
    case 'travailleur_appareil_list':
      return [1]
    case 'appareil_competence_list':
      return [1, 2]
    default:
      return null
  }
})

describe('HabilitationTab and Competences', () => {

  it('should display habilitation status with partielle badge', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TravailleurFiche />, { route: '/travailleurs/1' })

    const habButtons = await screen.findAllByRole('button')
    const habiltationTab = habButtons.find(b => b.textContent?.includes('Habilitation'))
    expect(habiltationTab).toBeTruthy()

    if (habiltationTab) {
      await user.click(habiltationTab)
      await screen.findByText('Partielle')
    }
  })

  it('should verify all 5 habilitation items are present', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TravailleurFiche />, { route: '/travailleurs/1' })

    const habButtons = await screen.findAllByRole('button')
    const habiltationTab = habButtons.find(b => b.textContent?.includes('Habilitation'))

    if (habiltationTab) {
      await user.click(habiltationTab)
      await screen.findByText('Items d\'habilitation')
      expect(screen.getByText('Formation RP travailleurs')).toBeInTheDocument()
      expect(screen.getByText('Dosimétrie passive')).toBeInTheDocument()
      expect(screen.getByText('Dosimétrie opérationnelle')).toBeInTheDocument()
      expect(screen.getByText('Formation RP patients')).toBeInTheDocument()
      expect(screen.getByText('Visite médicale')).toBeInTheDocument()
    }
  })

  it('should display competences list in formation à l\'utilisation', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TravailleurFiche />, { route: '/travailleurs/1' })

    const habButtons = await screen.findAllByRole('button')
    const habiltationTab = habButtons.find(b => b.textContent?.includes('Habilitation'))

    if (habiltationTab) {
      await user.click(habiltationTab)
      await screen.findByText('Compétence sur fluoroscopie')
      expect(screen.getByText('Compétence sur radiographie')).toBeInTheDocument()
      expect(screen.getByText('Compétence sur scanner')).toBeInTheDocument()
    }
  })

  it('should display competence toggles for appareil', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TravailleurFiche />, { route: '/travailleurs/1' })

    const habButtons = await screen.findAllByRole('button')
    const habiltationTab = habButtons.find(b => b.textContent?.includes('Habilitation'))

    if (habiltationTab) {
      await user.click(habiltationTab)
      await screen.findByText('Compétences par appareil')
    }
  })

  it('should call all necessary API methods for habilitation tab', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TravailleurFiche />, { route: '/travailleurs/1' })

    const habButtons = await screen.findAllByRole('button')
    const habiltationTab = habButtons.find(b => b.textContent?.includes('Habilitation'))

    if (habiltationTab) {
      await user.click(habiltationTab)
      await waitFor(() => {
        expect(vi.mocked(invoke)).toHaveBeenCalledWith('habilitation_compute', {
          travailleurId: 1,
        })
      })
    }
  })
})
