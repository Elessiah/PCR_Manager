import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { KpiTile } from '../../components/ui/KpiTile';
import { Card, CardHead, CardBody, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Dot } from '../../components/ui/Dot';
import { PageHead } from '../../components/ui/PageHead';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';
import { api } from '../../lib/api';
import { statusFromDate, statusToBadgeVariant } from '../../lib/status';
import { useMidnightRefresh } from '../../hooks/useMidnightRefresh';
import type { ControleQualite, Habilitation, HabilitationStatus, CompetenceTravailleurGeneral, CompetenceTravailleur, ImportResultExtended } from '../../types/domain';
import { RefreshCw, FileCheck, CheckCircle, ShieldCheck, Activity, Zap, Database, ChevronDown, GraduationCap, X } from 'lucide-react';

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
  const qc = useQueryClient();
  const dataMenuRef = useRef<HTMLDivElement>(null);

  useMidnightRefresh();

  // Data menu dropdown
  const [dataMenuOpen, setDataMenuOpen] = useState(false);

  // Export modal
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportCode, setExportCode] = useState<string>('');
  const [exportFileB64, setExportFileB64] = useState<string>('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string>('');

  // Import modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importCode, setImportCode] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string>('');
  const [importSuccess, setImportSuccess] = useState<ImportResultExtended | null>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (dataMenuRef.current && !dataMenuRef.current.contains(e.target as Node)) {
        setDataMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const { data: travailleurs = [], isLoading: loadingTrav } = useQuery({
    queryKey: ['travailleurs'],
    queryFn: () => api.travailleur.list(),
    refetchOnMount: 'always',
  });

  const { data: appareils = [], isLoading: loadingApp } = useQuery({
    queryKey: ['appareils'],
    queryFn: () => api.appareil.list(),
    refetchOnMount: 'always',
  });

  const { data: verifications = [], isLoading: loadingVerif } = useQuery({
    queryKey: ['verifications'],
    queryFn: () => api.verification.list(),
    refetchOnMount: 'always',
  });

  const { data: controles = [], isLoading: loadingControle } = useQuery({
    queryKey: ['controles'],
    queryFn: () => api.controleQualite.list(),
    refetchOnMount: 'always',
  });

  const habilitationQueries = useQueries({
    queries: travailleurs.map(t => ({
      queryKey: ['habilitation', t.id],
      queryFn: () => api.habilitation.compute(t.id),
    })),
  });

  const habilitationRawQueries = useQueries({
    queries: travailleurs.map(t => ({
      queryKey: ['habilitation', 'raw', t.id],
      queryFn: () => api.habilitation.getForTravailleur(t.id),
    })),
  });

  const competencesGeneralesQueries = useQueries({
    queries: travailleurs.map(t => ({
      queryKey: ['competenceGeneral', t.id],
      queryFn: () => api.competence.generalGetForTravailleur(t.id),
    })),
  });

  const competencesAppareilQueries = useQueries({
    queries: travailleurs.map(t => ({
      queryKey: ['competence', t.id],
      queryFn: () => api.competence.getForTravailleur(t.id),
    })),
  });

  const { data: competenceRefs = [], isLoading: loadingCompRefs } = useQuery({
    queryKey: ['competenceRefs'],
    queryFn: () => api.competence.list(),
  });

  const isLoading = loadingTrav || loadingApp || loadingVerif || loadingControle || loadingCompRefs || habilitationQueries.some(q => q.isPending) || habilitationRawQueries.some(q => q.isPending) || competencesGeneralesQueries.some(q => q.isPending) || competencesAppareilQueries.some(q => q.isPending);

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

    let competencesDanger = 0;
    let competencesWarn = 0;

    const checkCompetenceExpiry = (
      comp: { validated: number; date_peremption: string | null; competence_ref_id: number }
    ) => {
      if (comp.validated !== 1 || !comp.date_peremption) return;
      const compRef = competenceRefs.find(r => r.id === comp.competence_ref_id);
      if (!compRef) return;
      const peremptionDate = new Date(comp.date_peremption);
      const alerteSeuilDate = new Date(peremptionDate);
      alerteSeuilDate.setMonth(alerteSeuilDate.getMonth() - compRef.duree_alerte_mois);
      const today = new Date();
      if (today > peremptionDate) {
        competencesDanger++;
      } else if (today >= alerteSeuilDate) {
        competencesWarn++;
      }
    };

    competencesGeneralesQueries.forEach((query) => {
      (query.data || []).forEach((comp: CompetenceTravailleurGeneral) => checkCompetenceExpiry(comp));
    });

    competencesAppareilQueries.forEach((query) => {
      (query.data || []).forEach((comp: CompetenceTravailleur) => checkCompetenceExpiry(comp));
    });

    const formationsDanger = habitationsData.filter(
      h => !h.status.details?.formation_rp_ok || !h.status.details?.formation_rp_patients_ok
    ).length;
    const visitesDanger = habitationsData.filter(h => !h.status.details?.visite_med_ok).length;
    const dosimetrieDanger = habitationsData.filter(h => !h.status.details?.dosimetries_ok).length;

    let formationsWarn = 0;
    let visitesWarn = 0;

    habilitationRawQueries.forEach((q) => {
      const hab = q.data as Habilitation | undefined;
      if (!hab) return;

      if (hab.formation_rp_travailleurs_date) {
        const d = new Date(hab.formation_rp_travailleurs_date);
        d.setFullYear(d.getFullYear() + 3);
        if (statusFromDate(d.toISOString().split('T')[0], 3) === 'a_prevoir') formationsWarn++;
      }

      let visitDeadline: string | null = null;
      if (hab.visite_medicale_date_peremption) {
        visitDeadline = hab.visite_medicale_date_peremption;
      } else if (hab.visite_medicale_date) {
        const d = new Date(hab.visite_medicale_date);
        if (hab.visite_medicale_duree_mois) {
          d.setMonth(d.getMonth() + hab.visite_medicale_duree_mois);
        } else {
          d.setFullYear(d.getFullYear() + 1);
        }
        visitDeadline = d.toISOString().split('T')[0];
      }
      if (visitDeadline && statusFromDate(visitDeadline, 3) === 'a_prevoir') visitesWarn++;
    });

    return {
      formations: { danger: formationsDanger, warn: formationsWarn },
      visites: { danger: visitesDanger, warn: visitesWarn },
      verifications: countByStatus(verificationsList),
      controles: countByStatus(controlesList),
      dosimetrie: { danger: dosimetrieDanger, warn: 0 },
      competences: { danger: competencesDanger, warn: competencesWarn },
    };
  }, [actions, competencesGeneralesQueries, competencesAppareilQueries, competenceRefs, habitationsData, habilitationRawQueries]);

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

      const statuses = appControles.map(c => statusFromDate(c.date_echeance, 3));
      if (statuses.includes('en_retard')) stats.en_retard++;
      else if (statuses.includes('a_prevoir')) stats.a_prevoir++;
      else stats.valide++;
    });

    return stats;
  }, [appareils, controles]);

  const kpiInRetard = useMemo(() => {
    return Object.values(alertCategories).reduce((sum, cat) => sum + cat.danger, 0);
  }, [alertCategories]);

  const kpiAPrevoir = useMemo(() => {
    return Object.values(alertCategories).reduce((sum, cat) => sum + cat.warn, 0);
  }, [alertCategories]);

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

  const handleGenerateExport = async () => {
    setExportLoading(true);
    setExportError('');
    try {
      const result = await api.data.exportEncrypted();
      setExportCode(result.code);
      setExportFileB64(result.file_b64);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Erreur lors de l\'export');
    } finally {
      setExportLoading(false);
    }
  };

  const handleCopyExportCode = () => {
    const codeWithoutDashes = exportCode.replace(/-/g, '');
    navigator.clipboard.writeText(codeWithoutDashes);
  };

  const handleDownloadExportFile = async () => {
    try {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const defaultName = `pcr-export-${today}.pcrexp`;
      const destPath = await invoke<string | null>('choose_save_path', { defaultName });
      if (!destPath) return;
      await invoke<string>('save_export_file', { fileB64: exportFileB64, destPath });
      setExportError('');
      toast.success(`Fichier enregistré : ${destPath}`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde du fichier');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImportFile(file || null);
  };

  const handleImport = async () => {
    if (!importFile || !importCode) {
      setImportError('Veuillez sélectionner un fichier et entrer le code');
      return;
    }

    setImportLoading(true);
    setImportError('');
    setImportSuccess(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer;
          const bytes = new Uint8Array(arrayBuffer);
          let binaryString = '';
          for (let i = 0; i < bytes.length; i++) {
            binaryString += String.fromCharCode(bytes[i]);
          }
          const fileB64 = btoa(binaryString);

          const result = await api.data.importEncrypted({ fileB64, code: importCode });
          setImportSuccess(result);
          setImportFile(null);
          setImportCode('');

          // Invalider toutes les requêtes impactées par l'import
          await qc.invalidateQueries({ queryKey: ['travailleurs'] });
          await qc.invalidateQueries({ queryKey: ['appareils'] });
          await qc.invalidateQueries({ queryKey: ['verifications'] });
          await qc.invalidateQueries({ queryKey: ['controles'] });
          await qc.invalidateQueries({ queryKey: ['habilitation'] });
          await qc.invalidateQueries({ queryKey: ['habilitationRaw'] });
          await qc.invalidateQueries({ queryKey: ['competenceGeneral'] });
          await qc.invalidateQueries({ queryKey: ['travailleurAppareils'] });
        } catch (err) {
          setImportError(err instanceof Error ? err.message : 'Erreur lors de l\'import');
        } finally {
          setImportLoading(false);
        }
      };
      reader.readAsArrayBuffer(importFile);
    } catch {
      setImportError('Erreur lors de la lecture du fichier');
      setImportLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-textMuted text-sm">Chargement des données...</div>;
  }

  const topActions = actions.slice(0, 8);
  const valideePartielle = habilitationsStats.validee + habilitationsStats.partielle;

  const sources = [
    { key: 'formations', label: 'Formations', icon: FileCheck, danger: alertCategories.formations.danger, warn: alertCategories.formations.warn },
    { key: 'visites', label: 'Visites médicales', icon: CheckCircle, danger: alertCategories.visites.danger, warn: alertCategories.visites.warn },
    { key: 'competences', label: 'Compétences', icon: GraduationCap, danger: alertCategories.competences.danger, warn: alertCategories.competences.warn },
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
          <div className="flex items-center gap-2">
            {/* Data dropdown menu */}
            <div ref={dataMenuRef} className="relative">
              <button
                onClick={() => setDataMenuOpen(!dataMenuOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-textMuted hover:text-text border border-border rounded-md"
              >
                <Database size={14} />
                Données
                <ChevronDown size={12} />
              </button>
              {dataMenuOpen && (
                <div className="absolute top-full right-0 mt-1 bg-surface border border-border rounded-md shadow-lg z-50 min-w-48">
                  <button
                    onClick={() => {
                      setExportModalOpen(true);
                      setExportCode('');
                      setExportFileB64('');
                      setExportError('');
                      setDataMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-surface2 first:rounded-t-md"
                  >
                    Exporter (chiffré)
                  </button>
                  <button
                    onClick={() => {
                      setImportModalOpen(true);
                      setImportFile(null);
                      setImportCode('');
                      setImportError('');
                      setImportSuccess(null);
                      setDataMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-surface2 last:rounded-b-md border-t border-border"
                  >
                    Importer (chiffré)
                  </button>
                </div>
              )}
            </div>

            <button onClick={() => qc.invalidateQueries()} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-accent hover:bg-accentDark border border-accentBorder rounded-md">
              <RefreshCw size={14} />
              Actualiser
            </button>
          </div>
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
          chip={<Badge variant="warn">{kpiAPrevoir} action{kpiAPrevoir !== 1 ? 's' : ''}</Badge>}
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

      {/* Export Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-lg shadow-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            {!exportCode && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Exporter les données</h2>
                  <button
                    onClick={() => {
                      setExportModalOpen(false);
                      setExportCode('');
                      setExportFileB64('');
                      setExportError('');
                    }}
                    className="text-textMuted hover:text-text"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-textSoft mb-4">
                  Générez un code d'export chiffré avec les données de votre établissement. Vous pourrez utiliser ce code et le fichier généré pour restaurer vos données ailleurs.
                </p>
                {exportError && (
                  <div className="p-3 mb-4 bg-red-100 border border-red-300 rounded-md text-xs text-red-700">
                    {exportError}
                  </div>
                )}
                <button
                  onClick={handleGenerateExport}
                  disabled={exportLoading}
                  className="w-full px-4 py-2.5 bg-accent hover:bg-accentDark text-white text-xs font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportLoading ? 'Génération...' : 'Générer l\'export'}
                </button>
              </div>
            )}

            {exportCode && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Exporter les données</h2>
                  <button
                    onClick={() => {
                      setExportModalOpen(false);
                      setExportCode('');
                      setExportFileB64('');
                      setExportError('');
                    }}
                    className="text-textMuted hover:text-text"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {exportError && (
                  <div className="p-3 bg-red-100 border border-red-300 rounded-md text-xs text-red-700">
                    {exportError}
                  </div>
                )}

                <div className="p-3 bg-orange-50 border border-orange-200 rounded-md text-xs text-orange-800">
                  <strong>⚠ Important :</strong> Notez ou copiez ce code MAINTENANT. Il ne sera plus jamais affiché.
                </div>

                <div>
                  <label className="text-xs font-semibold text-textMuted block mb-2">Code (sans tirets)</label>
                  <div className="p-3 bg-surface2 border border-border rounded-md font-mono text-lg tracking-widest text-center">
                    {exportCode.replace(/-/g, '').match(/.{1,5}/g)?.join('-') || exportCode}
                  </div>
                  <button
                    onClick={handleCopyExportCode}
                    title="Copie le code sans tirets dans le presse-papiers"
                    className="w-full mt-2 px-4 py-2 text-xs font-semibold border border-border rounded-md hover:bg-surface2"
                  >
                    Copier le code
                  </button>
                </div>

                <div>
                  <button
                    onClick={handleDownloadExportFile}
                    className="w-full px-4 py-2.5 bg-accent hover:bg-accentDark text-white text-xs font-semibold rounded-md"
                  >
                    Télécharger le fichier
                  </button>
                </div>

                <button
                  onClick={() => {
                    setExportModalOpen(false);
                    setExportCode('');
                    setExportFileB64('');
                  }}
                  className="w-full px-4 py-2 text-xs font-semibold border border-border rounded-md hover:bg-surface2"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-lg shadow-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Importer les données</h2>

            {!importSuccess ? (
              <div className="space-y-4">
                {importError && (
                  <div className="p-3 bg-red-100 border border-red-300 rounded-md text-xs text-red-700">
                    {importError}
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-textMuted block mb-2">
                    Fichier d'export (.pcrexp, .bin)
                  </label>
                  <input
                    type="file"
                    accept=".pcrexp,.bin"
                    onChange={handleImportFile}
                    className="w-full px-3 py-2 text-xs border border-border rounded-md"
                  />
                  {importFile && (
                    <p className="text-xs text-textSoft mt-1">{importFile.name}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-textMuted block mb-2">
                    Code (10 caractères)
                  </label>
                  <input
                    type="text"
                    value={importCode}
                    onChange={(e) => setImportCode(e.target.value.toUpperCase())}
                    placeholder="XXXXX-XXXXX"
                    maxLength={11}
                    className="w-full px-3 py-2 text-xs border border-border rounded-md font-mono"
                  />
                </div>

                <button
                  onClick={handleImport}
                  disabled={importLoading || !importFile || !importCode}
                  className="w-full px-4 py-2.5 bg-accent hover:bg-accentDark text-white text-xs font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importLoading ? 'Import en cours...' : 'Importer'}
                </button>

                <button
                  onClick={() => {
                    setImportModalOpen(false);
                    setImportFile(null);
                    setImportCode('');
                    setImportError('');
                  }}
                  className="w-full px-4 py-2 text-xs font-semibold border border-border rounded-md hover:bg-surface2"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded-md text-xs text-green-800">
                  <strong>✓ Import réussi</strong>
                </div>

                <div className="text-xs space-y-2">
                  {importSuccess.etablissements_added > 0 && (
                    <p>{importSuccess.etablissements_added} établissement(s) importé(s)</p>
                  )}
                  {importSuccess.travailleurs_added > 0 && (
                    <p>{importSuccess.travailleurs_added} travailleur(s) importé(s)</p>
                  )}
                  {importSuccess.appareils_added > 0 && (
                    <p>{importSuccess.appareils_added} appareil(s) importé(s)</p>
                  )}
                  {importSuccess.competences_added > 0 && (
                    <p>{importSuccess.competences_added} compétence(s) importée(s)</p>
                  )}
                  {importSuccess.habilitations_added > 0 && (
                    <p>{importSuccess.habilitations_added} habilitation(s) importée(s)</p>
                  )}
                  {importSuccess.verifications_added > 0 && (
                    <p>{importSuccess.verifications_added} vérification(s) importée(s)</p>
                  )}
                  {importSuccess.controles_added > 0 && (
                    <p>{importSuccess.controles_added} contrôle(s) importé(s)</p>
                  )}
                </div>

                <button
                  onClick={() => {
                    setImportModalOpen(false);
                    setImportSuccess(null);
                  }}
                  className="w-full px-4 py-2.5 bg-accent hover:bg-accentDark text-white text-xs font-semibold rounded-md"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
