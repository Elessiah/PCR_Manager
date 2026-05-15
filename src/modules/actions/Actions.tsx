import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { statusFromDate, statusToBadgeVariant } from '../../lib/status';
import type { Appareil, VerificationTechnique, ControleQualite } from '../../types/domain';
import { PillFilter } from '../../components/ui/PillFilter';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Dot } from '../../components/ui/Dot';

type FilterValue = 'tout' | 'en_retard' | 'a_venir' | 'formation' | 'controle' | 'visite_med';
type ActionCategory = 'verification' | 'controle';

interface Action {
  id: string;
  categorie: ActionCategory;
  libelle: string;
  deadline: string | null;
  cible: {
    type: 'appareil';
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
    queryKey: ['controleQualites'],
    queryFn: () => api.controleQualite.list(),
  });

  const buildActions = (): Action[] => {
    const actions: Action[] = [];
    const appareilMap = new Map(appareils.map(a => [a.id, a]));

    // Vérifications techniques: date_realisation + période = deadline
    verifications.forEach((v) => {
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

    // Contrôles qualité: utiliser date_echeance directement
    controleQualites.forEach((cq) => {
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

    return actions;
  };

  const allActions = buildActions();

  const filteredActions = allActions.filter((action) => {
    if (filter === 'tout') return true;

    const status = statusFromDate(action.deadline);
    if (filter === 'en_retard') return status === 'en_retard';
    if (filter === 'a_venir') return status === 'a_prevoir';
    if (filter === 'controle') return action.categorie === 'controle';

    // Catégories non disponibles (données manquantes)
    if (filter === 'formation') return false;
    if (filter === 'visite_med') return false;

    return true;
  });

  // Tri: en_retard d'abord, puis par deadline croissant
  filteredActions.sort((a, b) => {
    const statusA = statusFromDate(a.deadline);
    const statusB = statusFromDate(b.deadline);

    const statusOrder: Record<string, number> = {
      en_retard: 0,
      a_prevoir: 1,
      valide: 2,
      non_applicable: 3,
    };

    const orderDiff = (statusOrder[statusA] ?? 99) - (statusOrder[statusB] ?? 99);
    if (orderDiff !== 0) return orderDiff;

    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }

    return 0;
  });

  const filterOptions: Array<{ value: FilterValue; label: string }> = [
    { value: 'tout', label: 'Tout' },
    { value: 'en_retard', label: 'En retard' },
    { value: 'a_venir', label: 'À venir' },
    { value: 'formation', label: 'Formation' },
    { value: 'controle', label: 'Contrôle' },
    { value: 'visite_med', label: 'Visite méd.' },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Actions</h1>
        <p className="text-sm text-textMuted mt-1">Toutes les échéances réglementaires à effectuer</p>
      </div>

      <PillFilter options={filterOptions} value={filter} onChange={(v) => setFilter(v as FilterValue)} />

      <div className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH style={{ width: '24px' }}></TH>
              <TH>Catégorie</TH>
              <TH>Libellé</TH>
              <TH>Cible</TH>
              <TH>Échéance</TH>
              <TH style={{ textAlign: 'right', width: '120px' }}>Statut</TH>
              <TH style={{ width: '24px' }}></TH>
            </TR>
          </THead>
          <TBody>
            {filteredActions.length === 0 ? (
              <TR>
                <TD colSpan={7} className="text-center py-8">
                  <div className="text-textMuted text-sm">Aucune action.</div>
                </TD>
              </TR>
            ) : (
              filteredActions.map((action) => {
                const status = statusFromDate(action.deadline);
                const variant = statusToBadgeVariant[status];
                const statusLabel: Record<string, string> = {
                  valide: 'Valide',
                  a_prevoir: 'À prévoir',
                  en_retard: 'En retard',
                  non_applicable: 'N/A',
                };

                const deadlineDate = action.deadline ? new Date(action.deadline) : null;
                const today = new Date();
                const daysUntil = deadlineDate ? Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;

                let relativeDate = '';
                if (daysUntil !== null) {
                  if (daysUntil === 0) relativeDate = "aujourd'hui";
                  else if (daysUntil === 1) relativeDate = 'demain';
                  else if (daysUntil === -1) relativeDate = 'hier';
                  else if (daysUntil > 0 && daysUntil < 30) relativeDate = `dans ${daysUntil} j`;
                  else if (daysUntil < 0 && daysUntil > -30) relativeDate = `il y a ${-daysUntil} j`;
                  else if (daysUntil > 0) relativeDate = `dans ${Math.round(daysUntil / 30)} mois`;
                  else relativeDate = `il y a ${Math.round(-daysUntil / 30)} mois`;
                }

                return (
                  <TR
                    key={action.id}
                    onClick={() =>
                      navigate(`/appareils/${action.cible.id}`)
                    }
                    className="cursor-pointer"
                  >
                    <TD>
                      <Dot variant={variant} />
                    </TD>
                    <TD className="text-sm font-medium capitalize">
                      {action.categorie === 'verification' ? 'Vérification' : 'Contrôle'}
                    </TD>
                    <TD className="text-sm">{action.libelle}</TD>
                    <TD className="text-sm text-textMuted">{action.cible.label}</TD>
                    <TD className="text-sm">
                      <div className="font-mono text-xs">
                        {action.deadline ? new Date(action.deadline).toLocaleDateString('fr-FR') : '—'}
                      </div>
                      {relativeDate && <div className="text-xs text-textMuted mt-0.5">{relativeDate}</div>}
                    </TD>
                    <TD style={{ textAlign: 'right' }}>
                      <Badge variant={variant}>{statusLabel[status]}</Badge>
                    </TD>
                    <TD>→</TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
