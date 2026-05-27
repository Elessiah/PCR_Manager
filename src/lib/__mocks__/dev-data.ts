// Mock invoke handler — uniquement actif en mode browser sans backend Tauri.
// Store stateful + persistance sessionStorage : survit aux navigations Puppeteer.
// Auth bypass : session_check retourne toujours { authenticated: true }.

import type {
  Etablissement,
  Travailleur,
  Habilitation,
  HabilitationStatus,
  Appareil,
  VerificationTechnique,
  ControleQualite,
  CompetenceRef,
  CompetenceTravailleur,
  CompetenceTravailleurGeneral,
} from '../../types/domain';

// ── Stores ────────────────────────────────────────────────────────────────────

let nextId = 100;

const etablissements: Etablissement[] = [
  {
    id: 1,
    denomination: 'Clinique Saint-Exupéry [DEV]',
    statut_juridique: 'SAS',
    siret: '12345678900001',
    adresse: '42 rue de la Paix',
    code_postal: '75001',
    ville: 'Paris',
    telephone: '01 23 45 67 89',
    email: 'contact@clinique-dev.fr',
    site_internet: null,
    kbis_chemin: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

const travailleurs: Travailleur[] = [];
const habilitationsMap = new Map<number, Habilitation>();
const appareils: Appareil[] = [];
const verifications: VerificationTechnique[] = [];
const controles: ControleQualite[] = [];
const travailleurAppareils = new Map<number, Set<number>>();
const competencesTravailleur = new Map<string, CompetenceTravailleur>();
const competencesTravailleurGeneral = new Map<string, CompetenceTravailleurGeneral>();
const appareilCompetenceRefs = new Map<number, Set<number>>();

const competenceRefs: CompetenceRef[] = [
  { id: 1, libelle: "Mise sous tension de l'appareil",               ordre: 1, description: null, propre_appareil: 1, duree_validite_mois: null, duree_alerte_mois: 3 },
  { id: 2, libelle: "Mise en marche de l'appareil",                  ordre: 2, description: null, propre_appareil: 1, duree_validite_mois: null, duree_alerte_mois: 3 },
  { id: 3, libelle: 'Enregistrement patient (vérification identité)', ordre: 3, description: null, propre_appareil: 1, duree_validite_mois: null, duree_alerte_mois: 3 },
  { id: 4, libelle: 'Détection patients à risque',                    ordre: 4, description: null, propre_appareil: 1, duree_validite_mois: null, duree_alerte_mois: 3 },
  { id: 5, libelle: 'Compétence 5',                                   ordre: 5, description: null, propre_appareil: 1, duree_validite_mois: null, duree_alerte_mois: 3 },
  { id: 6, libelle: 'Compétence 6',                                   ordre: 6, description: null, propre_appareil: 1, duree_validite_mois: null, duree_alerte_mois: 3 },
  { id: 7, libelle: 'Compétence 7',                                   ordre: 7, description: null, propre_appareil: 1, duree_validite_mois: null, duree_alerte_mois: 3 },
  { id: 8, libelle: 'Compétence 8',                                   ordre: 8, description: null, propre_appareil: 1, duree_validite_mois: null, duree_alerte_mois: 3 },
  { id: 9, libelle: 'Compétence 9',                                   ordre: 9, description: null, propre_appareil: 1, duree_validite_mois: null, duree_alerte_mois: 3 },
];

// ── Persistance sessionStorage ────────────────────────────────────────────────

const STORAGE_KEY = 'pcr-dev-mock-store';

function saveStore(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      nextId,
      etablissements,
      travailleurs,
      habilitations: Array.from(habilitationsMap.entries()),
      appareils,
      verifications,
      controles,
      travailleurAppareils: Array.from(travailleurAppareils.entries()).map(([k, v]) => [k, Array.from(v)]),
      competencesTravailleur: Array.from(competencesTravailleur.entries()),
      competencesTravailleurGeneral: Array.from(competencesTravailleurGeneral.entries()),
      appareilCompetenceRefs: Array.from(appareilCompetenceRefs.entries()).map(([k, v]) => [k, Array.from(v)]),
      competenceRefs,
    }));
  } catch { /* storage indisponible (SSR, test) */ }
}

