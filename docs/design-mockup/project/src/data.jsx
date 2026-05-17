// Mock data — French healthcare context, cardiologie interventionnelle.

const TODAY = new Date(2026, 4, 13); // 13 mai 2026 (fixed for stable demo)

function fmt(d) {
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}
function daysBetween(a, b) {
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}
function addMonths(d, m) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
}
function addYears(d, y) {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + y);
  return x;
}
function relDay(d) {
  if (!d) return "";
  const n = daysBetween(d, TODAY);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  if (n === -1) return "hier";
  if (n > 0 && n < 30) return `dans ${n} j`;
  if (n < 0 && n > -30) return `il y a ${-n} j`;
  const months = Math.round(Math.abs(n) / 30);
  if (n > 0) return `dans ${months} mois`;
  return `il y a ${months} mois`;
}

// Status helpers: given an échéance date + a warning window in months
function statusFromDue(dueDate, warnMonths = 3) {
  if (!dueDate) return { key: "unknown", label: "Inconnu", tone: "neutral" };
  const diff = daysBetween(dueDate, TODAY);
  if (diff < 0) return { key: "invalid", label: "Invalide", tone: "danger" };
  if (diff <= warnMonths * 30) return { key: "warn", label: "À prévoir", tone: "warn" };
  return { key: "ok", label: "Valide", tone: "ok" };
}

const COMPETENCES = [
  "Mise sous tension de l'appareil",
  "Mise en marche de l'appareil",
  "Vérification de l'identité patient",
  "Enregistrement du patient",
  "Détection des patients à risque",
  "Réglage du collimateur",
  "Sélection du protocole d'acquisition",
  "Optimisation de la dose patient",
  "Arrêt et mise en veille de l'appareil",
];

const ETABLISSEMENT = {
  denomination: "Centre Cardiologique Saint-Augustin",
  statut: "SAS",
  siret: "78942361500024",
  adresse: "12 avenue du Maréchal Foch",
  cp: "33000",
  ville: "Bordeaux",
  tel: "05 56 79 04 12",
  mail: "contact@cc-saint-augustin.fr",
  site: "www.cc-saint-augustin.fr",
  kbis: { nom: "kbis_cc_saint_augustin_2026.pdf", date: new Date(2026, 0, 18), taille: "248 Ko" },
};

