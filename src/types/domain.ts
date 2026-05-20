export interface Etablissement {
  id: number;
  denomination: string;
  statut_juridique: string | null;
  siret: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  telephone: string | null;
  email: string | null;
  site_internet: string | null;
  kbis_chemin: string | null;
  created_at: string;
  updated_at: string;
}

export interface Travailleur {
  id: number;
  etablissement_id: number;
  nom: string;
  prenom: string;
  sexe: string | null;
  date_naissance: string | null;
  lieu_naissance: string | null;
  pays_naissance: string | null;
  fonction: string | null;
  date_debut_activite: string | null;
  categorie_reglementaire: string | null;
  numero_adeli_rpps: string | null;
  email: string | null;
  telephone: string | null;
  numero_securite_sociale: string | null;
  numero_porteur_dosimetrie_passive: string | null;
  numero_suivi_medical: string | null;
  created_at: string;
  updated_at: string;
}

export interface Habilitation {
  id: number;
  travailleur_id: number;
  dosimetrie_passive_date: string | null;
  dosimetrie_operationnelle_date: string | null;
  formation_rp_travailleurs_date: string | null;
  formation_rp_patients_date: string | null;
  visite_medicale_date: string | null;
  visite_medicale_date_peremption: string | null;
  visite_medicale_duree_mois: number | null;
  updated_at: string;
}

export type HabilitationStatut = 'validee' | 'partielle' | 'non_validee';

export interface HabilitationDetails {
  formation_rp_ok: boolean;
  formation_rp_patients_ok: boolean;
  dosimetries_ok: boolean;
  competences_ok: boolean;
  visite_med_ok: boolean;
}

export interface HabilitationStatus {
  statut: HabilitationStatut;
  details: HabilitationDetails;
}

export interface CompetenceRef {
  id: number;
  libelle: string;
  ordre: number;
  description: string | null;
  propre_appareil: number;
  duree_validite_mois: number | null;
  duree_alerte_mois: number;
}

export interface CompetenceTravailleur {
  id: number;
  travailleur_id: number;
  appareil_id: number;
  competence_ref_id: number;
  date_validation: string | null;
  validated: number;
  date_peremption: string | null;
}

export interface Appareil {
  id: number;
  etablissement_id: number;
  designation: string;
  marque: string | null;
  modele: string | null;
  numero_serie: string | null;
  type_: string | null;
  annee_mise_en_service: number | null;
  lieu_utilisation: string | null;
  utilisation_partagee: number;
  tension_nominale_kv: number | null;
  intensite_maximale_ma: number | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationTechnique {
  id: number;
  appareil_id: number;
  type_: string;
  date_realisation: string;
  realise_par: string | null;
  organisme: string | null;
  observations: string | null;
  created_at: string;
}

export interface ControleQualite {
  id: number;
  appareil_id: number;
  type_: string;
  date_realisation: string | null;
  date_echeance: string;
  controle_externe_id: number | null;
  organisme: string | null;
  realise_par: string | null;
  statut: string;
  observations: string | null;
  created_at: string;
}

export interface Document {
  id: number;
  entity_type: string;
  entity_id: number;
  type_document: string;
  nom_fichier: string;
  chemin_relatif: string;
  uploaded_at: string;
}

export interface TravailleurAppareil {
  id: number;
  travailleur_id: number;
  appareil_id: number;
}

export interface CompetenceTravailleurGeneral {
  id: number;
  travailleur_id: number;
  competence_ref_id: number;
  date_validation: string | null;
  date_peremption: string | null;
  validated: number;
}

export interface ExportEncryptedResult {
  code: string;
  file_b64: string;
}

export interface ImportResultExtended {
  travailleurs_added: number;
  appareils_added: number;
  competences_added: number;
  habilitations_added: number;
  etablissements_added: number;
  verifications_added: number;
  controles_added: number;
}