function loadStore(): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as Record<string, unknown>;

    nextId = (data.nextId as number) ?? 100;

    const replace = <T>(arr: T[], src: T[]) => { arr.length = 0; arr.push(...src); };

    replace(etablissements, data.etablissements as Etablissement[]);
    replace(travailleurs, data.travailleurs as Travailleur[]);
    replace(appareils, data.appareils as Appareil[]);
    replace(verifications, data.verifications as VerificationTechnique[]);
    replace(controles, data.controles as ControleQualite[]);
    replace(competenceRefs, data.competenceRefs as CompetenceRef[]);

    habilitationsMap.clear();
    for (const [k, v] of (data.habilitations as [number, Habilitation][])) habilitationsMap.set(k, v);

    travailleurAppareils.clear();
    for (const [k, v] of (data.travailleurAppareils as [number, number[]][])) travailleurAppareils.set(k, new Set(v));

    competencesTravailleur.clear();
    for (const [k, v] of (data.competencesTravailleur as [string, CompetenceTravailleur][])) competencesTravailleur.set(k, v);

    competencesTravailleurGeneral.clear();
    for (const [k, v] of (data.competencesTravailleurGeneral as [string, CompetenceTravailleurGeneral][])) competencesTravailleurGeneral.set(k, v);

    appareilCompetenceRefs.clear();
    for (const [k, v] of (data.appareilCompetenceRefs as [number, number[]][])) appareilCompetenceRefs.set(k, new Set(v));
  } catch { /* JSON corrompu ou store absent */ }
}

// Chargement au démarrage du module
loadStore();

// ── Helpers ───────────────────────────────────────────────────────────────────

const newId = () => nextId++;

function checkDateWithinYears(dateStr: string, years: number): boolean {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const deadline = new Date(date);
  deadline.setFullYear(deadline.getFullYear() + years);
  return new Date() <= deadline;
}

function checkDateNotExpired(dateStr: string): boolean {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  return new Date() <= date;
}

function checkDateWithMonths(dateStr: string, months: number): boolean {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const deadline = new Date(date);
  deadline.setMonth(deadline.getMonth() + months);
  return new Date() <= deadline;
}

