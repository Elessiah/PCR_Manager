import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithProviders, screen, waitFor } from '../../../test/test-utils'
import { within } from '@testing-library/react'
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

vi.mocked(invoke).mockImplementation(async (cmd: string) => {
  switch (cmd) {
    case 'competence_list':
      return mockCompetences
    case 'competence_ref_create':
      return {
        id: 99,
        libelle: 'Nouvelle compétence',
        ordre: 10,
        description: null,
        propre_appareil: 1,
        duree_validite_mois: null,
        duree_alerte_mois: 3,
      }
    case 'competence_ref_update':
      return undefined
    case 'competence_ref_delete':
      return undefined
    default:
      return null
  }
})

describe('CompetencesList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'competence_list':
          return mockCompetences
        case 'competence_ref_create':
          return {
            id: 99,
            libelle: 'Nouvelle compétence',
            ordre: 10,
            description: null,
            propre_appareil: 1,
            duree_validite_mois: null,
            duree_alerte_mois: 3,
          }
        case 'competence_ref_update':
          return undefined
        case 'competence_ref_delete':
          return undefined
        default:
          return null
      }
    })
  })

  it('affiche la liste triée alphabétiquement', async () => {
    renderWithProviders(<CompetencesList />, { route: '/competences' })

    await waitFor(() => {
      expect(screen.getByText('Mise sous tension de l\'appareil')).toBeInTheDocument()
    })

    const rows = screen.getAllByRole('row')
    // Row 0 = header, rows 1..3 = data, triés alphabétiquement
    // Enregistrement patient -> Mise en marche -> Mise sous tension
    expect(rows[1]).toHaveTextContent('Enregistrement patient')
    expect(rows[2]).toHaveTextContent('Mise en marche de l\'appareil')
    expect(rows[3]).toHaveTextContent('Mise sous tension de l\'appareil')
  })

  it('affiche un message quand la liste est vide', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([])
    renderWithProviders(<CompetencesList />, { route: '/competences' })

    await waitFor(() => {
      expect(screen.getByText(/aucune compétence/i)).toBeInTheDocument()
    })
  })

  it('clic sur Ajouter ouvre la modale avec un champ libellé', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CompetencesList />, { route: '/competences' })

    await waitFor(() => screen.getByText('Mise sous tension de l\'appareil'))

    await user.click(screen.getByRole('button', { name: /ajouter une compétence/i }))

    expect(screen.getByLabelText(/libellé/i)).toBeInTheDocument()
  })

  it('submit création appelle competence_ref_create avec les bons args', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CompetencesList />, { route: '/competences' })

    await waitFor(() => screen.getByText('Mise sous tension de l\'appareil'))

    await user.click(screen.getByRole('button', { name: /ajouter une compétence/i }))
    await user.type(screen.getByLabelText(/libellé/i), 'Test compétence')
    // Cocher Permanente pour rendre la durée non requise
    await user.click(screen.getByLabelText(/permanente/i))
    await user.click(screen.getByRole('button', { name: /^ajouter$/i }))

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('competence_ref_create', expect.objectContaining({
        libelle: 'Test compétence',
      }))
    })
  })

  it('clic Éditer ouvre la modale pré-remplie et appelle competence_ref_update', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CompetencesList />, { route: '/competences' })

    await waitFor(() => screen.getByText('Enregistrement patient'))

    const editButtons = screen.getAllByRole('button', { name: /éditer/i })
    await user.click(editButtons[0])

    const libelleInput = screen.getByLabelText(/libellé/i) as HTMLInputElement
    expect(libelleInput.value).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('competence_ref_update', expect.objectContaining({
        libelle: expect.any(String),
      }))
    })
  })

  it('clic Supprimer ouvre la modale de confirmation et appelle competence_ref_delete', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CompetencesList />, { route: '/competences' })

    await waitFor(() => screen.getByText('Enregistrement patient'))

    const deleteButtons = screen.getAllByRole('button', { name: /supprimer/i })
    await user.click(deleteButtons[0])

    const confirmText = screen.getByText(/supprimée définitivement/i)
    expect(confirmText).toBeInTheDocument()

    // Click the confirm button inside the modal (not the row-level delete buttons)
    const modal = confirmText.closest('div[class*="max-w"]') as HTMLElement
    await user.click(within(modal).getByRole('button', { name: /^supprimer$/i }))

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('competence_ref_delete', expect.objectContaining({
        id: expect.any(Number),
      }))
    })
  })
})
