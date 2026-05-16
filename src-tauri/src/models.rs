use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Etablissement {
    pub id: i64,
    pub denomination: String,
    pub statut_juridique: Option<String>,
    pub siret: Option<String>,
    pub adresse: Option<String>,
    pub code_postal: Option<String>,
    pub ville: Option<String>,
    pub telephone: Option<String>,
    pub email: Option<String>,
    pub site_internet: Option<String>,
    pub kbis_chemin: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Travailleur {
    pub id: i64,
    pub etablissement_id: i64,
    pub nom: String,
    pub prenom: String,
    pub sexe: Option<String>,
    pub date_naissance: Option<String>,
    pub lieu_naissance: Option<String>,
    pub pays_naissance: Option<String>,
    pub fonction: Option<String>,
    pub date_debut_activite: Option<String>,
    pub categorie_reglementaire: Option<String>,
    pub numero_adeli_rpps: Option<String>,
    pub email: Option<String>,
    pub telephone: Option<String>,
    pub numero_securite_sociale: Option<String>,
    pub numero_porteur_dosimetrie_passive: Option<String>,
    pub numero_suivi_medical: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Miroir 1:1 de la table `habilitation`. Pas encore exposé via une commande
/// CRUD dédiée (l'app ne consomme que `HabilitationStatus` calculé), mais on
/// garde la struct comme contrat stable pour de futures lectures détaillées
/// et la sérialisation côté frontend.
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Habilitation {
    pub id: i64,
    pub travailleur_id: i64,
    pub dosimetrie_passive_date: Option<String>,
    pub dosimetrie_operationnelle_date: Option<String>,
    pub formation_rp_travailleurs_date: Option<String>,
    pub formation_rp_patients_date: Option<String>,
    pub visite_medicale_date: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompetenceRef {
    pub id: i64,
    pub libelle: String,
    pub ordre: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompetenceTravailleur {
    pub id: i64,
    pub travailleur_id: i64,
    pub appareil_id: i64,
    pub competence_ref_id: i64,
    pub date_validation: Option<String>,
    pub validated: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Appareil {
    pub id: i64,
    pub etablissement_id: i64,
    pub designation: String,
    pub marque: Option<String>,
    pub modele: Option<String>,
    pub numero_serie: Option<String>,
    pub type_: Option<String>,
    pub annee_mise_en_service: Option<i64>,
    pub lieu_utilisation: Option<String>,
    pub utilisation_partagee: i64,
    pub tension_nominale_kv: Option<f64>,
    pub intensite_maximale_ma: Option<f64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationTechnique {
    pub id: i64,
    pub appareil_id: i64,
    pub type_: String,
    pub date_realisation: String,
    pub realise_par: Option<String>,
    pub organisme: Option<String>,
    pub observations: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControleQualite {
    pub id: i64,
    pub appareil_id: i64,
    pub type_: String,
    pub date_realisation: Option<String>,
    pub date_echeance: String,
    pub controle_externe_id: Option<i64>,
    pub organisme: Option<String>,
    pub realise_par: Option<String>,
    pub statut: String,
    pub observations: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: i64,
    pub type_document: String,
    pub nom_fichier: String,
    pub chemin_relatif: String,
    pub uploaded_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabilitationStatus {
    pub statut: String,
    pub details: HabilitationDetails,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabilitationDetails {
    pub formation_rp_ok: bool,
    pub dosimetries_ok: bool,
    pub competences_ok: bool,
    pub visite_med_ok: bool,
}