const TRAVAILLEURS = [
  {
    id: "t1",
    nom: "Lemoine", prenom: "Étienne", sexe: "M",
    naissance: new Date(1972, 5, 14), lieuNaissance: "Lyon", paysNaissance: "France",
    fonction: "Cardiologue", debut: new Date(2015, 8, 1),
    categorie: "A", adeli: "330056721",
    mail: "e.lemoine@cc-saint-augustin.fr", tel: "06 14 72 89 03",
    ss: "1 72 06 33 056 721 22",
    dosimPassive: "DP-EL-2024-118", suiviMedical: "SM-04421",
    items: {
      dosimPassive: new Date(2026, 1, 12),
      dosimOperationnelle: new Date(2026, 1, 12),
      formationTravailleurs: new Date(2024, 5, 10), // 3 ans -> ok mid 2027
      formationPatients: new Date(2023, 2, 4),      // 7 ans -> 2030
      visiteMedicale: new Date(2026, 8, 15),        // sept 2026 -> OK
      competences: [true,true,true,true,true,true,true,true,true],
    },
  },
  {
    id: "t2",
    nom: "Bouchard", prenom: "Camille", sexe: "F",
    naissance: new Date(1985, 2, 27), lieuNaissance: "Nantes", paysNaissance: "France",
    fonction: "MERM", debut: new Date(2018, 0, 8),
    categorie: "A", adeli: "440081209",
    mail: "c.bouchard@cc-saint-augustin.fr", tel: "06 87 41 22 16",
    ss: "2 85 03 44 081 209 51",
    dosimPassive: "DP-CB-2024-072", suiviMedical: "SM-04489",
    items: {
      dosimPassive: new Date(2026, 1, 12),
      dosimOperationnelle: new Date(2026, 1, 12),
      formationTravailleurs: new Date(2025, 5, 1),
      formationPatients: new Date(2024, 8, 11),
      visiteMedicale: new Date(2026, 7, 22),
      competences: [true,true,true,true,true,true,true,true,true],
    },
  },
  {
    id: "t3",
    nom: "Naveau", prenom: "Hugo", sexe: "M",
    naissance: new Date(1979, 10, 3), lieuNaissance: "Strasbourg", paysNaissance: "France",
    fonction: "Cardiologue libéral", debut: new Date(2012, 3, 14),
    categorie: "A", adeli: "670014982",
    mail: "h.naveau@cc-saint-augustin.fr", tel: "06 23 18 55 77",
    ss: "1 79 11 67 014 982 09",
    dosimPassive: "DP-HN-2024-031", suiviMedical: "SM-04501",
    items: {
      dosimPassive: new Date(2026, 1, 12),
      dosimOperationnelle: new Date(2026, 1, 12),
      formationTravailleurs: new Date(2023, 1, 8),  // > 3 ans -> invalide
      formationPatients: new Date(2019, 4, 19),     // > 7 ans -> invalide
      visiteMedicale: new Date(2025, 4, 6),
      competences: [true,true,true,true,true,true,false,false,false],
    },
  },
  {
    id: "t4",
    nom: "Aboubakar", prenom: "Nadia", sexe: "F",
    naissance: new Date(1991, 6, 18), lieuNaissance: "Marseille", paysNaissance: "France",
    fonction: "MERM", debut: new Date(2020, 9, 5),
    categorie: "B", adeli: "130043517",
    mail: "n.aboubakar@cc-saint-augustin.fr", tel: "07 64 12 89 41",
    ss: "2 91 07 13 043 517 88",
    dosimPassive: "DP-NA-2024-104", suiviMedical: "SM-04522",
    items: {
      dosimPassive: new Date(2026, 1, 12),
      dosimOperationnelle: new Date(2026, 1, 12),
      formationTravailleurs: new Date(2025, 2, 12),
      formationPatients: new Date(2024, 11, 4),
      visiteMedicale: new Date(2026, 5, 22),       // juin 2026 -> warn (< 2 mois)
      competences: [true,true,true,true,true,false,false,false,false],
    },
  },
  {
    id: "t5",
    nom: "Pereira", prenom: "Mathilde", sexe: "F",
    naissance: new Date(1988, 1, 22), lieuNaissance: "Toulouse", paysNaissance: "France",
    fonction: "Infirmier", debut: new Date(2019, 5, 17),
    categorie: "B", adeli: "310029884",
    mail: "m.pereira@cc-saint-augustin.fr", tel: "06 91 02 38 14",
    ss: "2 88 02 31 029 884 67",
    dosimPassive: "DP-MP-2024-088", suiviMedical: "SM-04531",
    items: {
      dosimPassive: new Date(2026, 1, 12),
      dosimOperationnelle: new Date(2026, 1, 12),
      formationTravailleurs: new Date(2025, 5, 22),
      formationPatients: new Date(2024, 0, 9),
      visiteMedicale: new Date(2026, 5, 30),
      competences: [true,true,true,true,true,true,true,true,true],
    },
  },
  {
    id: "t6",
    nom: "Vallin", prenom: "Antoine", sexe: "M",
    naissance: new Date(1983, 7, 9), lieuNaissance: "Rennes", paysNaissance: "France",
    fonction: "Cardiologue", debut: new Date(2017, 1, 1),
    categorie: "A", adeli: "350071226",
    mail: "a.vallin@cc-saint-augustin.fr", tel: "06 32 87 19 04",
    ss: "1 83 08 35 071 226 12",
    dosimPassive: "DP-AV-2024-045", suiviMedical: "SM-04548",
    items: {
      dosimPassive: new Date(2026, 1, 12),
      dosimOperationnelle: new Date(2026, 1, 12),
      formationTravailleurs: new Date(2025, 3, 8),
      formationPatients: new Date(2023, 10, 25),
      visiteMedicale: new Date(2024, 11, 4), // overdue
      competences: [true,true,true,true,true,true,true,true,true],
    },
  },
  {
    id: "t7",
    nom: "Renard", prenom: "Sophie", sexe: "F",
    naissance: new Date(1976, 0, 6), lieuNaissance: "Reims", paysNaissance: "France",
    fonction: "Infirmier", debut: new Date(2010, 6, 12),
    categorie: "B", adeli: "510052348",
    mail: "s.renard@cc-saint-augustin.fr", tel: "06 18 44 90 71",
    ss: "2 76 01 51 052 348 41",
    dosimPassive: "DP-SR-2024-067", suiviMedical: "SM-04555",
    items: {
      dosimPassive: new Date(2026, 1, 12),
      dosimOperationnelle: new Date(2026, 1, 12),
      formationTravailleurs: new Date(2024, 9, 17),
      formationPatients: new Date(2022, 2, 30),
      visiteMedicale: new Date(2026, 8, 19),
      competences: [true,true,true,true,true,true,true,true,true],
    },
  },
];

