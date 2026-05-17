import { invoke } from '@tauri-apps/api/core';
import type {
  Etablissement,
  Travailleur,
  HabilitationStatus,
  CompetenceRef,
  CompetenceTravailleur,
  Appareil,
  VerificationTechnique,
  ControleQualite,
  Document,
} from '../types/domain';

export const api = {
  ping: () => invoke<string>('ping'),

  db: {
    init: () => invoke<void>('init_db'),
  },

  etablissement: {
    list: () => invoke<Etablissement[]>('etablissement_list'),
    get: (id: number) => invoke<Etablissement>('etablissement_get', { id }),
    create: (input: {
      denomination: string;
      statutJuridique?: string | null;
      siret?: string | null;
      adresse?: string | null;
      codePostal?: string | null;
      ville?: string | null;
      telephone?: string | null;
      email?: string | null;
      siteInternet?: string | null;
      kbisChemin?: string | null;
    }) => invoke<number>('etablissement_create', input),
    update: (input: {
      id: number;
      denomination: string;
      statutJuridique?: string | null;
      siret?: string | null;
      adresse?: string | null;
      codePostal?: string | null;
      ville?: string | null;
      telephone?: string | null;
      email?: string | null;
      siteInternet?: string | null;
      kbisChemin?: string | null;
    }) => invoke<void>('etablissement_update', input),
    delete: (id: number) => invoke<void>('etablissement_delete', { id }),
  },

  travailleur: {
    list: () => invoke<Travailleur[]>('travailleur_list'),
    get: (id: number) => invoke<Travailleur>('travailleur_get', { id }),
    create: (input: {
      etablissementId: number;
      nom: string;
      prenom: string;
      sexe?: string | null;
      dateNaissance?: string | null;
      lieuNaissance?: string | null;
      paysNaissance?: string | null;
      fonction?: string | null;
      dateDebutActivite?: string | null;
      categorieReglementaire?: string | null;
      numeroAdeliRpps?: string | null;
      email?: string | null;
      telephone?: string | null;
      numeroSecuriteSociale?: string | null;
      numeroPorteurDosimetriePassive?: string | null;
      numeroSuiviMedical?: string | null;
    }) => invoke<number>('travailleur_create', input),
    update: (input: {
      id: number;
      etablissementId: number;
      nom: string;
      prenom: string;
      sexe?: string | null;
      dateNaissance?: string | null;
      lieuNaissance?: string | null;
      paysNaissance?: string | null;
      fonction?: string | null;
      dateDebutActivite?: string | null;
      categorieReglementaire?: string | null;
      numeroAdeliRpps?: string | null;
      email?: string | null;
      telephone?: string | null;
      numeroSecuriteSociale?: string | null;
      numeroPorteurDosimetriePassive?: string | null;
      numeroSuiviMedical?: string | null;
    }) => invoke<void>('travailleur_update', input),
    delete: (id: number) => invoke<void>('travailleur_delete', { id }),
  },

  habilitation: {
    compute: (travailleurId: number) =>
      invoke<HabilitationStatus>('habilitation_compute', { travailleurId }),
  },

  competence: {
    list: () => invoke<CompetenceRef[]>('competence_list'),
    refCreate: (input: { libelle: string; ordre: number; description?: string | null }) =>
      invoke<CompetenceRef>('competence_ref_create', input),
    refUpdate: (input: { id: number; libelle: string; ordre: number; description?: string | null }) =>
      invoke<void>('competence_ref_update', input),
    refDelete: (id: number) => invoke<void>('competence_ref_delete', { id }),
    set: (input: {
      travailleurId: number;
      appareilId: number;
      competenceRefId: number;
      dateValidation?: string | null;
      validated: number;
    }) => invoke<void>('competence_set', input),
    getForTravailleur: (travailleurId: number) =>
      invoke<CompetenceTravailleur[]>('competence_get_for_travailleur', {
        travailleurId,
      }),
  },

  appareil: {
    list: () => invoke<Appareil[]>('appareil_list'),
    get: (id: number) => invoke<Appareil>('appareil_get', { id }),
    create: (input: {
      etablissementId: number;
      designation: string;
      marque?: string | null;
      modele?: string | null;
      numeroSerie?: string | null;
      type?: string | null;
      anneeMiseEnService?: number | null;
      lieuUtilisation?: string | null;
      utilisationPartagee: number;
      tensionNominaleKv?: number | null;
      intensiteMaximaleMa?: number | null;
    }) => invoke<number>('appareil_create', input),
    update: (input: {
      id: number;
      etablissementId: number;
      designation: string;
      marque?: string | null;
      modele?: string | null;
      numeroSerie?: string | null;
      type?: string | null;
      anneeMiseEnService?: number | null;
      lieuUtilisation?: string | null;
      utilisationPartagee: number;
      tensionNominaleKv?: number | null;
      intensiteMaximaleMa?: number | null;
    }) => invoke<void>('appareil_update', input),
    delete: (id: number) => invoke<void>('appareil_delete', { id }),
  },

  verification: {
    list: () => invoke<VerificationTechnique[]>('verification_list'),
    get: (id: number) => invoke<VerificationTechnique>('verification_get', { id }),
    create: (input: {
      appareilId: number;
      type: string;
      dateRealisation: string;
      realisePar?: string | null;
      organisme?: string | null;
      observations?: string | null;
    }) => invoke<number>('verification_create', input),
    update: (input: {
      id: number;
      appareilId: number;
      type: string;
      dateRealisation: string;
      realisePar?: string | null;
      organisme?: string | null;
      observations?: string | null;
    }) => invoke<void>('verification_update', input),
    delete: (id: number) => invoke<void>('verification_delete', { id }),
  },

  controleQualite: {
    list: () => invoke<ControleQualite[]>('controle_qualite_list'),
    get: (id: number) =>
      invoke<ControleQualite>('controle_qualite_get', { id }),
    create: (input: {
      appareilId: number;
      type: string;
      dateRealisation?: string | null;
      dateEcheance: string;
      controleExterneId?: number | null;
      organisme?: string | null;
      realisePar?: string | null;
      statut: string;
      observations?: string | null;
    }) => invoke<number>('controle_qualite_create', input),
    update: (input: {
      id: number;
      appareilId: number;
      type: string;
      dateRealisation?: string | null;
      dateEcheance: string;
      controleExterneId?: number | null;
      organisme?: string | null;
      realisePar?: string | null;
      statut: string;
      observations?: string | null;
    }) => invoke<void>('controle_qualite_update', input),
    delete: (id: number) => invoke<void>('controle_qualite_delete', { id }),
  },

  document: {
    list: () => invoke<Document[]>('document_list'),
    get: (id: number) => invoke<Document>('document_get', { id }),
    upload: (input: {
      entityType: string;
      entityId: number;
      typeDocument: string;
      nomFichier: string;
      sourcePath: string;
    }) => invoke<Document>('document_upload', input),
    delete: (id: number) => invoke<void>('document_delete', { id }),
  },

  passkey: {
    registerStart: () =>
      invoke<Record<string, unknown>>('passkey_register_start'),
    registerFinish: (input: {
      regId: string;
      response: Record<string, unknown>;
    }) => invoke<Record<string, unknown>>('passkey_register_finish', input),
    authStart: () =>
      invoke<Record<string, unknown>>('passkey_auth_start'),
    authFinish: (input: {
      authId: string;
      response: Record<string, unknown>;
    }) => invoke<Record<string, unknown>>('passkey_auth_finish', input),
  },
};