function computeHabilitation(travailleurId: number): HabilitationStatus {
  const hab = habilitationsMap.get(travailleurId);
  if (!hab) {
    return {
      statut: 'non_validee',
      details: { formation_rp_ok: false, formation_rp_patients_ok: false, dosimetries_ok: false, competences_ok: false, visite_med_ok: false },
    };
  }

  const dosimetries_ok =
    hab.dosimetrie_passive_date != null &&
    hab.dosimetrie_operationnelle_date != null &&
    checkDateWithinYears(hab.dosimetrie_passive_date, 2) &&
    checkDateWithinYears(hab.dosimetrie_operationnelle_date, 2);

  const formation_rp_ok = hab.formation_rp_travailleurs_date != null
    ? checkDateWithinYears(hab.formation_rp_travailleurs_date, 3) : false;

  const formation_rp_patients_ok = hab.formation_rp_patients_date != null
    ? checkDateWithinYears(hab.formation_rp_patients_date, 7) : false;

  let visite_med_ok: boolean;
  if (hab.visite_medicale_date_peremption != null) {
    visite_med_ok = checkDateNotExpired(hab.visite_medicale_date_peremption);
  } else if (hab.visite_medicale_duree_mois != null && hab.visite_medicale_date != null) {
    visite_med_ok = checkDateWithMonths(hab.visite_medicale_date, hab.visite_medicale_duree_mois);
  } else if (hab.visite_medicale_date != null) {
    visite_med_ok = checkDateWithinYears(hab.visite_medicale_date, 1);
  } else {
    visite_med_ok = false;
  }

  const appareilIds = travailleurAppareils.get(travailleurId) ?? new Set<number>();
  let competences_ok = false;
  if (appareilIds.size > 0) {
    competences_ok = true;
    outer: for (const appareilId of appareilIds) {
      const requiredComps = appareilCompetenceRefs.get(appareilId) ?? new Set<number>();
      for (const compId of requiredComps) {
        const ct = competencesTravailleur.get(`${travailleurId}_${appareilId}_${compId}`);
        if (!ct || ct.validated !== 1) { competences_ok = false; break outer; }
      }
    }
    if (competences_ok) {
      for (const comp of competenceRefs.filter(c => c.propre_appareil === 0)) {
        const ctg = competencesTravailleurGeneral.get(`${travailleurId}_${comp.id}`);
        if (!ctg || ctg.validated !== 1) { competences_ok = false; break; }
      }
    }
  }

  const okCount = [formation_rp_ok, formation_rp_patients_ok, dosimetries_ok, competences_ok, visite_med_ok].filter(Boolean).length;
  const statut: HabilitationStatus['statut'] =
    okCount === 5 ? 'validee' : okCount > 0 ? 'partielle' : 'non_validee';

  return { statut, details: { formation_rp_ok, formation_rp_patients_ok, dosimetries_ok, competences_ok, visite_med_ok } };
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function devMockInvoke<T>(cmd: string, args?: unknown): Promise<T> {
  const a = args as Record<string, unknown> | undefined;
  await new Promise(r => setTimeout(r, 20));

  switch (cmd) {

    // ── Auth ────────────────────────────────────────────────────────────────
    case 'session_check':       return { authenticated: true } as T;
    case 'ping':                return 'pong' as T;
    case 'mac_auth_available':  return false as T;
    case 'totp_available':      return false as T;
    case 'mac_auth_start':      return undefined as T;
    case 'mac_se_activate':     return undefined as T;
    case 'totp_login':          return undefined as T;
    case 'logout':              return undefined as T;
    case 'totp_setup_start':
      return 'otpauth://totp/PCRManager:dev@dev.local?secret=JBSWY3DPEHPK3PXP&issuer=PCRManager' as T;
    case 'totp_setup_confirm':  return undefined as T;

    // ── Établissement ───────────────────────────────────────────────────────
    case 'etablissement_list':
      return [...etablissements] as T;
    case 'etablissement_get':
      return (etablissements.find(e => e.id === a?.id) ?? etablissements[0]) as T;
    case 'etablissement_create': {
      const etab: Etablissement = {
        id: newId(),
        denomination: a?.denomination as string,
        statut_juridique: (a?.statutJuridique as string | null) ?? null,
        siret: (a?.siret as string | null) ?? null,
        adresse: (a?.adresse as string | null) ?? null,
        code_postal: (a?.codePostal as string | null) ?? null,
        ville: (a?.ville as string | null) ?? null,
        telephone: (a?.telephone as string | null) ?? null,
        email: (a?.email as string | null) ?? null,
        site_internet: (a?.siteInternet as string | null) ?? null,
        kbis_chemin: (a?.kbisChemin as string | null) ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      etablissements.push(etab);
      saveStore();
      return etab.id as T;
    }
    case 'etablissement_update': {
      const idx = etablissements.findIndex(e => e.id === a?.id);
      if (idx >= 0) {
        etablissements[idx] = {
          ...etablissements[idx],
          denomination: a?.denomination as string,
          statut_juridique: (a?.statutJuridique as string | null) ?? null,
          siret: (a?.siret as string | null) ?? null,
          adresse: (a?.adresse as string | null) ?? null,
          code_postal: (a?.codePostal as string | null) ?? null,
          ville: (a?.ville as string | null) ?? null,
          telephone: (a?.telephone as string | null) ?? null,
          email: (a?.email as string | null) ?? null,
          site_internet: (a?.siteInternet as string | null) ?? null,
          kbis_chemin: (a?.kbisChemin as string | null) ?? null,
          updated_at: new Date().toISOString(),
        };
        saveStore();
      }
      return undefined as T;
    }

    // ── Travailleurs ────────────────────────────────────────────────────────
    case 'travailleur_list':
      return [...travailleurs] as T;
    case 'travailleur_get':
      return (travailleurs.find(t => t.id === a?.id) ?? null) as T;
    case 'travailleur_create': {
      const t: Travailleur = {
        id: newId(),
        etablissement_id: (a?.etablissementId as number) ?? 1,
        nom: a?.nom as string,
        prenom: a?.prenom as string,
        sexe: (a?.sexe as string | null) ?? null,
        date_naissance: (a?.dateNaissance as string | null) ?? null,
        lieu_naissance: (a?.lieuNaissance as string | null) ?? null,
        pays_naissance: (a?.paysNaissance as string | null) ?? null,
        fonction: (a?.fonction as string | null) ?? null,
        date_debut_activite: (a?.dateDebutActivite as string | null) ?? null,
        categorie_reglementaire: (a?.categorieReglementaire as string | null) ?? null,
        numero_adeli_rpps: (a?.numeroAdeliRpps as string | null) ?? null,
        email: (a?.email as string | null) ?? null,
        telephone: (a?.telephone as string | null) ?? null,
        numero_securite_sociale: (a?.numeroSecuriteSociale as string | null) ?? null,
        numero_porteur_dosimetrie_passive: (a?.numeroPorteurDosimetriePassive as string | null) ?? null,
        numero_suivi_medical: (a?.numeroSuiviMedical as string | null) ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      travailleurs.push(t);
      saveStore();
      return t.id as T;
    }
    case 'travailleur_update': {
      const idx = travailleurs.findIndex(t => t.id === a?.id);
      if (idx >= 0) {
        travailleurs[idx] = {
          ...travailleurs[idx],
          nom: (a?.nom as string) ?? travailleurs[idx].nom,
          prenom: (a?.prenom as string) ?? travailleurs[idx].prenom,
          sexe: (a?.sexe as string | null) ?? null,
          date_naissance: (a?.dateNaissance as string | null) ?? null,
          lieu_naissance: (a?.lieuNaissance as string | null) ?? null,
          pays_naissance: (a?.paysNaissance as string | null) ?? null,
          fonction: (a?.fonction as string | null) ?? null,
          date_debut_activite: (a?.dateDebutActivite as string | null) ?? null,
          categorie_reglementaire: (a?.categorieReglementaire as string | null) ?? null,
          numero_adeli_rpps: (a?.numeroAdeliRpps as string | null) ?? null,
          email: (a?.email as string | null) ?? null,
          telephone: (a?.telephone as string | null) ?? null,
          numero_securite_sociale: (a?.numeroSecuriteSociale as string | null) ?? null,
          numero_porteur_dosimetrie_passive: (a?.numeroPorteurDosimetriePassive as string | null) ?? null,
          numero_suivi_medical: (a?.numeroSuiviMedical as string | null) ?? null,
          updated_at: new Date().toISOString(),
        };
        saveStore();
      }
      return undefined as T;
    }
    case 'travailleur_delete': {
      const id = a?.id as number;
      const idx = travailleurs.findIndex(t => t.id === id);
      if (idx >= 0) travailleurs.splice(idx, 1);
      habilitationsMap.delete(id);
      travailleurAppareils.delete(id);
      saveStore();
      return undefined as T;
    }

    // ── Habilitation ────────────────────────────────────────────────────────
    case 'habilitation_get_for_travailleur': {
      const tId = a?.travailleurId as number;
      const hab = habilitationsMap.get(tId);
      if (hab) return hab as T;
      return {
        id: 0, travailleur_id: tId,
        dosimetrie_passive_date: null, dosimetrie_operationnelle_date: null,
        formation_rp_travailleurs_date: null, formation_rp_patients_date: null,
        visite_medicale_date: null, visite_medicale_date_peremption: null,
        visite_medicale_duree_mois: null, updated_at: '',
      } as T;
    }
    case 'habilitation_compute':
      return computeHabilitation(a?.travailleurId as number) as T;
    case 'habilitation_update': {
      const tId = a?.travailleurId as number;
      const existing = habilitationsMap.get(tId);
      habilitationsMap.set(tId, {
        id: existing?.id ?? newId(),
        travailleur_id: tId,
        dosimetrie_passive_date: (a?.dosimetriePassiveDate as string | null) ?? null,
        dosimetrie_operationnelle_date: (a?.dosimetrieOperationnelleDate as string | null) ?? null,
        formation_rp_travailleurs_date: (a?.formationRpTravailleursDate as string | null) ?? null,
        formation_rp_patients_date: (a?.formationRpPatientsDate as string | null) ?? null,
        visite_medicale_date: (a?.visiteMedicaleDate as string | null) ?? null,
        visite_medicale_date_peremption: (a?.visiteMedicaleDatePeremption as string | null) ?? null,
        visite_medicale_duree_mois: (a?.visiteMedicaleDureeMois as number | null) ?? null,
        updated_at: new Date().toISOString(),
      });
      saveStore();
      return undefined as T;
    }

    // ── Appareils ───────────────────────────────────────────────────────────
    case 'appareil_list':
      return [...appareils] as T;
    case 'appareil_get':
      return (appareils.find(ap => ap.id === a?.id) ?? null) as T;
    case 'appareil_create': {
      const ap: Appareil = {
        id: newId(),
        etablissement_id: (a?.etablissementId as number) ?? 1,
        designation: a?.designation as string,
        marque: (a?.marque as string | null) ?? null,
        modele: (a?.modele as string | null) ?? null,
        numero_serie: (a?.numeroSerie as string | null) ?? null,
        type_: (a?.type as string | null) ?? null,
        annee_mise_en_service: (a?.anneeMiseEnService as number | null) ?? null,
        lieu_utilisation: (a?.lieuUtilisation as string | null) ?? null,
        utilisation_partagee: (a?.utilisationPartagee as number) ?? 0,
        tension_nominale_kv: (a?.tensionNominaleKv as number | null) ?? null,
        intensite_maximale_ma: (a?.intensiteMaximaleMa as number | null) ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      appareils.push(ap);
      saveStore();
      return ap.id as T;
    }
    case 'appareil_update': {
      const idx = appareils.findIndex(ap => ap.id === a?.id);
      if (idx >= 0) {
        appareils[idx] = {
          ...appareils[idx],
          designation: a?.designation as string,
          marque: (a?.marque as string | null) ?? null,
          modele: (a?.modele as string | null) ?? null,
          numero_serie: (a?.numeroSerie as string | null) ?? null,
          type_: (a?.type as string | null) ?? null,
          annee_mise_en_service: (a?.anneeMiseEnService as number | null) ?? null,
          lieu_utilisation: (a?.lieuUtilisation as string | null) ?? null,
          utilisation_partagee: (a?.utilisationPartagee as number) ?? 0,
          tension_nominale_kv: (a?.tensionNominaleKv as number | null) ?? null,
          intensite_maximale_ma: (a?.intensiteMaximaleMa as number | null) ?? null,
          updated_at: new Date().toISOString(),
        };
        saveStore();
      }
      return undefined as T;
    }
    case 'appareil_delete': {
      const id = a?.id as number;
      const idx = appareils.findIndex(ap => ap.id === id);
      if (idx >= 0) appareils.splice(idx, 1);
      saveStore();
      return undefined as T;
    }

    // ── Compétences référentiel ─────────────────────────────────────────────
    case 'competence_list':
      return [...competenceRefs] as T;
    case 'competence_ref_create': {
      const comp: CompetenceRef = {
        id: newId(),
        libelle: a?.libelle as string,
        ordre: a?.ordre as number,
        description: (a?.description as string | null) ?? null,
        propre_appareil: (a?.propreAppareil as number) ?? 1,
        duree_validite_mois: (a?.dureeValiditeMois as number | null) ?? null,
        duree_alerte_mois: (a?.dureeAlerteMois as number) ?? 3,
      };
      competenceRefs.push(comp);
      saveStore();
      return comp as T;
    }
    case 'competence_ref_update': {
      const idx = competenceRefs.findIndex(c => c.id === a?.id);
      if (idx >= 0) {
        competenceRefs[idx] = {
          ...competenceRefs[idx],
          libelle: a?.libelle as string,
          ordre: a?.ordre as number,
          description: (a?.description as string | null) ?? null,
          propre_appareil: (a?.propreAppareil as number) ?? 1,
          duree_validite_mois: (a?.dureeValiditeMois as number | null) ?? null,
          duree_alerte_mois: (a?.dureeAlerteMois as number) ?? 3,
        };
        saveStore();
      }
      return undefined as T;
    }
    case 'competence_ref_delete': {
      const delId = a?.id as number;
      const idx = competenceRefs.findIndex(c => c.id === delId);
      if (idx >= 0) competenceRefs.splice(idx, 1);
      // Cascade: mirror SQLite ON DELETE CASCADE
      for (const [aId, refSet] of appareilCompetenceRefs) {
        refSet.delete(delId);
        if (refSet.size === 0) appareilCompetenceRefs.delete(aId);
      }
      for (const key of Array.from(competencesTravailleur.keys())) {
        if (key.endsWith(`_${delId}`)) competencesTravailleur.delete(key);
      }
      for (const key of Array.from(competencesTravailleurGeneral.keys())) {
        if (key.endsWith(`_${delId}`)) competencesTravailleurGeneral.delete(key);
      }
      saveStore();
      return undefined as T;
    }

    // ── Compétences travailleur (par appareil) ──────────────────────────────
    case 'competence_get_for_travailleur': {
      const tId = a?.travailleurId as number;
      return Array.from(competencesTravailleur.values()).filter(ct => ct.travailleur_id === tId) as T;
    }
    case 'competence_set': {
      const key = `${a?.travailleurId}_${a?.appareilId}_${a?.competenceRefId}`;
      const existing = competencesTravailleur.get(key);
      competencesTravailleur.set(key, {
        id: existing?.id ?? newId(),
        travailleur_id: a?.travailleurId as number,
        appareil_id: a?.appareilId as number,
        competence_ref_id: a?.competenceRefId as number,
        date_validation: (a?.dateValidation as string | null) ?? null,
        validated: (a?.validated as number) ?? 0,
        date_peremption: null,
      });
      saveStore();
      return undefined as T;
    }

    // ── Compétences générales ───────────────────────────────────────────────
    case 'competence_general_get_for_travailleur': {
      const tId = a?.travailleurId as number;
      return Array.from(competencesTravailleurGeneral.values()).filter(ct => ct.travailleur_id === tId) as T;
    }
    case 'competence_general_set': {
      const key = `${a?.travailleurId}_${a?.competenceRefId}`;
      const existing = competencesTravailleurGeneral.get(key);
      competencesTravailleurGeneral.set(key, {
        id: existing?.id ?? newId(),
        travailleur_id: a?.travailleurId as number,
        competence_ref_id: a?.competenceRefId as number,
        date_validation: (a?.dateValidation as string | null) ?? null,
        date_peremption: null,
        validated: (a?.validated as number) ?? 0,
      });
      saveStore();
      return undefined as T;
    }

    // ── Travailleur ↔ Appareil ──────────────────────────────────────────────
    case 'travailleur_appareil_list': {
      const tId = a?.travailleurId as number;
      return Array.from(travailleurAppareils.get(tId) ?? []) as T;
    }
    case 'travailleur_appareil_add': {
      const tId = a?.travailleurId as number;
      const aId = a?.appareilId as number;
      if (!travailleurAppareils.has(tId)) travailleurAppareils.set(tId, new Set());
      travailleurAppareils.get(tId)!.add(aId);
      saveStore();
      return undefined as T;
    }
    case 'travailleur_appareil_remove': {
      const tId = a?.travailleurId as number;
      travailleurAppareils.get(tId)?.delete(a?.appareilId as number);
      saveStore();
      return undefined as T;
    }

    // ── Appareil ↔ Compétence ───────────────────────────────────────────────
    case 'appareil_competence_list': {
      const aId = a?.appareilId as number;
      return Array.from(appareilCompetenceRefs.get(aId) ?? []) as T;
    }
    case 'appareil_competence_add': {
      const aId = a?.appareilId as number;
      const cId = a?.competenceRefId as number;
      if (!appareilCompetenceRefs.has(aId)) appareilCompetenceRefs.set(aId, new Set());
      appareilCompetenceRefs.get(aId)!.add(cId);
      saveStore();
      return undefined as T;
    }
    case 'appareil_competence_remove': {
      const aId = a?.appareilId as number;
      appareilCompetenceRefs.get(aId)?.delete(a?.competenceRefId as number);
      saveStore();
      return undefined as T;
    }

    // ── Vérifications ───────────────────────────────────────────────────────
    case 'verification_list':
      return [...verifications] as T;
    case 'verification_get':
      return (verifications.find(v => v.id === a?.id) ?? null) as T;
    case 'verification_create': {
      const v: VerificationTechnique = {
        id: newId(),
        appareil_id: a?.appareilId as number,
        type_: a?.type as string,
        date_realisation: a?.dateRealisation as string,
        realise_par: (a?.realisePar as string | null) ?? null,
        organisme: (a?.organisme as string | null) ?? null,
        observations: (a?.observations as string | null) ?? null,
        created_at: new Date().toISOString(),
      };
      verifications.push(v);
      saveStore();
      return v.id as T;
    }
    case 'verification_update': {
      const idx = verifications.findIndex(v => v.id === a?.id);
      if (idx >= 0) {
        verifications[idx] = { ...verifications[idx], type_: a?.type as string, date_realisation: a?.dateRealisation as string, realise_par: (a?.realisePar as string | null) ?? null, organisme: (a?.organisme as string | null) ?? null, observations: (a?.observations as string | null) ?? null };
        saveStore();
      }
      return undefined as T;
    }
    case 'verification_delete': {
      const idx = verifications.findIndex(v => v.id === a?.id);
      if (idx >= 0) verifications.splice(idx, 1);
      saveStore();
      return undefined as T;
    }

    // ── Contrôles qualité ───────────────────────────────────────────────────
    case 'controle_qualite_list':
      return [...controles] as T;
    case 'controle_qualite_get':
      return (controles.find(c => c.id === a?.id) ?? null) as T;
    case 'controle_qualite_create': {
      const c: ControleQualite = {
        id: newId(),
        appareil_id: a?.appareilId as number,
        type_: a?.type as string,
        date_realisation: (a?.dateRealisation as string | null) ?? null,
        date_echeance: a?.dateEcheance as string,
        controle_externe_id: (a?.controleExterneId as number | null) ?? null,
        organisme: (a?.organisme as string | null) ?? null,
        realise_par: (a?.realisePar as string | null) ?? null,
        statut: (a?.statut as string) ?? 'effectue',
        observations: (a?.observations as string | null) ?? null,
        created_at: new Date().toISOString(),
      };
      controles.push(c);
      // Mirror SQL trigger trg_generer_cq_internes:
      // When an external CQ is created, auto-generate 3 internal CQs
      // at +3 months (partiel), +6 months (complet), +9 months (partiel)
      if (c.type_ === 'externe') {
        const addMonths = (dateStr: string, months: number): string => {
          const d = new Date(dateStr + 'T00:00:00');
          d.setMonth(d.getMonth() + months);
          return d.toISOString().split('T')[0];
        };
        const base = c.date_echeance;
        const internalTypes: Array<{ type_: string; offset: number }> = [
          { type_: 'partiel_interne', offset: 3 },
          { type_: 'complet_interne', offset: 6 },
          { type_: 'partiel_interne', offset: 9 },
        ];
        for (const { type_, offset } of internalTypes) {
          controles.push({
            id: newId(),
            appareil_id: c.appareil_id,
            type_,
            date_realisation: null,
            date_echeance: addMonths(base, offset),
            controle_externe_id: c.id,
            organisme: null,
            realise_par: null,
            statut: 'planifie',
            observations: null,
            created_at: new Date().toISOString(),
          } as ControleQualite);
        }
      }
      saveStore();
      return c.id as T;
    }
    case 'controle_qualite_update': {
      const idx = controles.findIndex(c => c.id === a?.id);
      if (idx >= 0) {
        controles[idx] = { ...controles[idx], type_: a?.type as string, date_realisation: (a?.dateRealisation as string | null) ?? null, date_echeance: a?.dateEcheance as string, organisme: (a?.organisme as string | null) ?? null, realise_par: (a?.realisePar as string | null) ?? null, statut: (a?.statut as string) ?? 'effectue', observations: (a?.observations as string | null) ?? null };
        saveStore();
      }
      return undefined as T;
    }
    case 'controle_qualite_delete': {
      const idx = controles.findIndex(c => c.id === a?.id);
      if (idx >= 0) controles.splice(idx, 1);
      saveStore();
      return undefined as T;
    }

    // ── Documents ───────────────────────────────────────────────────────────
    case 'document_list':
    case 'document_list_for_entity':
    case 'document_pick_and_upload':
      return [] as T;

    // ── Export / Import ─────────────────────────────────────────────────────
    case 'data_export_encrypted':
      return { code: 'DEV-0000', file_b64: btoa('{}') } as T;
    case 'data_import_encrypted':
      return { travailleurs_added: 0, appareils_added: 0, competences_added: 0, habilitations_added: 0, etablissements_added: 0, verifications_added: 0, controles_added: 0 } as T;

    default:
      console.warn(`[dev-mock] commande non gérée : ${cmd}`, args);
      return null as T;
  }
}
