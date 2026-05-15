/**
 * PCR Manager — Types TypeScript Globaux
 * Basé sur le cahier des charges v2.0
 */

// ============================================================================
// Énumérations
// ============================================================================

export enum StatutHabilitation {
  NonValidee = 'non_validee',
  Partielle = 'partielle',
  Validee = 'validee',
}

export enum StatutAlerte {
  EnRetard = 'en_retard',
  APrevoir = 'a_prevoir',
  AJour = 'a_jour',
}

export enum CategorieReglementaire {
  A = 'A',
  B = 'B',
}

export enum Fonction {
  Cardiologue = 'cardiologue',
  CardiologueLiberal = 'cardiologue_liberal',
  MERM = 'merm',
  Infirmier = 'infirmier',
}

export enum Sexe {
  Homme = 'H',
  Femme = 'F',
  Autre = 'A',
}

export enum TypeAppareil {
  Fixe = 'fixe',
  Deplacable = 'deplacable',
}

// ============================================================================
// Interfaces Établissement
// ============================================================================

export interface Etablissement {
  id: string
  denomination: string
  statut_juridique: string
  siret: string
  adresse: string
  code_postal: string
  ville: string
  telephone?: string
  email?: string
  site_web?: string
  kbis_fichier?: string
  date_creation: Date
  date_modification: Date
}

// ============================================================================
// Interfaces Travailleurs
// ============================================================================

export interface Travailleur {
  id: string
  etablissement_id: string
  nom: string
  prenom: string
  sexe: Sexe
  date_naissance: Date
  lieu_naissance: string
  pays_naissance: string
  fonction: Fonction
  date_debut_activite: Date
  categorie_reglementaire: CategorieReglementaire
  numero_adeli?: string
  email?: string
  telephone?: string
  numero_ss: string // chiffré en BD
  numero_dosimetrie_passive?: string
  numero_suivi_medical?: string
  habilitation: Habilitation
  date_creation: Date
  date_modification: Date
}

export interface Habilitation {
  id: string
  travailleur_id: string
  statut: StatutHabilitation
  dosimetrie_passive?: {
    date_validation: Date
    alerte_renouvellement: Date
  }
  dosimetrie_operationnelle?: {
    date_validation: Date
    alerte_renouvellement: Date
  }
  formation_radioprotection_travailleurs?: {
    date_validation: Date
    renouvellement: 3 // ans
  }
  formation_radioprotection_patients?: {
    date_validation: Date
    renouvellement: 7 // ans
  }
  competences_appareils: CompetenceAppareil[]
  visite_medicale?: {
    date_validation: Date
    date_expiration: Date
  }
}

export interface CompetenceAppareil {
  id: string
  travailleur_id: string
  appareil_id: string
  competences_validees: number // 0-9
  date_validation?: Date
  statut: 'aucune' | 'partielle' | 'complete'
}

// ============================================================================
// Interfaces Appareils
// ============================================================================

export interface Appareil {
  id: string
  etablissement_id: string
  designation: string
  numero_serie: string
  marque: string
  modele: string
  type: TypeAppareil
  annee_mise_en_service: number
  lieu_utilisation: string
  utilisation_partagee: boolean
  tension_nominale_kv?: number
  intensite_max_ma?: number
  vérification_technique: VerificationTechnique
  controle_qualite: ControleQualite
  date_creation: Date
  date_modification: Date
}

export interface VerificationTechnique {
  id: string
  appareil_id: string
  interne?: {
    date_validation: Date
    date_expiration: Date
    alerte_1mois_avant: boolean
  }
  externe?: {
    date_validation: Date
    date_expiration: Date
    alerte_1mois_avant: boolean
  }
  statut: StatutAlerte
}

export interface ControleQualite {
  id: string
  appareil_id: string
  externe?: {
    date_validation: Date
    prochaine_echeance: Date
  }
  interne_partiel?: {
    echeances: Date[] // à 3 et 9 mois
  }
  interne_complet?: {
    echeance: Date // à 6 mois
  }
  statut: StatutAlerte
}

// ============================================================================
// Interfaces Actions
// ============================================================================

export interface Action {
  id: string
  etablissement_id: string
  type: 'formation' | 'visite_medicale' | 'verification_technique' | 'controle_qualite'
  source_id?: string // ID du travailleur ou appareil
  description: string
  date_echeance: Date
  date_alerte: Date
  statut: StatutAlerte
  completee: boolean
  date_completion?: Date
  date_creation: Date
  date_modification: Date
}

// ============================================================================
// Alertes Tableau de Bord
// ============================================================================

export interface AlerteTableauBord {
  id: string
  etablissement_id: string
  source: 'travailleur' | 'appareil'
  source_id: string
  type: 'habilitation' | 'visite_medicale' | 'formation' | 'verification' | 'controle_qualite'
  description: string
  statut: StatutAlerte
  date_expiration: Date
  date_alerte: Date
}
