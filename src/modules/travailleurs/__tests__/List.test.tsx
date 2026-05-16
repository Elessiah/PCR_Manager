import { describe, it, expect, vi } from 'vitest'
import { renderWithProviders, screen, waitFor } from '../../../test/test-utils'
import { invoke } from '@tauri-apps/api/core'
import userEvent from '@testing-library/user-event'
import TravailleursList from '../TravailleursList'
import type { Travailleur } from '../../../types/domain'

const mockTravailleurs: Travailleur[] = [
  {
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
  },
  {
    id: 2,
    etablissement_id: 1,
    nom: 'Martin',
    prenom: 'Marie',
    sexe: 'F',
    date_naissance: '1985-03-20',
    lieu_naissance: 'Lyon',
    pays_naissance: 'France',
    fonction: 'Technicienne radio',
    date_debut_activite: '2012-09-15',
    categorie_reglementaire: 'B',
    numero_adeli_rpps: null,
    email: 'marie.martin@example.com',
    telephone: '07 98 76 54 32',
    numero_securite_sociale: '1850312345678902',
    numero_porteur_dosimetrie_passive: 'DP002',
    numero_suivi_medical: 'SM002',
    created_at: '2025-01-02T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
  },
  {
    id: 3,
    etablissement_id: 1,
    nom: 'Bernard',
    prenom: 'Pierre',
    sexe: 'M',
    date_naissance: '1975-07-10',
    lieu_naissance: 'Marseille',
    pays_naissance: 'France',
    fonction: 'Médecin généraliste',
    date_debut_activite: '2008-01-20',
    categorie_reglementaire: 'C',
    numero_adeli_rpps: '87654321',
    email: 'pierre.bernard@example.com',
    telephone: '06 55 44 33 22',
    numero_securite_sociale: '1750712345678903',
    numero_porteur_dosimetrie_passive: 'DP003',
    numero_suivi_medical: 'SM003',
    created_at: '2025-01-03T00:00:00Z',
    updated_at: '2025-01-03T00:00:00Z',
  },
]

vi.mocked(invoke).mockImplementation(async (cmd: string, args?: any) => {
  switch (cmd) {
    case 'travailleur_list':
      return mockTravailleurs
    case 'habilitation_compute':
      const habilitationMap: Record<number, string> = {
        1: 'validee',
        2: 'partielle',
        3: 'non_validee',
      }
      return { statut: habilitationMap[args?.travailleurId] || 'non_validee', details: {} }
    default:
      return null
  }
})

describe('TravailleursList', () => {
  it('should display list of 3 travailleurs', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    await waitFor(() => {
      expect(screen.getByText('DUPONT')).toBeInTheDocument()
    })

    expect(screen.getByText('Jean')).toBeInTheDocument()
    expect(screen.getByText('MARTIN')).toBeInTheDocument()
    expect(screen.getByText('Marie')).toBeInTheDocument()
    expect(screen.getByText('BERNARD')).toBeInTheDocument()
    expect(screen.getByText('Pierre')).toBeInTheDocument()
  })

  it('should display fonction for each travailleur', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    await waitFor(() => {
      expect(screen.getByText('Radiologiste')).toBeInTheDocument()
    })

    expect(screen.getByText('Technicienne radio')).toBeInTheDocument()
    expect(screen.getByText('Médecin généraliste')).toBeInTheDocument()
  })

  it('should call travailleur_list via invoke', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('travailleur_list')
    })
  })

  it('should display correct count of travailleurs', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    await waitFor(() => {
      expect(screen.getByText(/3 travailleurs/)).toBeInTheDocument()
    })
  })

  it('should display avatar with correct initials', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    await waitFor(() => {
      const avatar1 = screen.getByTestId('avatar-1')
      expect(avatar1).toBeInTheDocument()
      expect(avatar1).toHaveTextContent('JD')
    })

    const avatar2 = screen.getByTestId('avatar-2')
    expect(avatar2).toBeInTheDocument()
    expect(avatar2).toHaveTextContent('MM')

    const avatar3 = screen.getByTestId('avatar-3')
    expect(avatar3).toBeInTheDocument()
    expect(avatar3).toHaveTextContent('PB')
  })

  it('should display categorie_reglementaire column', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    await waitFor(() => {
      expect(screen.getByText('Catégorie')).toBeInTheDocument()
      expect(screen.getByText('A')).toBeInTheDocument()
    })

    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('should call habilitation_compute for each travailleur', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('habilitation_compute', { travailleurId: 1 })
    })

    expect(vi.mocked(invoke)).toHaveBeenCalledWith('habilitation_compute', { travailleurId: 2 })
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('habilitation_compute', { travailleurId: 3 })
  })

  it('should display habilitation status from computed value', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    await waitFor(() => {
      expect(screen.getByText('Partielle')).toBeInTheDocument()
    })
  })

  it('should not display Pencil button', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    await waitFor(() => {
      expect(screen.getByText('DUPONT')).toBeInTheDocument()
    })

    // No button with a lucide-pencil SVG should be present
    const pencilSvgs = document.querySelectorAll('svg.lucide-pencil')
    expect(pencilSvgs.length).toBe(0)
  })

  it('should display 4 filter pills with correct labels', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    await waitFor(() => {
      expect(screen.getByText('Tous')).toBeInTheDocument()
    })

    expect(screen.getByText('Validée')).toBeInTheDocument()
    expect(screen.getByText('Partielle')).toBeInTheDocument()
    expect(screen.getByText('Non validée')).toBeInTheDocument()
  })

  it('should display correct counts on filter pills', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    await waitFor(() => {
      const tousPill = screen.getByTestId('filter-pill-tous')
      expect(tousPill).toHaveTextContent('3')
    })

    const tousPill = screen.getByTestId('filter-pill-tous')
    const valideePill = screen.getByTestId('filter-pill-validee')
    const partialePill = screen.getByTestId('filter-pill-partielle')
    const nonValideePill = screen.getByTestId('filter-pill-non_validee')

    expect(tousPill).toHaveTextContent('3')
    expect(valideePill).toHaveTextContent('1')
    expect(partialePill).toHaveTextContent('1')
    expect(nonValideePill).toHaveTextContent('1')
  })

  it('should filter list when clicking validee pill', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    await waitFor(() => {
      expect(screen.getByText('DUPONT')).toBeInTheDocument()
    })

    expect(screen.getByText('MARTIN')).toBeInTheDocument()
    expect(screen.getByText('BERNARD')).toBeInTheDocument()

    const user = userEvent.setup()
    const valideePill = screen.getByTestId('filter-pill-validee')
    await user.click(valideePill)

    expect(screen.getByText('DUPONT')).toBeInTheDocument()
    expect(screen.queryByText('MARTIN')).not.toBeInTheDocument()
    expect(screen.queryByText('BERNARD')).not.toBeInTheDocument()
  })

  it('should display all travailleurs when Tous pill is selected', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    await waitFor(() => {
      expect(screen.getByText('DUPONT')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const valideePill = screen.getByTestId('filter-pill-validee')
    await user.click(valideePill)

    expect(screen.getByText('DUPONT')).toBeInTheDocument()
    expect(screen.queryByText('MARTIN')).not.toBeInTheDocument()

    const tousPill = screen.getByTestId('filter-pill-tous')
    await user.click(tousPill)

    expect(screen.getByText('DUPONT')).toBeInTheDocument()
    expect(screen.getByText('MARTIN')).toBeInTheDocument()
    expect(screen.getByText('BERNARD')).toBeInTheDocument()
  })
})
