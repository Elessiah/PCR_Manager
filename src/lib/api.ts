import { invoke } from '@tauri-apps/api/core';
import type {
  Etablissement,
  Travailleur,
  Habilitation,
  HabilitationStatus,
  CompetenceRef,
  CompetenceTravailleur,
  CompetenceTravailleurGeneral,
  Appareil,
  VerificationTechnique,
  ControleQualite,
  Document,
  ExportEncryptedResult,
  ImportResultExtended,
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
    update: (input: {
      travailleurId: number;
      dosimetriePassiveDate?: string | null;
      dosimetrieOperationnelleDate?: string | null;
      formationRpTravailleursDate?: string | null;
      formationRpPatientsDate?: string | null;
      visiteMedicaleDate?: string | null;
      visiteMedicaleDureeMois?: number | null;
      visiteMedicaleDatePeremption?: string | null;
    }) =>
      invoke<void>('habilitation_update', {
        travailleurId: input.travailleurId,
        dosimetriePassiveDate: input.dosimetriePassiveDate,
        dosimetrieOperationnelleDate: input.dosimetrieOperationnelleDate,
        formationRpTravailleursDate: input.formationRpTravailleursDate,
        formationRpPatientsDate: input.formationRpPatientsDate,
        visiteMedicaleDate: input.visiteMedicaleDate,
        visiteMedicaleDureeMois: input.visiteMedicaleDureeMois,
        visiteMedicaleDatePeremption: input.visiteMedicaleDatePeremption,
      }),
    getForTravailleur: (travailleurId: number) =>
      invoke<Habilitation>('habilitation_get_for_travailleur', { travailleurId }),
  },

  competence: {
    list: () => invoke<CompetenceRef[]>('competence_list'),
    refCreate: (input: {
      libelle: string;
      ordre: number;
      description?: string | null;
      propreAppareil: number;
      dureeValiditeMois?: number | null;
      dureeAlerteMois: number;
    }) =>
      invoke<CompetenceRef>('competence_ref_create', {
        libelle: input.libelle,
        ordre: input.ordre,
        description: input.description,
        propreAppareil: input.propreAppareil,
        dureeValiditeMois: input.dureeValiditeMois,
        dureeAlerteMois: input.dureeAlerteMois,
      }),
    refUpdate: (input: {
      id: number;
      libelle: string;
      ordre: number;
      description?: string | null;
      propreAppareil: number;
      dureeValiditeMois?: number | null;
      dureeAlerteMois: number;
    }) =>
      invoke<void>('competence_ref_update', {
        id: input.id,
        libelle: input.libelle,
        ordre: input.ordre,
        description: input.description,
        propreAppareil: input.propreAppareil,
        dureeValiditeMois: input.dureeValiditeMois,
        dureeAlerteMois: input.dureeAlerteMois,
      }),
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
    generalSet: (input: {
      travailleurId: number;
      competenceRefId: number;
      dateValidation?: string | null;
      validated: number;
    }) =>
      invoke<void>('competence_general_set', {
        travailleurId: input.travailleurId,
        competenceRefId: input.competenceRefId,
        dateValidation: input.dateValidation,
        validated: input.validated,
      }),
    generalGetForTravailleur: (travailleurId: number) =>
      invoke<CompetenceTravailleurGeneral[]>('competence_general_get_for_travailleur', {
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
    competenceAdd: (appareilId: number, competenceRefId: number) =>
      invoke<void>('appareil_competence_add', { appareilId, competenceRefId }),
    competenceRemove: (appareilId: number, competenceRefId: number) =>
      invoke<void>('appareil_competence_remove', { appareilId, competenceRefId }),
    competenceList: (appareilId: number) =>
      invoke<number[]>('appareil_competence_list', { appareilId }),
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
    listForEntity: (entityType: string, entityId: number) =>
      invoke<Document[]>('document_list_for_entity', { entityType, entityId }),
    pickAndUpload: (input: {
      entityType: string;
      entityId: number;
      typeDocument: string;
      replaceDocumentId: number | null;
    }) => invoke<Document | null>('document_pick_and_upload', input),
    open: (id: number) => invoke<void>('document_open', { id }),
  },

  wifi: {
    /** Vérifie si le Wi-Fi est présent (available) et activé (enabled) sur macOS. */
    check: () => invoke<{ available: boolean; enabled: boolean }>('wifi_check'),
    /** Ouvre le panneau Wi-Fi dans les Réglages Système macOS. */
    openSettings: () => invoke<void>('wifi_open_settings'),
  },

  data: {
    export: () => invoke<string>('data_export'),
    import: (jsonStr: string) =>
      invoke<{ travailleurs_added: number; appareils_added: number }>('data_import', { jsonStr }),
    exportEncrypted: () =>
      invoke<ExportEncryptedResult>('data_export_encrypted'),
    importEncrypted: (input: { fileB64: string; code: string }) =>
      invoke<ImportResultExtended>('data_import_encrypted', {
        fileB64: input.fileB64,
        code: input.code,
      }),
  },

  iphoneAuth: {
    hasPairedDevice: () => invoke<boolean>('iphone_has_paired_device'),
    pairingList: () =>
      invoke<Array<{
        pairingId: string;
        iphoneDeviceName: string;
        iphoneDeviceId: string;
        pairedAt: string;
        lastAuthAt: string | null;
        authCounter: number;
      }>>('iphone_pairing_list'),
    pairingRevoke: (pairingId: string) =>
      invoke<void>('iphone_pairing_revoke', { pairingId }),
    pairingStart: () =>
      invoke<{ qrData: string; invitationId: string; serverPort: number }>(
        'iphone_pairing_start',
      ),
    pairingPoll: () =>
      invoke<{ status: string; pairingId?: string; error?: string }>(
        'iphone_pairing_poll',
      ),
    authChallengeStart: (pairingId: string) =>
      invoke<{ qrData: string; challengeId: string; serverPort: number }>(
        'iphone_auth_challenge_start',
        { pairingId },
      ),
    authPoll: () =>
      invoke<{ status: string; error?: string }>('iphone_auth_poll'),
    cancelPending: () => invoke<void>('iphone_cancel_pending'),
    sessionCheck: () => invoke<{ authenticated: boolean }>('session_check'),
    logout: () => invoke<void>('iphone_logout'),
    networkAvailable: () => invoke<boolean>('iphone_network_available'),
  },

  travailleurAppareil: {
    list: (travailleurId: number) =>
      invoke<number[]>('travailleur_appareil_list', { travailleurId }),
    add: (travailleurId: number, appareilId: number) =>
      invoke<void>('travailleur_appareil_add', { travailleurId, appareilId }),
    remove: (travailleurId: number, appareilId: number) =>
      invoke<void>('travailleur_appareil_remove', { travailleurId, appareilId }),
  },
};
