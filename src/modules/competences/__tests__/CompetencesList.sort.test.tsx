import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithProviders, screen, waitFor } from '../../../test/test-utils'
import { invoke } from '@tauri-apps/api/core'
import CompetencesList from '../CompetencesList'
import type { CompetenceRef } from '../../../types/domain'

const mockCompetences: CompetenceRef[] = [
  {
    id: 3,
    libelle: 'Zebra - Compétence Z',
    ordre: 3,
    description: null,
    propre_appareil: 1,
    duree_validite_mois: 12,
    duree_alerte_mois: 3,
  },
  {
    id: 1,
    libelle: 'Alpha - Compétence A',
    ordre: 1,
    description: null,
    propre_appareil: 1,
    duree_validite_mois: 12,
    duree_alerte_mois: 3,
  },
  {
    id: 2,
    libelle: 'Bravo - Compétence B',
    ordre: 2,
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
    default:
      return null
  }
})

describe('CompetencesList - Tri', () => {
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

  it('tri alphabétique par défaut', async () => {
    renderWithProviders(<CompetencesList />, { route: '/competences' })

    await waitFor(() => {
      expect(screen.getByText('Alpha - Compétence A')).toBeInTheDocument()
    })

    const rows = screen.getAllByRole('row')
    // Row 0 = header, rows 1..3 = data triés alphabétiquement
    expect(rows[1]).toHaveTextContent('Alpha - Compétence A')
    expect(rows[2]).toHaveTextContent('Bravo - Compétence B')
    expect(rows[3]).toHaveTextContent('Zebra - Compétence Z')
  })

  it('le tri alphabétique respecte la locale française', async () => {
    const mockCompetencesWithAccents: CompetenceRef[] = [
      {
        id: 1,
        libelle: 'Énergétique',
        ordre: 1,
        description: null,
        propre_appareil: 1,
        duree_validite_mois: 12,
        duree_alerte_mois: 3,
      },
      {
        id: 2,
        libelle: 'Electronique',
        ordre: 2,
        description: null,
        propre_appareil: 1,
        duree_validite_mois: 12,
        duree_alerte_mois: 3,
      },
      {
        id: 3,
        libelle: 'Étendue',
        ordre: 3,
        description: null,
        propre_appareil: 1,
        duree_validite_mois: 12,
        duree_alerte_mois: 3,
      },
    ]

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'competence_list':
          return mockCompetencesWithAccents
        default:
          return null
      }
    })

    renderWithProviders(<CompetencesList />, { route: '/competences' })

    await waitFor(() => {
      expect(screen.getByText('Electronique')).toBeInTheDocument()
    })

    const rows = screen.getAllByRole('row')
    // Tri avec locale française : Electronique, Énergétique, Étendue
    expect(rows[1]).toHaveTextContent('Electronique')
    expect(rows[2]).toHaveTextContent('Énergétique')
    expect(rows[3]).toHaveTextContent('Étendue')
  })
})
