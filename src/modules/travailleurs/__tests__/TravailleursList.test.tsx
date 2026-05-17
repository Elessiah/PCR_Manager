import { describe, it, expect, vi } from 'vitest'
import { renderWithProviders, screen, waitFor } from '../../../test/test-utils'
import { invoke } from '@tauri-apps/api/core'
import userEvent from '@testing-library/user-event'
import TravailleursList from '../TravailleursList'

vi.mock('@tauri-apps/api/core')

describe('TravailleursList - Add Modal', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockImplementation(async (cmd: string, args?: any) => {
      if (cmd === 'travailleur_list') {
        return []
      }
      if (cmd === 'travailleur_create') {
        return 1
      }
      return null
    })
  })

  it('opens modal when add button is clicked', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    const addButton = screen.getByRole('button', { name: /Ajouter un travailleur/i })
    await userEvent.click(addButton)

    const modal = screen.getByRole('heading', { name: /Ajouter un travailleur/i })
    expect(modal).toBeInTheDocument()
  })

  it('calls travailleur_create on valid form submission', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    const addButton = screen.getByRole('button', { name: /Ajouter un travailleur/i })
    await userEvent.click(addButton)

    const nomInput = screen.getByPlaceholderText('Dupont')
    const prenomInput = screen.getByPlaceholderText('Jean')
    const submitButton = screen.getByRole('button', { name: /Ajouter$/i })

    await userEvent.type(nomInput, 'Dupont')
    await userEvent.type(prenomInput, 'Jean')
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        'travailleur_create',
        expect.objectContaining({
          etablissementId: 1,
          nom: 'Dupont',
          prenom: 'Jean',
        })
      )
    })
  })

  it('disables submit button when nom is empty', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    const addButton = screen.getByRole('button', { name: /Ajouter un travailleur/i })
    await userEvent.click(addButton)

    const prenomInput = screen.getByPlaceholderText('Jean')
    const submitButton = screen.getByRole('button', { name: /Ajouter$/i })

    await userEvent.type(prenomInput, 'Jean')

    expect(submitButton).toBeDisabled()
  })

  it('disables submit button when prenom is empty', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    const addButton = screen.getByRole('button', { name: /Ajouter un travailleur/i })
    await userEvent.click(addButton)

    const nomInput = screen.getByPlaceholderText('Dupont')
    const submitButton = screen.getByRole('button', { name: /Ajouter$/i })

    await userEvent.type(nomInput, 'Dupont')

    expect(submitButton).toBeDisabled()
  })

  it('closes modal on successful submission', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    const addButton = screen.getByRole('button', { name: /Ajouter un travailleur/i })
    await userEvent.click(addButton)

    const nomInput = screen.getByPlaceholderText('Dupont')
    const prenomInput = screen.getByPlaceholderText('Jean')
    const submitButton = screen.getByRole('button', { name: /Ajouter$/i })

    await userEvent.type(nomInput, 'Dupont')
    await userEvent.type(prenomInput, 'Jean')
    await userEvent.click(submitButton)

    await waitFor(() => {
      const modal = screen.queryByRole('heading', { name: /Ajouter un travailleur/i })
      expect(modal).not.toBeInTheDocument()
    })
  })

  it('includes optional fields in API call when provided', async () => {
    renderWithProviders(<TravailleursList />, { route: '/travailleurs' })

    const addButton = screen.getByRole('button', { name: /Ajouter un travailleur/i })
    await userEvent.click(addButton)

    const nomInput = screen.getByPlaceholderText('Dupont')
    const prenomInput = screen.getByPlaceholderText('Jean')
    const fonctionInput = screen.getByPlaceholderText('Technicien')
    const submitButton = screen.getByRole('button', { name: /Ajouter$/i })

    await userEvent.type(nomInput, 'Dupont')
    await userEvent.type(prenomInput, 'Jean')
    await userEvent.type(fonctionInput, 'Technicien')
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        'travailleur_create',
        expect.objectContaining({
          etablissementId: 1,
          nom: 'Dupont',
          prenom: 'Jean',
          fonction: 'Technicien',
        })
      )
    })
  })
})
