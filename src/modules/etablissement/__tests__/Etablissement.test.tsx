import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '../../../test/test-utils';
import Etablissement from '../Etablissement';
import { invoke } from '@tauri-apps/api/core';

const mockEtablissement = {
  id: 1,
  denomination: 'Clinique Saint-Louis',
  statut_juridique: 'SAS',
  siret: '12345678901234',
  adresse: '10 Rue de la Paix',
  code_postal: '75000',
  ville: 'Paris',
  telephone: '0123456789',
  email: 'contact@clinique.fr',
  site_internet: 'https://clinique.fr',
  kbis_chemin: null,
  created_at: '2020-01-01',
  updated_at: '2024-01-01',
};

vi.mocked(invoke).mockImplementation(async (cmd) => {
  switch (cmd) {
    case 'etablissement_get':
      return mockEtablissement;
    case 'etablissement_update':
      return undefined;
    case 'document_upload':
      return {
        id: 1,
        entity_type: 'etablissement',
        entity_id: 1,
        type_document: 'kbis',
        nom_fichier: 'kbis.pdf',
        chemin_relatif: '/documents/kbis.pdf',
        uploaded_at: new Date().toISOString(),
      };
    default:
      return null;
  }
});

describe('Etablissement', () => {
  it('should display form pre-filled with etablissement data', async () => {
    renderWithProviders(<Etablissement />, { route: '/etablissement' });

    // Wait for the etablissement to load
    await waitFor(() => {
      expect(screen.getByText('Clinique Saint-Louis')).toBeInTheDocument();
    });

    // Check that the denomination is displayed
    expect(screen.getByText('Clinique Saint-Louis')).toBeInTheDocument();

    // Check that the statut juridique is displayed
    expect(screen.getByText('SAS')).toBeInTheDocument();
  });

  it('should pre-fill form fields with correct values when editing', async () => {
    renderWithProviders(<Etablissement />, { route: '/etablissement' });

    // Wait for the etablissement to load
    await waitFor(() => {
      expect(screen.getByText('Clinique Saint-Louis')).toBeInTheDocument();
    });

    // Click on "Modifier" button
    const modifierButton = screen.getByText('Modifier');
    fireEvent.click(modifierButton);

    // Check that input fields are pre-filled
    await waitFor(() => {
      const denominationInput = screen.getByDisplayValue('Clinique Saint-Louis');
      expect(denominationInput).toBeInTheDocument();

      const emailInput = screen.getByDisplayValue('contact@clinique.fr');
      expect(emailInput).toBeInTheDocument();
    });
  });

  it('should display K-Bis section with edit buttons in editing mode', async () => {
    renderWithProviders(<Etablissement />, { route: '/etablissement' });

    // Wait for the etablissement to load
    await waitFor(() => {
      expect(screen.getByText('Clinique Saint-Louis')).toBeInTheDocument();
    });

    // Click on "Modifier" button
    const modifierButton = screen.getByText('Modifier');
    fireEvent.click(modifierButton);

    // Wait for the Remplacer and Ouvrir buttons to be visible in K-Bis section
    await waitFor(() => {
      expect(screen.getByText('Remplacer')).toBeInTheDocument();
      expect(screen.getByText('Ouvrir')).toBeInTheDocument();
    });

    // Check that K-Bis section is displayed
    expect(screen.getByText('Document K-Bis')).toBeInTheDocument();
    expect(screen.getByText('Aucun document')).toBeInTheDocument();
  });
});
