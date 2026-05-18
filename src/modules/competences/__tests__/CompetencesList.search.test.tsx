import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithProviders, screen, waitFor } from '../../../test/test-utils'
import { invoke } from '@tauri-apps/api/core'
import userEvent from '@testing-library/user-event'
import CompetencesList from '../CompetencesList'
import type { CompetenceRef } from '../../../types/domain'

const mockCompetences: CompetenceRef[] = [
  {
    id: 1,
    libelle: 'Mise sous tension de l\'appareil',
    ordre: 1,
    description: 'Procédure sécurisée',
    propre_appareil: 1,
    duree_validite_mois: 12,
    duree_alerte_mois: 3,
  },
  {
    id: 2,
    libelle: 'Mise en marche de l\'appareil',
    ordre: 2,
    description: null,
    propre_appareil: 1,
    duree_validite_mois: 24,
    duree_alerte_mois: 3,
  },
  {
    id: 3,
    libelle: 'Enregistrement patient',
    ordre: 0,
    description: null,
    propre_appareil: 0,
    duree_validite_mois: null,
    duree_alerte_mois: 3,
  },
]

describe('CompetencesList - Recherche', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'competence_list':
          return mockCompetences
        default:
          return null
      }
    })
  })

  it('la barre de recherche filtre les compétences par libellé', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CompetencesList />, { route: '/competences' })

    await screen.findByText('Mise sous tension de l\'appareil')

    const searchInput = screen.getByPlaceholderText(/Rechercher par libellé ou description/i)
    await user.type(searchInput, 'enregistrement')

    await waitFor(() => {
      expect(screen.queryByText('Mise sous tension de l\'appareil')).not.toBeInTheDocument()
    }, { timeout: 2000 })

    expect(screen.getByText('Enregistrement patient')).toBeInTheDocument()
    expect(screen.queryByText('Mise en marche de l\'appareil')).not.toBeInTheDocument()
  })

  it('la recherche est insensible à la casse et aux accents', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CompetencesList />, { route: '/competences' })

    await screen.findByText('Mise sous tension de l\'appareil')

    const searchInput = screen.getByPlaceholderText(/Rechercher par libellé ou description/i)
    await user.type(searchInput, 'MISE')

    await waitFor(() => {
      expect(screen.queryByText('Enregistrement patient')).not.toBeInTheDocument()
    }, { timeout: 2000 })

    expect(screen.getByText('Mise sous tension de l\'appareil')).toBeInTheDocument()
    expect(screen.getByText('Mise en marche de l\'appareil')).toBeInTheDocument()
  })

  it('l\'effacement de la recherche affiche toutes les compétences', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CompetencesList />, { route: '/competences' })

    await screen.findByText('Mise sous tension de l\'appareil')

    const searchInput = screen.getByPlaceholderText(/Rechercher par libellé ou description/i)
    await user.type(searchInput, 'mise')

    await waitFor(() => {
      expect(screen.queryByText('Enregistrement patient')).not.toBeInTheDocument()
    }, { timeout: 2000 })

    await user.clear(searchInput)

    await waitFor(() => {
      expect(screen.getByText('Enregistrement patient')).toBeInTheDocument()
    }, { timeout: 2000 })

    expect(screen.getByText('Mise sous tension de l\'appareil')).toBeInTheDocument()
    expect(screen.getByText('Mise en marche de l\'appareil')).toBeInTheDocument()
  })
})
