import { useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import { statusFromDate, statusToBadgeVariant } from '../../lib/status';
import type { Habilitation, HabilitationStatus } from '../../types/domain';
import { PageHead } from '../../components/ui/PageHead';
import { Card } from '../../components/ui/Card';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Dot } from '../../components/ui/Dot';

type FilterValue = 'tout' | 'en_retard' | 'a_venir' | 'non_renseigne' | 'formation' | 'controle' | 'visite_med' | 'dosimetrie' | 'competence';
type ActionCategory = 'verification' | 'controle' | 'formation' | 'visite_med' | 'dosimetrie' | 'competence';

interface Action {
  id: string;
  categorie: ActionCategory;
  libelle: string;
  deadline: string | null;
  cible: {
    type: 'appareil' | 'travailleur';
    id: number;
    label: string;
  };
}

export default function Actions() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterValue>('tout');

  const { data: appareils = [] } = useQuery({
    queryKey: ['appareils'],
    queryFn: () => api.appareil.list(),
  });

  const { data: verifications = [] } = useQuery({
    queryKey: ['verifications'],
    queryFn: () => api.verification.list(),
  });

  const { data: controleQualites = [] } = useQuery({
    queryKey: ['controles'],
    queryFn: () => api.controleQualite.list(),
  });

  const { data: travailleurs = [] } = useQuery({
    queryKey: ['travailleurs'],
    queryFn: () => api.travailleur.list(),
  });

  const habilitationQueries = useQueries({
    queries: travailleurs.map((t) => ({
      queryKey: ['habilitation', 'raw', t.id],
      queryFn: () => api.habilitation.getForTravailleur(t.id),
    })),
  });

  const habilitations = new Map<number, Habilitation>();
  habilitationQueries.forEach((q, idx) => {
    if (q.data && travailleurs[idx]) {
      habilitations.set(travailleurs[idx].id, q.data);
    }
  });

  // Statut calculé par le backend (inclut competences_ok) — même cache que TravailleursList
  const habStatusQueries = useQueries({
    queries: travailleurs.map((t) => ({
      queryKey: ['habilitation', t.id],
      queryFn: () => api.habilitation.compute(t.id),
    })),
  });

  const habStatuses = new Map<number, HabilitationStatus>();
  habStatusQueries.forEach((q, idx) => {
    if (q.data && travailleurs[idx]) {
      habStatuses.set(travailleurs[idx].id, q.data as HabilitationStatus);
    }
  });

  const buildActions = (): Action[] => {
    const actions: Action[] = [];
    const appareilMap = new Map(appareils.map(a => [a.id, a]));

    // Vérifications techniques: seulement la plus récente par (appareil, type)
    const latestVerifMap = new Map<string, typeof verifications[0]>();
    verifications.forEach((v) => {
      const key = `${v.appareil_id}:${v.type_}`;
      const existing = latestVerifMap.get(key);
      if (!existing || new Date(v.date_realisation) > new Date(existing.date_realisation)) {
        latestVerifMap.set(key, v);
      }
    });

    latestVerifMap.forEach((v) => {
      const appareil = appareilMap.get(v.appareil_id);
      if (!appareil) return;

      const realisationDate = new Date(v.date_realisation);
      let deadline: Date;

      if (v.type_ === 'annuelle_interne') {
        deadline = new Date(realisationDate);
        deadline.setFullYear(deadline.getFullYear() + 1);
      } else if (v.type_ === 'triennale_externe') {
        deadline = new Date(realisationDate);
        deadline.setFullYear(deadline.getFullYear() + 3);
      } else {
        return;
      }

      actions.push({
        id: `verif-${v.id}`,
        categorie: 'verification',
        libelle: `Vérification ${v.type_ === 'annuelle_interne' ? 'annuelle' : 'triennale'}`,
        deadline: deadline.toISOString().split('T')[0],
        cible: {
          type: 'appareil',
          id: v.appareil_id,
          label: appareil.designation,
        },
      });
    });

    // Non renseigné : appareils sans vérification annuelle ou triennale enregistrée
    appareils.forEach((appareil) => {
      const cibleAppareil = { type: 'appareil' as const, id: appareil.id, label: appareil.designation };
      if (!latestVerifMap.has(`${appareil.id}:annuelle_interne`)) {
        actions.push({
          id: `verif_annuelle_nr-${appareil.id}`,
          categorie: 'verification',
          libelle: 'Vérification annuelle',
          deadline: null,
          cible: cibleAppareil,
        });
      }
      if (!latestVerifMap.has(`${appareil.id}:triennale_externe`)) {
        actions.push({
          id: `verif_triennale_nr-${appareil.id}`,
          categorie: 'verification',
          libelle: 'Vérification triennale',
          deadline: null,
          cible: cibleAppareil,
        });
      }
    });

    // Contrôles qualité: utiliser date_echeance directement (ignorer les CQ déjà réalisés)
    controleQualites.forEach((cq) => {
      if (cq.statut === 'realise') return;
      const appareil = appareilMap.get(cq.appareil_id);
      if (!appareil) return;

      let libelle = 'Contrôle qualité';
      if (cq.type_ === 'externe') {
        libelle = 'Contrôle qualité externe';
      } else if (cq.type_ === 'partiel_interne') {
        libelle = 'Contrôle qualité partiel interne';
      } else if (cq.type_ === 'complet_interne') {
        libelle = 'Contrôle qualité complet interne';
      }

      actions.push({
        id: `cq-${cq.id}`,
        categorie: 'controle',
        libelle,
        deadline: cq.date_echeance,
        cible: {
          type: 'appareil',
          id: cq.appareil_id,
          label: appareil.designation,
        },
      });
    });

    // Actions Formation et Visite médicale à partir des habilitations
    travailleurs.forEach((travailleur) => {
      const hab = habilitations.get(travailleur.id);
      if (!hab) return;

      const cibleTravailleur = {
        type: 'travailleur' as const,
        id: travailleur.id,
        label: `${travailleur.prenom} ${travailleur.nom}`,
      };

      // Dosimétrie passive: validité 2 ans
      if (hab.dosimetrie_passive_date) {
        const d = new Date(hab.dosimetrie_passive_date);
        d.setFullYear(d.getFullYear() + 2);
        actions.push({ id: `dosimetrie_passive-${travailleur.id}`, categorie: 'dosimetrie', libelle: 'Dosimétrie passive', deadline: d.toISOString().split('T')[0], cible: cibleTravailleur });
      } else {
        actions.push({ id: `dosimetrie_passive-${travailleur.id}`, categorie: 'dosimetrie', libelle: 'Dosimétrie passive', deadline: null, cible: cibleTravailleur });
      }

      // Dosimétrie opérationnelle: validité 2 ans
      if (hab.dosimetrie_operationnelle_date) {
        const d = new Date(hab.dosimetrie_operationnelle_date);
        d.setFullYear(d.getFullYear() + 2);
        actions.push({ id: `dosimetrie_op-${travailleur.id}`, categorie: 'dosimetrie', libelle: 'Dosimétrie opérationnelle', deadline: d.toISOString().split('T')[0], cible: cibleTravailleur });
      } else {
        actions.push({ id: `dosimetrie_op-${travailleur.id}`, categorie: 'dosimetrie', libelle: 'Dosimétrie opérationnelle', deadline: null, cible: cibleTravailleur });
      }

      // Formation RP travailleurs: validité 3 ans (CDC §5)
      if (hab.formation_rp_travailleurs_date) {
        const d = new Date(hab.formation_rp_travailleurs_date);
        d.setFullYear(d.getFullYear() + 3);
        actions.push({ id: `formation-${travailleur.id}`, categorie: 'formation', libelle: 'Formation radioprotection travailleurs', deadline: d.toISOString().split('T')[0], cible: cibleTravailleur });
      } else {
        actions.push({ id: `formation-${travailleur.id}`, categorie: 'formation', libelle: 'Formation radioprotection travailleurs', deadline: null, cible: cibleTravailleur });
      }

      // Formation RP patients: validité 7 ans
      if (hab.formation_rp_patients_date) {
        const d = new Date(hab.formation_rp_patients_date);
        d.setFullYear(d.getFullYear() + 7);
        actions.push({ id: `formation_patients-${travailleur.id}`, categorie: 'formation', libelle: 'Formation radioprotection patients', deadline: d.toISOString().split('T')[0], cible: cibleTravailleur });
      } else {
        actions.push({ id: `formation_patients-${travailleur.id}`, categorie: 'formation', libelle: 'Formation radioprotection patients', deadline: null, cible: cibleTravailleur });
      }

      // Visite médicale: date_peremption explicite > durée en mois > +1 an par défaut
      if (hab.visite_medicale_date_peremption) {
        actions.push({ id: `visite_med-${travailleur.id}`, categorie: 'visite_med', libelle: 'Visite médicale', deadline: hab.visite_medicale_date_peremption, cible: cibleTravailleur });
      } else if (hab.visite_medicale_date) {
        const d = new Date(hab.visite_medicale_date);
        if (hab.visite_medicale_duree_mois) d.setMonth(d.getMonth() + hab.visite_medicale_duree_mois);
        else d.setFullYear(d.getFullYear() + 1);
        actions.push({ id: `visite_med-${travailleur.id}`, categorie: 'visite_med', libelle: 'Visite médicale', deadline: d.toISOString().split('T')[0], cible: cibleTravailleur });
      } else {
        actions.push({ id: `visite_med-${travailleur.id}`, categorie: 'visite_med', libelle: 'Visite médicale', deadline: null, cible: cibleTravailleur });
      }
    });

    // Compétences non validées : une action par travailleur concerné
    travailleurs.forEach((travailleur) => {
      const status = habStatuses.get(travailleur.id);
      if (status?.details?.competences_ok === false) {
        actions.push({
          id: `competences-${travailleur.id}`,
          categorie: 'competence',
          libelle: 'Compétences non validées',
          deadline: null,
          cible: {
            type: 'travailleur',
            id: travailleur.id,
            label: `${travailleur.prenom} ${travailleur.nom}`,
          },
        });
      }
    });

    return actions;
  };

  const allActions = buildActions().filter((a) => {
    const s = statusFromDate(a.deadline, 3);
    return s === 'en_retard' || s === 'a_prevoir' || s === 'non_applicable';
  });

  const countByStatus = (status: string): number => {
    return allActions.filter(a => statusFromDate(a.deadline, 3) === status).length;
  };

  const countByCategorie = (categorie: ActionCategory): number => {
    return allActions.filter(a => a.categorie === categorie).length;
  };

  const countNonRenseigne = (): number => {
    return allActions.filter(a => statusFromDate(a.deadline, 3) === 'non_applicable').length;
  };

  const typeLabel = (categorie: ActionCategory): string => {
    const labels: Record<ActionCategory, string> = {
      verification: 'Vérification',
      controle: 'Contrôle',
      formation: 'Formation',
      visite_med: 'Visite médicale',
      dosimetrie: 'Dosimétrie',
      competence: 'Compétence',
    };
    return labels[categorie];
  };

  const statusLabel = (deadline: string | null): string => {
    const status = statusFromDate(deadline, 3);
    const labels: Record<string, string> = {
      en_retard: 'En retard',
      a_prevoir: 'À prévoir',
      valide: 'À jour',
      non_applicable: 'Non renseigné',
    };
    return labels[status] || 'Non renseigné';
  };

  const formatDate = (deadline: string | null): string => {
    if (!deadline) return '—';
    const date = new Date(deadline);
    return date.toLocaleDateString('fr-FR');
  };

  const relDay = (deadline: string | null): string => {
    if (!deadline) return '';
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const daysUntil = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil === 0) return "aujourd'hui";
    if (daysUntil === 1) return 'demain';
    if (daysUntil === -1) return 'hier';
    if (daysUntil > 0 && daysUntil < 30) return `dans ${daysUntil} j`;
    if (daysUntil < 0 && daysUntil > -30) return `il y a ${-daysUntil} j`;
    if (daysUntil > 0) return `dans ${Math.round(daysUntil / 30)} mois`;
    return `il y a ${Math.round(-daysUntil / 30)} mois`;
  };

  const filters = [
    { value: 'tout' as FilterValue, label: 'Tout', count: allActions.length },
    { value: 'en_retard' as FilterValue, label: 'En retard', count: countByStatus('en_retard') },
    { value: 'a_venir' as FilterValue, label: 'À venir', count: countByStatus('a_prevoir') },
    { value: 'non_renseigne' as FilterValue, label: 'Non renseigné', count: countNonRenseigne() },
    { value: 'formation' as FilterValue, label: 'Formation', count: countByCategorie('formation') },
    { value: 'controle' as FilterValue, label: 'Contrôle', count: countByCategorie('controle') },
    { value: 'visite_med' as FilterValue, label: 'Visite méd.', count: countByCategorie('visite_med') },
    { value: 'dosimetrie' as FilterValue, label: 'Dosimétrie', count: countByCategorie('dosimetrie') },
    { value: 'competence' as FilterValue, label: 'Compétences', count: countByCategorie('competence') },
  ];

  const filtered = allActions.filter((action) => {
    if (filter === 'tout') return true;

    const status = statusFromDate(action.deadline, 3);
    if (filter === 'en_retard') return status === 'en_retard';
    if (filter === 'a_venir') return status === 'a_prevoir';
    if (filter === 'non_renseigne') return status === 'non_applicable';
    if (filter === 'controle') return action.categorie === 'controle';
    if (filter === 'formation') return action.categorie === 'formation';
    if (filter === 'visite_med') return action.categorie === 'visite_med';
    if (filter === 'dosimetrie') return action.categorie === 'dosimetrie';
    if (filter === 'competence') return action.categorie === 'competence';

    return true;
  });

  // Tri :
  // 1. En retard → À prévoir
  // 2. Dans "En retard" : deadline croissante (la plus en retard d'abord)
  // 3. Dans "À prévoir" : deadline croissante (la plus proche d'abord)
  // 4. Égalité de deadline : ordre alphabétique par label
  filtered.sort((a, b) => {
    const statusA = statusFromDate(a.deadline, 3);
    const statusB = statusFromDate(b.deadline, 3);

    const statusOrder: Record<string, number> = {
      en_retard: 0,
      a_prevoir: 1,
      valide: 2,
      non_applicable: 3,
    };

    const orderDiff = (statusOrder[statusA] ?? 99) - (statusOrder[statusB] ?? 99);
    if (orderDiff !== 0) return orderDiff;

    // Même statut : deadline croissante (plus ancienne = plus urgente d'abord)
    const deadlineA = a.deadline ?? '9999-99-99';
    const deadlineB = b.deadline ?? '9999-99-99';
    if (deadlineA !== deadlineB) return deadlineA.localeCompare(deadlineB);

    // Égalité de deadline : ordre alphabétique par label
    return a.cible.label.localeCompare(b.cible.label, 'fr');
  });

  const targetUrl = (action: Action): string => {
    if (action.cible.type === 'appareil') {
      return `/appareils/${action.cible.id}`;
    }
    return `/travailleurs/${action.cible.id}?tab=hab`;
  };

  return (
    <div className="space-y-4 p-6">
      <PageHead
        title="Actions"
        sub="Toutes les échéances réglementaires à effectuer"
      />

      <div className="inline-flex bg-surface2 border border-border rounded p-[3px] gap-[2px]">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`border-0 px-[11px] py-[5px] font-semibold text-[12.5px] rounded-sm ${
              filter === f.value ? 'bg-surface text-text shadow-sm' : 'bg-transparent text-textMuted'
            }`}
          >
            {f.label} <span className="font-mono text-[11.5px] opacity-60 ml-1.5">{f.count}</span>
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH className="w-9" />
              <TH>Sujet</TH>
              <TH>Action</TH>
              <TH>Type</TH>
              <TH>Échéance</TH>
              <TH className="text-right">Statut</TH>
              <TH className="w-12" />
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <TR>
                <TD colSpan={7} className="text-center text-textSoft py-10">
                  Aucune action
                </TD>
              </TR>
            ) : (
              filtered.map((action) => {
                const status = statusFromDate(action.deadline, 3);
                const statusVariant = statusToBadgeVariant[status];
                return (
                  <TR
                    key={action.id}
                    className="cursor-pointer"
                    onClick={() => navigate(targetUrl(action))}
                  >
                    <TD>
                      <Dot variant={statusVariant} />
                    </TD>
                    <TD className="font-semibold">{action.cible.label}</TD>
                    <TD className="text-textMuted">{action.libelle}</TD>
                    <TD>
                      <Badge variant="neutral" icon={null}>
                        {typeLabel(action.categorie)}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="font-mono tabular-nums text-[12.5px]">{formatDate(action.deadline)}</div>
                      <div className="text-textSoft text-[11.5px] mt-px">{relDay(action.deadline)}</div>
                    </TD>
                    <TD className="text-right">
                      <Badge variant={statusVariant}>{statusLabel(action.deadline)}</Badge>
                    </TD>
                    <TD className="text-right">
                      <ChevronRight size={14} className="text-textSoft" />
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
