import React, { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { KpiTile } from '../../components/ui/KpiTile';
import { Card, CardBody, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';
import { api } from '../../lib/api';
import { statusFromDate, statusToBadgeVariant } from '../../lib/status';
import type { Appareil, VerificationTechnique, ControleQualite, HabilitationStatus } from '../../types/domain';
import { AlertCircle, CheckCircle, Clock, Zap, FileCheck } from 'lucide-react';

interface Action {
  id: string;
  categorie: 'verification' | 'controle';
  libelle: string;
  deadline: string | null;
  cible: {
    type: 'appareil';
    id: number;
    label: string;
  };
}

export default function Dashboard() {
  const { data: travailleurs = [], isLoading: loadingTrav } = useQuery({
    queryKey: ['travailleurs'],
    queryFn: () => api.travailleur.list(),
  });

  const { data: appareils = [], isLoading: loadingApp } = useQuery({
    queryKey: ['appareils'],
    queryFn: () => api.appareil.list(),
  });

  const { data: verifications = [], isLoading: loadingVerif } = useQuery({
    queryKey: ['verifications'],
    queryFn: () => api.verification.list(),
  });

  const { data: controles = [], isLoading: loadingControle } = useQuery({
    queryKey: ['controles'],
    queryFn: () => api.controleQualite.list(),
  });

  const habilitationQueries = useQueries({
    queries: travailleurs.map(t => ({
      queryKey: ['habilitation', t.id],
      queryFn: () => api.habilitation.compute(t.id),
    })),
  });

  const isLoading = loadingTrav || loadingApp || loadingVerif || loadingControle || habilitationQueries.some(q => q.isPending);

  const habitationsData = useMemo(() => {
    return habilitationQueries.map((q, idx) => ({
      travailleurId: travailleurs[idx]?.id,
      status: (q.data ?? {
        statut: 'non_validee',
        details: {
          formation_rp_ok: false,
          dosimetries_ok: false,
          competences_ok: false,
          visite_med_ok: false,
        },
      }) as HabilitationStatus,
    }));
  }, [habilitationQueries, travailleurs]);

  const actions = useMemo(() => {
    const actionsList: Action[] = [];
    const appareilMap = new Map(appareils.map(a => [a.id, a]));

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

      actionsList.push({
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

    controles.forEach((cq) => {
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

      actionsList.push({
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

    return actionsList.sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    });
  }, [appareils, verifications, controles]);

  const alertCategories = useMemo(() => {
    const verifications = actions.filter(a => a.categorie === 'verification');
    const controles = actions.filter(a => a.categorie === 'controle');

    const countByStatus = (items: Action[]) => {
      const danger = items.filter(a => statusFromDate(a.deadline, 1) === 'en_retard').length;
      const warn = items.filter(a => statusFromDate(a.deadline, 3) === 'a_prevoir').length;
      const ok = items.filter(a => statusFromDate(a.deadline, 3) === 'valide').length;
      return { danger, warn, ok };
    };

    return {
      formations: { danger: 0, warn: 0, ok: 0 },
      visites: { danger: 0, warn: 0, ok: 0 },
      verifications: countByStatus(verifications),
      controles: countByStatus(controles),
      dosimetrie: { danger: 0, warn: 0, ok: 0 },
    };
  }, [actions]);

  const habilitationsStats = useMemo(() => {
    const stats = { validee: 0, partielle: 0, non_validee: 0 };
    habitationsData.forEach(h => {
      const status = h.status.statut;
      if (status === 'validee') stats.validee++;
      else if (status === 'partielle') stats.partielle++;
      else stats.non_validee++;
    });
    return stats;
  }, [habitationsData]);

  const appareilsStats = useMemo(() => {
    const stats = { valide: 0, a_prevoir: 0, en_retard: 0 };
    const controlesByAppareil = new Map<number, ControleQualite[]>();

    controles.forEach(cq => {
      if (!controlesByAppareil.has(cq.appareil_id)) {
        controlesByAppareil.set(cq.appareil_id, []);
      }
      controlesByAppareil.get(cq.appareil_id)!.push(cq);
    });

    appareils.forEach(app => {
      const appControles = controlesByAppareil.get(app.id) || [];
      if (appControles.length === 0) {
        stats.en_retard++;
        return;
      }

      const latest = appControles.sort((a, b) =>
        new Date(b.date_echeance).getTime() - new Date(a.date_echeance).getTime()
      )[0];

      const status = statusFromDate(latest.date_echeance, 3);
      if (status === 'valide') stats.valide++;
      else if (status === 'a_prevoir') stats.a_prevoir++;
      else stats.en_retard++;
    });

    return stats;
  }, [appareils, controles]);

  const kpiInRetard = useMemo(() => {
    return actions.filter(a => statusFromDate(a.deadline, 1) === 'en_retard').length;
  }, [actions]);

  const kpiAPrevoir = useMemo(() => {
    return actions.filter(a => statusFromDate(a.deadline, 3) === 'a_prevoir').length;
  }, [actions]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
  };

  const relDay = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `il y a ${-diff} jours`;
    if (diff === 0) return 'aujourd\'hui';
    return `dans ${diff} jours`;
  };

  if (isLoading) {
    return <div className="text-textMuted text-sm">Chargement des données...</div>;
  }

  const topActions = actions.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        <KpiTile
          label="En retard"
          value={kpiInRetard}
          footer="Actions invalides/dépassées"
        />
        <KpiTile
          label="À prévoir"
          value={kpiAPrevoir}
          footer="Échéances < 90 jours"
        />
        <KpiTile
          label="À jour"
          value={`${travailleurs.length}/${travailleurs.length}`}
          footer="Travailleurs"
        />
      </div>

      {/* 2-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem' }}>
        {/* Left Column: Prioritary Deadlines */}
        <Card>
          <CardTitle className="mb-4">Échéances prioritaires</CardTitle>
          <CardBody className="p-0">
            {topActions.length === 0 ? (
              <p className="text-textMuted text-sm p-4">Aucune action.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Sujet</TH>
                    <TH>Type</TH>
                    <TH>Échéance</TH>
                    <TH>Statut</TH>
                  </TR>
                </THead>
                <TBody>
                  {topActions.map(action => {
                    const status = statusFromDate(action.deadline, 1);
                    return (
                      <TR key={action.id}>
                        <TD>{action.cible.label}</TD>
                        <TD>
                          <Badge variant="neutral">
                            {action.categorie === 'verification' ? 'Vérification' : 'Contrôle'}
                          </Badge>
                        </TD>
                        <TD>
                          <div className="text-sm">
                            {formatDate(action.deadline)}
                            <div className="text-xs text-textMuted">{relDay(action.deadline)}</div>
                          </div>
                        </TD>
                        <TD>
                          <Badge variant={statusToBadgeVariant[status]}>
                            {status === 'en_retard' ? 'En retard' : status === 'a_prevoir' ? 'À prévoir' : 'À jour'}
                          </Badge>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>

        {/* Right Column: 3 stacked cards */}
        <div className="space-y-4">
          {/* Sources des alertes */}
          <Card>
            <CardTitle className="mb-4 px-5 pt-4">Sources des alertes</CardTitle>
            <CardBody className="space-y-3">
              {[
                { label: 'Formations', icon: FileCheck, ...alertCategories.formations },
                { label: 'Visites médicales', icon: CheckCircle, ...alertCategories.visites },
                { label: 'Vérifications', icon: AlertCircle, ...alertCategories.verifications },
                { label: 'Contrôles qualité', icon: Clock, ...alertCategories.controles },
                { label: 'Dosimétrie', icon: Zap, ...alertCategories.dosimetrie },
              ].map((cat, idx) => {
                const IconComponent = cat.icon;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <IconComponent size={30} className="text-textMuted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-text">{cat.label}</div>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Badge variant="danger">{cat.danger}</Badge>
                        <Badge variant="warn">{cat.warn}</Badge>
                        <Badge variant="ok">{cat.ok}</Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>

          {/* Habilitations travailleurs */}
          <Card>
            <CardTitle className="mb-4 px-5 pt-4">Habilitations travailleurs</CardTitle>
            <CardBody>
              <div className="space-y-3">
                {habilitationsStats.validee + habilitationsStats.partielle + habilitationsStats.non_validee === 0 ? (
                  <div className="text-xs text-textMuted">Aucune donnée</div>
                ) : (
                  <>
                    <div className="flex gap-1 h-6 rounded overflow-hidden bg-borderLight">
                      {habilitationsStats.validee > 0 && (
                        <div
                          style={{
                            flex: habilitationsStats.validee,
                            backgroundColor: 'var(--ok)',
                          }}
                          className="min-w-1"
                        />
                      )}
                      {habilitationsStats.partielle > 0 && (
                        <div
                          style={{
                            flex: habilitationsStats.partielle,
                            backgroundColor: 'var(--warn)',
                          }}
                          className="min-w-1"
                        />
                      )}
                      {habilitationsStats.non_validee > 0 && (
                        <div
                          style={{
                            flex: habilitationsStats.non_validee,
                            backgroundColor: 'var(--danger)',
                          }}
                          className="min-w-1"
                        />
                      )}
                      {habilitationsStats.validee + habilitationsStats.partielle + habilitationsStats.non_validee === 0 && (
                        <div className="w-full bg-borderLight" />
                      )}
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-textMuted">Validée</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{habilitationsStats.validee}</span>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--ok)' }} />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-textMuted">Partielle</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{habilitationsStats.partielle}</span>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--warn)' }} />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-textMuted">Non validée</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{habilitationsStats.non_validee}</span>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--danger)' }} />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Parc d'appareils */}
          <Card>
            <CardTitle className="mb-4 px-5 pt-4">Parc d'appareils</CardTitle>
            <CardBody>
              <div className="space-y-3">
                {appareilsStats.valide + appareilsStats.a_prevoir + appareilsStats.en_retard === 0 ? (
                  <div className="text-xs text-textMuted">Aucune donnée</div>
                ) : (
                  <>
                    <div className="flex gap-1 h-6 rounded overflow-hidden bg-borderLight">
                      {appareilsStats.valide > 0 && (
                        <div
                          style={{
                            flex: appareilsStats.valide,
                            backgroundColor: 'var(--ok)',
                          }}
                          className="min-w-1"
                        />
                      )}
                      {appareilsStats.a_prevoir > 0 && (
                        <div
                          style={{
                            flex: appareilsStats.a_prevoir,
                            backgroundColor: 'var(--warn)',
                          }}
                          className="min-w-1"
                        />
                      )}
                      {appareilsStats.en_retard > 0 && (
                        <div
                          style={{
                            flex: appareilsStats.en_retard,
                            backgroundColor: 'var(--danger)',
                          }}
                          className="min-w-1"
                        />
                      )}
                      {appareilsStats.valide + appareilsStats.a_prevoir + appareilsStats.en_retard === 0 && (
                        <div className="w-full bg-borderLight" />
                      )}
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-textMuted">Valide</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{appareilsStats.valide}</span>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--ok)' }} />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-textMuted">À prévoir</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{appareilsStats.a_prevoir}</span>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--warn)' }} />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-textMuted">En retard</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{appareilsStats.en_retard}</span>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--danger)' }} />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