function competenceStatus(arr) {
  const n = arr.filter(Boolean).length;
  if (n === 0) return { tone: "neutral", label: "Non commencée", count: 0 };
  if (n === arr.length) return { tone: "ok", label: "Validée", count: n };
  return { tone: "warn", label: "Partielle", count: n };
}

function habilitationStatus(t) {
  const i = t.items;
  const checks = [
    statusFromDue(addYears(i.formationTravailleurs, 3)),
    statusFromDue(addYears(i.formationPatients, 7)),
    statusFromDue(i.visiteMedicale, 2),
    statusFromDue(addYears(i.dosimPassive, 2), 3),
    statusFromDue(addYears(i.dosimOperationnelle, 2), 3),
  ];
  const comp = competenceStatus(i.competences);
  const anyDanger = checks.some(c => c.tone === "danger") || comp.tone === "neutral";
  const anyWarn = checks.some(c => c.tone === "warn") || comp.tone === "warn";
  if (anyDanger) return { key: "non", label: "Non validée", tone: "danger" };
  if (anyWarn) return { key: "partielle", label: "Partielle", tone: "warn" };
  return { key: "validee", label: "Validée", tone: "ok" };
}

const APPAREILS = [
  {
    id: "a1",
    designation: "Salle de cathétérisme — Allura Clarity",
    marque: "Philips", modele: "Allura Xper FD10 Clarity",
    serie: "PH-FD10-9821-A",
    type: "Fixe",
    mise: 2019,
    lieu: "Salle interventionnelle 1",
    partagee: false,
    tension: "125 kV",
    intensite: "1000 mA",
    verifAnnuelle: new Date(2025, 9, 14), // 14 oct 2025, +1y -> 14 oct 2026 -> warn (5 mois) -> not warn
    verifTriennale: new Date(2024, 2, 22), // +3y -> 22 mars 2027 OK
    cqExterne: new Date(2025, 11, 5), // 5 déc 2025
  },
  {
    id: "a2",
    designation: "Salle 2 — Azurion 7 M20",
    marque: "Philips", modele: "Azurion 7 M20",
    serie: "PH-AZ7-4421-M",
    type: "Fixe",
    mise: 2022,
    lieu: "Salle interventionnelle 2",
    partagee: false,
    tension: "125 kV",
    intensite: "1000 mA",
    verifAnnuelle: new Date(2025, 7, 3), // -> +1y aug 2026 OK
    verifTriennale: new Date(2023, 5, 18),
    cqExterne: new Date(2025, 8, 12),
  },
  {
    id: "a3",
    designation: "Arceau mobile — OEC Elite",
    marque: "GE Healthcare", modele: "OEC Elite CFD",
    serie: "GE-OEC-7712-CFD",
    type: "Déplaçable",
    mise: 2021,
    lieu: "Bloc — variable",
    partagee: true,
    tension: "120 kV",
    intensite: "180 mA",
    verifAnnuelle: new Date(2025, 4, 28), // +1y -> 28 mai 2026 -> dans <1 mois -> warn
    verifTriennale: new Date(2023, 4, 28),
    cqExterne: new Date(2025, 10, 3),
  },
  {
    id: "a4",
    designation: "Salle 3 — Innova IGS 530",
    marque: "GE Healthcare", modele: "Innova IGS 530",
    serie: "GE-IGS-3309-530",
    type: "Fixe",
    mise: 2017,
    lieu: "Salle interventionnelle 3",
    partagee: false,
    tension: "125 kV",
    intensite: "1000 mA",
    verifAnnuelle: new Date(2024, 11, 9), // +1y -> 9 déc 2025 -> overdue -> invalid
    verifTriennale: new Date(2022, 1, 14), // +3y -> feb 2025 invalid
    cqExterne: new Date(2024, 9, 30),
  },
  {
    id: "a5",
    designation: "Arceau mobile — Cios Alpha",
    marque: "Siemens Healthineers", modele: "Cios Alpha",
    serie: "SH-CIA-8801-AL",
    type: "Déplaçable",
    mise: 2023,
    lieu: "Soins intensifs",
    partagee: true,
    tension: "110 kV",
    intensite: "150 mA",
    verifAnnuelle: new Date(2025, 11, 18),
    verifTriennale: new Date(2024, 5, 6),
    cqExterne: new Date(2026, 1, 27),
  },
];

