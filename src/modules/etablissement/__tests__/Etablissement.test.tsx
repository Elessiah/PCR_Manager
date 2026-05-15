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

vi.mocked(invoke).mockImplementation(async (cmd, payload) => {
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

  it('should call document_upload when uploading K-Bis file', async () => {
    renderWithProviders(<Etablissement />, { route: '/etablissement' });

    // Wait for the etablissement to load
    await waitFor(() => {
      expect(screen.getByText('Clinique Saint-Louis')).toBeInTheDocument();
    });

    // Click on "Modifier" button
    const modifierButton = screen.getByText('Modifier');
    fireEvent.click(modifierButton);

    // Wait for the "Charger le PDF" button to be visible
    await waitFor(() => {
      expect(screen.getByText('Charger le PDF')).toBeInTheDocument();
    });

    // Get the file input and simulate file selection
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    // Create a mock File
    const file = new File(['test'], 'kbis.pdf', { type: 'application/pdf' });

    // Simulate file selection — jsdom n'expose pas DataTransfer ; on injecte directement
    // un FileList synthétique via Object.defineProperty.
    if (fileInput) {
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      fireEvent.change(fileInput);
    }

    // Wait for document_upload to be called
    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        'document_upload',
        expect.objectContaining({
          entityType: 'etablissement',
          entityId: 1,
          typeDocument: 'kbis',
        })
      );
    });
  });
});
