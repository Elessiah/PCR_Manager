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
  statut: 'validee',
  details: {
    formation_rp_ok: true,
    dosimetries_ok: true,
    competences_ok: false,
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
        formation_rp_travailleurs_date: null,
        formation_rp_patients_date: null,
        visite_medicale_date: null,
        visite_medicale_duree_mois: 12,
        visite_medicale_date_peremption: null,
        updated_at: '2025-01-01T00:00:00Z',
      }
    case 'competence_get_for_travailleur':
      return mockCompetences
    case 'competence_general_get_for_travailleur':
      return []
    case 'appareil_list':
      return mockAppareils
    case 'competence_list':
      return []
    case 'travailleur_appareil_list':
      return [1]
    case 'appareil_competence_list':
      return [1, 2]
    default:
      return null
  }
})

describe('TravailleurFiche', () => {

  it('should display travailleur details', async () => {
    renderWithProviders(<TravailleurFiche />, { route: '/travailleurs/1' })

    await screen.findByRole('heading', { name: /Jean\s+Dupont/ })
    expect(screen.getAllByText('Radiologiste').length).toBeGreaterThanOrEqual(1)
  })

  it('should have two tabs: Données personnelles and Habilitation', async () => {
    renderWithProviders(<TravailleurFiche />, { route: '/travailleurs/1' })

    await screen.findByText('Données personnelles')
    expect(screen.getByRole('button', { name: /Habilitation/ })).toBeInTheDocument()
  })

  it('should display Données personnelles tab by default', async () => {
    renderWithProviders(<TravailleurFiche />, { route: '/travailleurs/1' })

    await screen.findByText('Identité')
    expect(screen.getByText('Activité professionnelle')).toBeInTheDocument()
  })

  it('should switch to Habilitation tab and display items', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TravailleurFiche />, { route: '/travailleurs/1' })

    const habilitationTab = await screen.findByRole('button', { name: /Habilitation/ })
    await user.click(habilitationTab)

    await screen.findByText('Items d\'habilitation')
  })

  it('should display 4 habilitation items', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TravailleurFiche />, { route: '/travailleurs/1' })

    const habilitationTab = await screen.findByRole('button', { name: /Habilitation/ })
    await user.click(habilitationTab)

    await screen.findByText('Formation RP travailleurs')
    expect(screen.getByText('Dosimétries')).toBeInTheDocument()
    expect(screen.getByText('Formation RP patients')).toBeInTheDocument()
    expect(screen.getByText('Visite médicale')).toBeInTheDocument()
  })

  it('should display formation à l\'utilisation des appareils section', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TravailleurFiche />, { route: '/travailleurs/1' })

    const habilitationTab = await screen.findByRole('button', { name: /Habilitation/ })
    await user.click(habilitationTab)

    await screen.findByText('Compétences par appareil')
  })

  it('should call travailleur_get with correct id', async () => {
    renderWithProviders(<TravailleurFiche />, { route: '/travailleurs/1' })

    await screen.findByRole('heading', { name: /Jean\s+Dupont/ })
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('travailleur_get', { id: 1 })
  })

  it('should call habilitation_compute when accessing Habilitation tab', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TravailleurFiche />, { route: '/travailleurs/1' })

    const habilitationTab = await screen.findByRole('button', { name: /Habilitation/ })
    await user.click(habilitationTab)

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('habilitation_compute', {
        travailleurId: 1,
      })
    })
  })

  it('should call competence_get_for_travailleur for competences display', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TravailleurFiche />, { route: '/travailleurs/1' })

    const habilitationTab = await screen.findByRole('button', { name: /Habilitation/ })
    await user.click(habilitationTab)

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        'competence_get_for_travailleur',
        { travailleurId: 1 }
      )
    })
  })
})
