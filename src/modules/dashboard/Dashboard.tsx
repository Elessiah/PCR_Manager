import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { KpiTile } from '../../components/ui/KpiTile';
import { Card, CardHead, CardBody, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Dot } from '../../components/ui/Dot';
import { PageHead } from '../../components/ui/PageHead';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';
import { api } from '../../lib/api';
import { statusFromDate, statusToBadgeVariant } from '../../lib/status';
import type { ControleQualite, HabilitationStatus } from '../../types/domain';
import { Download, RefreshCw, FileCheck, CheckCircle, ShieldCheck, Activity, Zap } from 'lucide-react';

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
  const navigate = useNavigate();

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
    const verificationsList = actions.filter(a => a.categorie === 'verification');
    const controlesList = actions.filter(a => a.categorie === 'controle');

    const countByStatus = (items: Action[]) => {
      const danger = items.filter(a => statusFromDate(a.deadline, 1) === 'en_retard').length;
      const warn = items.filter(a => statusFromDate(a.deadline, 3) === 'a_prevoir').length;
      return { danger, warn };
    };

    return {
      formations: { danger: 0, warn: 0 },
      visites: { danger: 0, warn: 0 },
      verifications: countByStatus(verificationsList),
      controles: countByStatus(controlesList),
      dosimetrie: { danger: 0, warn: 0 },
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

  const todayFormatted = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

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
  const valideePartielle = habilitationsStats.validee + habilitationsStats.partielle;

  const sources = [
    { key: 'formations', label: 'Formations', icon: FileCheck, danger: alertCategories.formations.danger, warn: alertCategories.formations.warn },
    { key: 'visites', label: 'Visites médicales', icon: CheckCircle, danger: alertCategories.visites.danger, warn: alertCategories.visites.warn },
    { key: 'verifications', label: 'Vérifications', icon: ShieldCheck, danger: alertCategories.verifications.danger, warn: alertCategories.verifications.warn },
    { key: 'controles', label: 'Contrôles qualité', icon: Activity, danger: alertCategories.controles.danger, warn: alertCategories.controles.warn },
    { key: 'dosimetrie', label: 'Dosimétrie', icon: Zap, danger: alertCategories.dosimetrie.danger, warn: alertCategories.dosimetrie.warn },
  ];

  return (
    <div className="space-y-6">
      <PageHead
        title="Tableau de bord"
        sub={`État réglementaire du service au ${todayFormatted}`}
        actions={
          <>
            <button className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-textMuted hover:text-text border border-border rounded-md">
              <Download size={14} />
              Exporter
            </button>
            <button className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-accent hover:bg-accentDark border border-accentBorder rounded-md">
              <RefreshCw size={14} />
              Actualiser
            </button>
          </>
        }
      />

      {/* KPI Grid 3 cols */}
      <div className="grid grid-cols-3 gap-3.5">
        <KpiTile
          label="En retard"
          value={kpiInRetard}
          tone="danger"
          chip={<Badge variant="danger">{kpiInRetard} action{kpiInRetard !== 1 ? 's' : ''}</Badge>}
          footer="Échéances réglementaires dépassées"
        />
        <KpiTile
          label="À prévoir"
          value={kpiAPrevoir}
          tone="warn"
          chip={<Badge variant="warn">90 jours</Badge>}
          footer="Échéances dans les 3 mois"
        />
        <KpiTile
          label="À jour"
          value={`${valideePartielle} / ${travailleurs.length}`}
          tone="ok"
          chip={<Badge variant="ok">Conforme</Badge>}
          footer="Travailleurs avec habilitation valide ou partielle"
        />
      </div>

      {/* 2-col grid 1.6fr / 1fr */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        {/* LEFT — Échéances prioritaires */}
        <Card>
          <CardHead>
            <CardTitle>Échéances prioritaires</CardTitle>
            <button
              onClick={() => navigate('/actions')}
              className="inline-flex items-center gap-1 text-textMuted hover:text-text text-xs font-semibold"
            >
              Voir toutes les actions
              <RefreshCw size={14} style={{ transform: 'rotate(90deg)' }} />
            </button>
          </CardHead>
          {topActions.length === 0 ? (
            <CardBody className="text-textMuted text-sm">Aucune action.</CardBody>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Sujet</TH>
                  <TH>Type</TH>
                  <TH>Échéance</TH>
                  <TH className="text-right">Statut</TH>
                </TR>
              </THead>
              <TBody>
                {topActions.map(action => {
                  const status = statusFromDate(action.deadline, 1);
                  return (
                    <TR
                      key={action.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/appareils/${action.cible.id}`)}
                    >
                      <TD>
                        <div className="font-semibold">{action.cible.label}</div>
                        <div className="text-textSoft text-xs mt-px">{action.libelle}</div>
                      </TD>
                      <TD className="text-textMuted text-sm">
                        {action.categorie === 'verification' ? 'Vérification' : 'Contrôle'}
                      </TD>
                      <TD>
                        <div className="font-mono tabular-nums text-xs">{formatDate(action.deadline)}</div>
                        <div className="text-textSoft text-xs mt-px">{relDay(action.deadline)}</div>
                      </TD>
                      <TD className="text-right">
                        <Badge variant={statusToBadgeVariant[status]}>
                          {status === 'en_retard' ? 'Invalide' : status === 'a_prevoir' ? 'À prévoir' : 'À jour'}
                        </Badge>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </Card>

        {/* RIGHT — 3 cards stacked */}
        <div className="flex flex-col gap-3.5">
          {/* Sources des alertes */}
          <Card>
            <CardHead>
              <CardTitle>Sources des alertes</CardTitle>
            </CardHead>
            <CardBody className="flex flex-col gap-2.5">
              {sources.map(src => {
                const IconComponent = src.icon;
                return (
                  <div key={src.key} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-surface2 border border-border grid place-items-center text-textMuted flex-shrink-0">
                      <IconComponent size={14} />
                    </div>
                    <div className="flex-1 text-sm font-medium">{src.label}</div>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {src.danger > 0 && <Badge variant="danger">{src.danger} retard</Badge>}
                      {src.warn > 0 && <Badge variant="warn">{src.warn} à prévoir</Badge>}
                      {src.danger === 0 && src.warn === 0 && <Badge variant="ok">À jour</Badge>}
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>

          {/* Habilitations travailleurs */}
          <Card>
            <CardHead>
              <CardTitle>Habilitations travailleurs</CardTitle>
            </CardHead>
            <CardBody>
              {habilitationsStats.validee + habilitationsStats.partielle + habilitationsStats.non_validee === 0 ? (
                <div className="text-xs text-textMuted">Aucune donnée</div>
              ) : (
                <>
                  {/* Segment bar */}
                  <div className="flex gap-1.5 mb-3">
                    {[
                      { count: habilitationsStats.validee, color: 'ok' },
                      { count: habilitationsStats.partielle, color: 'warn' },
                      { count: habilitationsStats.non_validee, color: 'danger' },
                    ].map((seg, i) => (
                      seg.count > 0 && (
                        <div
                          key={i}
                          className="h-2 rounded-sm flex-1 min-w-3"
                          style={{ backgroundColor: `var(--${seg.color})` }}
                        />
                      )
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Dot variant="ok" />
                      <span className="flex-1">Validée</span>
                      <span className="font-mono tabular-nums text-textSoft">{habilitationsStats.validee}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Dot variant="warn" />
                      <span className="flex-1">Partielle</span>
                      <span className="font-mono tabular-nums text-textSoft">{habilitationsStats.partielle}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Dot variant="danger" />
                      <span className="flex-1">Non validée</span>
                      <span className="font-mono tabular-nums text-textSoft">{habilitationsStats.non_validee}</span>
                    </div>
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          {/* Parc d'appareils */}
          <Card>
            <CardHead>
              <CardTitle>Parc d'appareils</CardTitle>
            </CardHead>
            <CardBody>
              {appareilsStats.valide + appareilsStats.a_prevoir + appareilsStats.en_retard === 0 ? (
                <div className="text-xs text-textMuted">Aucune donnée</div>
              ) : (
                <>
                  {/* Segment bar */}
                  <div className="flex gap-1.5 mb-3">
                    {[
                      { count: appareilsStats.valide, color: 'ok' },
                      { count: appareilsStats.a_prevoir, color: 'warn' },
                      { count: appareilsStats.en_retard, color: 'danger' },
                    ].map((seg, i) => (
                      seg.count > 0 && (
                        <div
                          key={i}
                          className="h-2 rounded-sm flex-1 min-w-3"
                          style={{ backgroundColor: `var(--${seg.color})` }}
                        />
                      )
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Dot variant="ok" />
                      <span className="flex-1">Valide</span>
                      <span className="font-mono tabular-nums text-textSoft">{appareilsStats.valide}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Dot variant="warn" />
                      <span className="flex-1">À prévoir</span>
                      <span className="font-mono tabular-nums text-textSoft">{appareilsStats.a_prevoir}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Dot variant="danger" />
                      <span className="flex-1">En retard</span>
                      <span className="font-mono tabular-nums text-textSoft">{appareilsStats.en_retard}</span>
                    </div>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