// Compute appareil control dates from cqExterne
function appareilDerived(a) {
  const partial3 = addMonths(a.cqExterne, 3);
  const complet6 = addMonths(a.cqExterne, 6);
  const partial9 = addMonths(a.cqExterne, 9);
  const verifAnnuelleDue = addYears(a.verifAnnuelle, 1);
  const verifTriennaleDue = addYears(a.verifTriennale, 3);

  // statut tableau = plus contraignant
  const sVerifAnn = statusFromDue(verifAnnuelleDue, 3);
  const sVerifTri = statusFromDue(verifTriennaleDue, 3);
  const sVerif = pickWorst(sVerifAnn, sVerifTri);

  const sP3 = statusFromDue(partial3, 1);
  const sC6 = statusFromDue(complet6, 3);
  const sP9 = statusFromDue(partial9, 1);
  const sCQ = pickWorst(sP3, sC6, sP9);

  return {
    partial3, complet6, partial9, verifAnnuelleDue, verifTriennaleDue,
    sVerifAnn, sVerifTri, sVerif, sP3, sC6, sP9, sCQ,
    statutGlobal: pickWorst(sVerif, sCQ),
  };
}

function pickWorst(...s) {
  const order = { invalid: 0, warn: 1, ok: 2, unknown: 3 };
  return s.slice().sort((a,b) => order[a.key] - order[b.key])[0];
}

function buildActions() {
  const out = [];
  // From workers
  TRAVAILLEURS.forEach(t => {
    const i = t.items;
    const formTrav = addYears(i.formationTravailleurs, 3);
    const s1 = statusFromDue(formTrav);
    if (s1.key !== "ok") out.push({
      type: "Formation", category: "formation",
      sujet: `${t.prenom} ${t.nom}`, detail: "Formation radioprotection travailleurs",
      due: formTrav, status: s1,
      ref: { kind: "travailleur", id: t.id },
    });
    const formPat = addYears(i.formationPatients, 7);
    const s2 = statusFromDue(formPat);
    if (s2.key !== "ok") out.push({
      type: "Formation", category: "formation",
      sujet: `${t.prenom} ${t.nom}`, detail: "Formation radioprotection patients",
      due: formPat, status: s2,
      ref: { kind: "travailleur", id: t.id },
    });
    const vm = i.visiteMedicale; // due is the date itself (next VM)
    const sVM = statusFromDue(vm, 2);
    if (sVM.key !== "ok") out.push({
      type: "Visite médicale", category: "visite",
      sujet: `${t.prenom} ${t.nom}`, detail: "Renouvellement visite médicale",
      due: vm, status: sVM,
      ref: { kind: "travailleur", id: t.id },
    });
  });

  APPAREILS.forEach(a => {
    const d = appareilDerived(a);
    if (d.sVerifAnn.key !== "ok") out.push({
      type: "Contrôle", category: "controle",
      sujet: a.designation, detail: "Vérification annuelle interne",
      due: d.verifAnnuelleDue, status: d.sVerifAnn,
      ref: { kind: "appareil", id: a.id },
    });
    if (d.sVerifTri.key !== "ok") out.push({
      type: "Contrôle", category: "controle",
      sujet: a.designation, detail: "Vérification triennale externe",
      due: d.verifTriennaleDue, status: d.sVerifTri,
      ref: { kind: "appareil", id: a.id },
    });
    if (d.sP3.key !== "ok") out.push({
      type: "Contrôle", category: "controle",
      sujet: a.designation, detail: "Contrôle qualité partiel interne (3 mois)",
      due: d.partial3, status: d.sP3,
      ref: { kind: "appareil", id: a.id },
    });
    if (d.sC6.key !== "ok") out.push({
      type: "Contrôle", category: "controle",
      sujet: a.designation, detail: "Contrôle qualité complet interne (6 mois)",
      due: d.complet6, status: d.sC6,
      ref: { kind: "appareil", id: a.id },
    });
    if (d.sP9.key !== "ok") out.push({
      type: "Contrôle", category: "controle",
      sujet: a.designation, detail: "Contrôle qualité partiel interne (9 mois)",
      due: d.partial9, status: d.sP9,
      ref: { kind: "appareil", id: a.id },
    });
  });

  // Sort: invalid first (most overdue), then warn (closest to due)
  out.sort((a, b) => {
    const order = { invalid: 0, warn: 1, ok: 2 };
    if (order[a.status.key] !== order[b.status.key]) return order[a.status.key] - order[b.status.key];
    return a.due - b.due;
  });
  return out;
}

Object.assign(window, {
  TODAY, fmt, daysBetween, addMonths, addYears, relDay,
  statusFromDue, pickWorst,
  COMPETENCES,
  ETABLISSEMENT, TRAVAILLEURS, APPAREILS,
  competenceStatus, habilitationStatus, appareilDerived,
  buildActions,
});
