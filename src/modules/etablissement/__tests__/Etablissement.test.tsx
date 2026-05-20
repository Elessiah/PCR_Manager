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

const mockKbisDoc = {
  id: 1,
  entity_type: 'etablissement',
  entity_id: 1,
  type_document: 'kbis',
  nom_fichier: 'kbis.pdf',
  chemin_relatif: 'documents/uuid.pdf',
  uploaded_at: new Date().toISOString(),
};

vi.mocked(invoke).mockImplementation(async (cmd) => {
  switch (cmd) {
    case 'etablissement_get':
      return mockEtablissement;
    case 'etablissement_update':
      return undefined;
    case 'document_list_for_entity':
      return [];
    case 'document_upload':
      return mockKbisDoc;
    default:
      return undefined;
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

  it('should display K-Bis section with "Charger le PDF" button when no document', async () => {
    renderWithProviders(<Etablissement />, { route: '/etablissement' });

    await waitFor(() => {
      expect(screen.getByText('Clinique Saint-Louis')).toBeInTheDocument();
    });

    const modifierButton = screen.getByText('Modifier');
    fireEvent.click(modifierButton);

    // Sans document KBIS, le mode édition affiche "Charger le PDF"
    await waitFor(() => {
      expect(screen.getByText('Charger le PDF')).toBeInTheDocument();
    });

    expect(screen.getByText('Document K-Bis')).toBeInTheDocument();
    expect(screen.getByText('Aucun document')).toBeInTheDocument();
  });

  it('should display Remplacer and Ouvrir buttons when a KBIS document exists', async () => {
    // Override le mock pour retourner un document KBIS
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      switch (cmd) {
        case 'etablissement_get':
          return mockEtablissement;
        case 'etablissement_update':
          return undefined;
        case 'document_list_for_entity':
          return [mockKbisDoc];
        default:
          return undefined;
      }
    });

    renderWithProviders(<Etablissement />, { route: '/etablissement' });

    await waitFor(() => {
      expect(screen.getByText('Clinique Saint-Louis')).toBeInTheDocument();
    });

    // "Ouvrir" est visible même hors mode édition
    await waitFor(() => {
      expect(screen.getByText('kbis.pdf')).toBeInTheDocument();
      expect(screen.getByText('Ouvrir')).toBeInTheDocument();
    });

    // En mode édition, "Remplacer" apparaît aussi
    const modifierButton = screen.getByText('Modifier');
    fireEvent.click(modifierButton);

    await waitFor(() => {
      expect(screen.getByText('Remplacer')).toBeInTheDocument();
    });
  });
});
