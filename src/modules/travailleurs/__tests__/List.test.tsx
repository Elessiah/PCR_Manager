import { describe, it, expect, vi } from 'vitest'
import { renderWithProviders, screen, waitFor } from '../../../test/test-utils'
import { invoke } from '@tauri-apps/api/core'
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

vi.mocked(invoke).mockImplementation(async (cmd: string) => {
  switch (cmd) {
    case 'travailleur_list':
      return mockTravailleurs
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
})
