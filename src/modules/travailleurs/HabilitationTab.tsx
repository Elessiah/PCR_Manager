import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { statusFromDate, statusToBadgeVariant, competenceStatus } from '../../lib/status';
import { Card, CardBody, CardHead, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input, Label } from '../../components/ui/FormField';
import { Activity, ArrowUpRight, GraduationCap, X, Check, Monitor, Search, Users, Star } from 'lucide-react';
import type { Habilitation } from '../../types/domain';
import CompetencesAppareilSubsheet from './CompetencesAppareilSubsheet';

interface HabilitationTabProps {
  travailleurId: number;
}

type EditModalType = 'dosimetries' | 'dosimetries_op' | 'formationRpTravailleur' | 'formationRpPatient' | 'visiteMedicale' | null;
type VisiteMedicaleMode = 'duree' | 'dateDirecte';

interface EditingGeneralComp {
  competenceRefId: number;
  libelle: string;
  isValidated: boolean;
}

interface PendingAlerte {
  itemType: string;
  itemLabel: string;
  oldDelai: number;
  newDelai: number;
}

const DEFAULT_DELAYS: Record<string, number> = {
  dosimetrie_passive:        1,
  dosimetrie_operationnelle: 1,
  formation_rp_travailleur:  1,
  formation_rp_patient:      1,
  visite_medicale:           3,
};
export default function HabilitationTab({ travailleurId }: HabilitationTabProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingModal, setEditingModal] = useState<EditModalType>(null);
  const [isLoadingUpdate, setIsLoadingUpdate] = useState(false);
  const [selectedAppareilIds, setSelectedAppareilIds] = useState<number[]>([]);
  const [appareilSearchQuery, setAppareilSearchQuery] = useState('');
  const [editingGeneralComp, setEditingGeneralComp] = useState<EditingGeneralComp | null>(null);
  const [editGeneralDate, setEditGeneralDate] = useState('');
  const [pendingAlerte, setPendingAlerte] = useState<PendingAlerte | null>(null);
  const [isPropagating, setIsPropagating] = useState(false);

  const { data: habStatus } = useQuery({
    queryKey: ['habilitation', travailleurId],
    queryFn: () => api.habilitation.compute(travailleurId),
  });

  const { data: habilitation } = useQuery({
    queryKey: ['habilitationRaw', travailleurId],
    queryFn: () => api.habilitation.getForTravailleur(travailleurId),
  });

  const { data: appareils = [] } = useQuery({
    queryKey: ['appareils'],
    queryFn: () => api.appareil.list(),
  });

  const { data: travailleur } = useQuery({
    queryKey: ['travailleur', travailleurId],
    queryFn: () => api.travailleur.get(travailleurId),
  });

  const { data: competenceRefs = [] } = useQuery({
    queryKey: ['competenceRefs'],
    queryFn: () => api.competence.list(),
  });

  const { data: generalCompetences = [] } = useQuery({
    queryKey: ['competenceGeneral', travailleurId],
    queryFn: () => api.competence.generalGetForTravailleur(travailleurId),
  });

  const { data: travailleurAppareils = [] } = useQuery({
    queryKey: ['travailleurAppareils', travailleurId],
    queryFn: () => api.travailleurAppareil.list(travailleurId),
  });

  const { data: habConfig = [] } = useQuery({
    queryKey: ['habilitationConfig'],
    queryFn: () => api.habilitation.getConfig(),
  });

  const configMap = Object.fromEntries((habConfig ?? []).map(c => [c.item_type, c.delai_alerte_mois]));

  const effectiveDelay = (itemType: string, perWorkerDelay: number | null | undefined): number => {
    if (perWorkerDelay !== null && perWorkerDelay !== undefined) return perWorkerDelay;
    return configMap[itemType] ?? DEFAULT_DELAYS[itemType] ?? 1;
  };

  if (!habStatus || !travailleur || !habilitation) {
    return (
      <div className="flex items-center justify-center py-12 text-textMuted text-sm">
        Chargement de l'habilitation…
      </div>
    );
  }

  const appareilsAssignes = appareils.filter(a => travailleurAppareils.includes(a.id));
  const assignedSet = new Set(travailleurAppareils);
  const availableAppareils = appareils.filter(
    a => !assignedSet.has(a.id)
  );
  const competencesGenerales = competenceRefs.filter(c => c.propre_appareil === 0);

  const validatedGeneralCount = competencesGenerales.filter(ref => {
    const comp = generalCompetences.find(c => c.competence_ref_id === ref.id);
    const st = competenceStatus(comp?.validated, comp?.date_peremption, ref.duree_alerte_mois);
    return st === 'valide' || st === 'a_prevoir';
  }).length;

  const handleUpdateHabilitation = async (
    input: Parameters<typeof api.habilitation.update>[0],
    alerte?: { itemType: string; itemLabel: string; oldDelai: number; newDelai: number },
  ) => {
    try {
      setIsLoadingUpdate(true);
      await api.habilitation.update({
        dosimetriePassiveDate: habilitation.dosimetrie_passive_date,
        dosimetrieOperationnelleDate: habilitation.dosimetrie_operationnelle_date,
        formationRpTravailleursDate: habilitation.formation_rp_travailleurs_date,
        formationRpPatientsDate: habilitation.formation_rp_patients_date,
        visiteMedicaleDate: habilitation.visite_medicale_date,
        visiteMedicaleDureeMois: habilitation.visite_medicale_duree_mois,
        visiteMedicaleDatePeremption: habilitation.visite_medicale_date_peremption,
        delaiAlerteDosimetriePassive: habilitation.delai_alerte_dosimetrie_passive,
        delaiAlerteDosimetrieOp: habilitation.delai_alerte_dosimetrie_op,
        delaiAlerteFormationRpTrav: habilitation.delai_alerte_formation_rp_trav,
        delaiAlerteFormationRpPat: habilitation.delai_alerte_formation_rp_pat,
        delaiAlerteVisiteMed: habilitation.delai_alerte_visite_med,
        ...input, // override with the specific field(s) being saved; includes travailleurId
      });
      queryClient.invalidateQueries({ queryKey: ['habilitation', travailleurId] });
      queryClient.invalidateQueries({ queryKey: ['habilitationRaw', travailleurId] });
      queryClient.invalidateQueries({ queryKey: ['habilitation', 'raw', travailleurId] });
      setEditingModal(null);
      if (alerte && alerte.oldDelai !== alerte.newDelai) {
        setPendingAlerte(alerte);
      }
    } finally {
      setIsLoadingUpdate(false);
    }
  };

  const handleAlertePropagate = async (scope: 'all' | 'default') => {
    if (!pendingAlerte) return;
    try {
      setIsPropagating(true);
      await api.habilitation.propagateAlerte({
        itemType: pendingAlerte.itemType,
        delaiMois: pendingAlerte.newDelai,
        scope,
      });
      queryClient.invalidateQueries({ queryKey: ['habilitationConfig'] });
      queryClient.invalidateQueries({ queryKey: ['habilitationRaw', travailleurId] });
      queryClient.invalidateQueries({ queryKey: ['habilitation', travailleurId] });
      setPendingAlerte(null);
    } catch {
      toast.error('Erreur lors de la mise à jour du délai d\'alerte');
    } finally {
      setIsPropagating(false);
    }
  };

  const handleClickGeneralCompetence = (competenceRefId: number, libelle: string) => {
    const existing = generalCompetences.find(c => c.competence_ref_id === competenceRefId);
    const isValidated = existing?.validated === 1;
    setEditingGeneralComp({ competenceRefId, libelle, isValidated });
    setEditGeneralDate(
      isValidated
        ? (existing?.date_validation || new Date().toISOString().slice(0, 10))
        : new Date().toISOString().slice(0, 10)
    );
  };

  const handleSaveGeneralComp = async () => {
    if (!editingGeneralComp) return;
    await api.competence.generalSet({
      travailleurId,
      competenceRefId: editingGeneralComp.competenceRefId,
      dateValidation: editGeneralDate || null,
      validated: 1,
    });
    queryClient.invalidateQueries({ queryKey: ['competenceGeneral', travailleurId] });
    queryClient.invalidateQueries({ queryKey: ['habilitation', travailleurId] });
    queryClient.invalidateQueries({ queryKey: ['habilitationRaw', travailleurId] });
    setEditingGeneralComp(null);
  };

  const handleInvalidateGeneralComp = async () => {
    if (!editingGeneralComp) return;
    await api.competence.generalSet({
      travailleurId,
      competenceRefId: editingGeneralComp.competenceRefId,
      validated: 0,
    });
    queryClient.invalidateQueries({ queryKey: ['competenceGeneral', travailleurId] });
    queryClient.invalidateQueries({ queryKey: ['habilitation', travailleurId] });
    queryClient.invalidateQueries({ queryKey: ['habilitationRaw', travailleurId] });
    setEditingGeneralComp(null);
  };

  const handleRemoveAppareil = async (appareilId: number) => {
    try {
      await api.travailleurAppareil.remove(travailleurId, appareilId);
      queryClient.invalidateQueries({ queryKey: ['travailleurAppareils', travailleurId] });
      queryClient.invalidateQueries({ queryKey: ['habilitation', travailleurId] });
    } catch (error) {
      toast.error('Erreur lors du retrait de l\'appareil');
    }
  };

  const handleAddAppareils = async () => {
    if (selectedAppareilIds.length === 0) return;
    try {
      for (const appareilId of selectedAppareilIds) {
        await api.travailleurAppareil.add(travailleurId, appareilId);
      }
      queryClient.invalidateQueries({ queryKey: ['travailleurAppareils', travailleurId] });
      queryClient.invalidateQueries({ queryKey: ['habilitation', travailleurId] });
      setSelectedAppareilIds([]);
    } catch (error) {
      toast.error('Erreur lors de l\'ajout de l\'appareil');
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Non validé';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  const visitStatusLabels: Record<string, string> = {
    valide: 'À jour',
    a_prevoir: 'À prévoir',
    en_retard: 'En retard',
    non_applicable: 'Non renseigné',
  };

  const visitDeadline = (() => {
    if (habilitation.visite_medicale_date_peremption) return habilitation.visite_medicale_date_peremption;
    if (habilitation.visite_medicale_date) {
      const d = new Date(habilitation.visite_medicale_date);
      if (habilitation.visite_medicale_duree_mois) {
        d.setMonth(d.getMonth() + habilitation.visite_medicale_duree_mois);
      } else {
        d.setFullYear(d.getFullYear() + 1);
      }
      return d.toISOString().split('T')[0];
    }
    return null;
  })();
  const visitAlertDelay = effectiveDelay('visite_medicale', habilitation.delai_alerte_visite_med);
  const visitStatus = statusFromDate(visitDeadline, visitAlertDelay);

  const addYears = (dateStr: string | null | undefined, years: number): string | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    d.setFullYear(d.getFullYear() + years);
    return d.toISOString().split('T')[0];
  };

  const passiveAlertDelay = effectiveDelay('dosimetrie_passive', habilitation.delai_alerte_dosimetrie_passive);
  const passiveDeadline = addYears(habilitation.dosimetrie_passive_date, 2);
  const passiveStatus = statusFromDate(passiveDeadline, passiveAlertDelay);

  const operationnelleAlertDelay = effectiveDelay('dosimetrie_operationnelle', habilitation.delai_alerte_dosimetrie_op);
  const operationnelleDeadline = addYears(habilitation.dosimetrie_operationnelle_date, 2);
  const operationnelleStatus = statusFromDate(operationnelleDeadline, operationnelleAlertDelay);

  const dosStatusLabels: Record<string, string> = {
    valide: 'À jour',
    a_prevoir: 'À prévoir',
    en_retard: 'En retard',
    non_applicable: 'Non renseigné',
  };

  const formRpTravAlertDelay = effectiveDelay('formation_rp_travailleur', habilitation.delai_alerte_formation_rp_trav);
  const formRpTravDeadline = habilitation.formation_rp_travailleurs_date
    ? addYears(habilitation.formation_rp_travailleurs_date, 3)
    : null;
  const formRpTravStatus = statusFromDate(formRpTravDeadline, formRpTravAlertDelay);

  const formRpPatAlertDelay = effectiveDelay('formation_rp_patient', habilitation.delai_alerte_formation_rp_pat);
  const formRpPatDeadline = habilitation.formation_rp_patients_date
    ? addYears(habilitation.formation_rp_patients_date, 7)
    : null;
  const formRpPatStatus = statusFromDate(formRpPatDeadline, formRpPatAlertDelay);

  const formStatusLabels: Record<string, string> = {
    valide: 'À jour',
    a_prevoir: 'À prévoir',
    en_retard: 'En retard',
    non_applicable: 'Non renseigné',
  };

  const habItems = [
    {
      id: 'dosimetries',
      icon: Activity,
      title: 'Dosimétrie passive',
      variant: statusToBadgeVariant[passiveStatus],
      label: dosStatusLabels[passiveStatus],
    },
    {
      id: 'dosimetries_op',
      icon: Activity,
      title: 'Dosimétrie opérationnelle',
      variant: statusToBadgeVariant[operationnelleStatus],
      label: dosStatusLabels[operationnelleStatus],
    },
    {
      id: 'formationRpTravailleur',
      icon: GraduationCap,
      title: 'Formation RP travailleurs',
      variant: statusToBadgeVariant[formRpTravStatus],
      label: formStatusLabels[formRpTravStatus],
    },
    {
      id: 'formationRpPatient',
      icon: GraduationCap,
      title: 'Formation RP patients',
      variant: statusToBadgeVariant[formRpPatStatus],
      label: formStatusLabels[formRpPatStatus],
    },
    {
      id: 'visiteMedicale',
      icon: Activity,
      title: 'Visite médicale',
      variant: statusToBadgeVariant[visitStatus],
      label: visitStatusLabels[visitStatus],
    },
  ];
  return (
    <div className="space-y-4">
      <Card>
        <CardHead>
          <CardTitle>Items d'habilitation</CardTitle>
        </CardHead>
        <CardBody className="space-y-0">
          {habItems.map((item, i) => (
            <div
              key={item.id}
              onClick={() => setEditingModal(item.id as EditModalType)}
              className={`flex items-center gap-3.5 px-4 py-3.5 cursor-pointer hover:bg-surface2 transition-colors ${i < habItems.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="w-8 h-8 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-textMuted" />
              </div>
              <div className="flex-1">
                <div className="font-medium">{item.title}</div>
                <div className="text-xs text-textMuted mt-0.5">
                  {item.id === 'dosimetries' && formatDate(habilitation.dosimetrie_passive_date)}
                  {item.id === 'dosimetries_op' && formatDate(habilitation.dosimetrie_operationnelle_date)}
                  {item.id === 'formationRpTravailleur' && formatDate(habilitation.formation_rp_travailleurs_date)}
                  {item.id === 'formationRpPatient' && formatDate(habilitation.formation_rp_patients_date)}
                  {item.id === 'visiteMedicale' && formatDate(habilitation.visite_medicale_date)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={item.variant}>{item.label}</Badge>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      {habilitation && (
        <>
          <EditModalDosimetries
            isOpen={editingModal === 'dosimetries'}
            habilitation={habilitation}
            effectiveDelay={passiveAlertDelay}
            onClose={() => setEditingModal(null)}
            onSave={handleUpdateHabilitation}
            isLoading={isLoadingUpdate}
            travailleurId={travailleurId}
          />
          <EditModalDosimetriesOp
            isOpen={editingModal === 'dosimetries_op'}
            habilitation={habilitation}
            effectiveDelay={operationnelleAlertDelay}
            onClose={() => setEditingModal(null)}
            onSave={handleUpdateHabilitation}
            isLoading={isLoadingUpdate}
            travailleurId={travailleurId}
          />
        </>
      )}

      {habilitation && (
        <>
          <EditModalFormationRp
            isOpen={editingModal === 'formationRpTravailleur'}
            type="travailleur"
            habilitation={habilitation}
            effectiveDelay={formRpTravAlertDelay}
            onClose={() => setEditingModal(null)}
            onSave={handleUpdateHabilitation}
            isLoading={isLoadingUpdate}
            travailleurId={travailleurId}
          />

          <EditModalFormationRp
            isOpen={editingModal === 'formationRpPatient'}
            type="patient"
            habilitation={habilitation}
            effectiveDelay={formRpPatAlertDelay}
            onClose={() => setEditingModal(null)}
            onSave={handleUpdateHabilitation}
            isLoading={isLoadingUpdate}
            travailleurId={travailleurId}
          />

          <EditModalVisiteMedicale
            isOpen={editingModal === 'visiteMedicale'}
            habilitation={habilitation}
            effectiveDelay={visitAlertDelay}
            onClose={() => setEditingModal(null)}
            onSave={handleUpdateHabilitation}
            isLoading={isLoadingUpdate}
            travailleurId={travailleurId}
          />
        </>
      )}

      <AlerteDelaiConfirmModal
        pending={pendingAlerte}
        isLoading={isPropagating}
        onAllWorkers={() => handleAlertePropagate('all')}
        onDefaultOnly={() => handleAlertePropagate('default')}
        onClose={() => setPendingAlerte(null)}
      />

      <Card>
        <CardHead>
          <CardTitle>Appareils assignés</CardTitle>
        </CardHead>
        <CardBody className="space-y-4">
          {appareilsAssignes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {appareilsAssignes.map(appareil => (
                <div
                  key={appareil.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface2 border border-border rounded-full text-[13px] font-medium"
                >
                  <Monitor size={13} className="text-textMuted flex-shrink-0" />
                  <span>{appareil.designation}</span>
                  <button
                    onClick={() => handleRemoveAppareil(appareil.id)}
                    className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-textMuted hover:text-danger hover:bg-dangerBg transition-colors"
                    title="Retirer cet appareil"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[13px] text-textMuted italic">
              Aucun appareil assigné — les compétences propres ne pourront pas être validées.
            </div>
          )}

          {availableAppareils.length > 0 && (
            <>
              <div className="border-t border-border" />
              <div className="space-y-3">
                <label className="block text-[13px] font-semibold text-textMuted">
                  Ajouter des appareils
                </label>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-textMuted pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Rechercher un appareil..."
                    value={appareilSearchQuery}
                    onChange={(e) => setAppareilSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-bg border border-border rounded text-[13px] placeholder:text-textMuted focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto border border-border rounded bg-bg">
                  {availableAppareils
                    .filter(a => a.designation.toLowerCase().includes(appareilSearchQuery.toLowerCase()))
                    .map((appareil, index, filtered) => (
                      <div key={appareil.id}>
                        <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedAppareilIds.includes(appareil.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAppareilIds([...selectedAppareilIds, appareil.id]);
                              } else {
                                setSelectedAppareilIds(selectedAppareilIds.filter(id => id !== appareil.id));
                              }
                            }}
                            className="w-4 h-4 rounded cursor-pointer accent-accent"
                          />
                          <Monitor size={14} className="text-textMuted flex-shrink-0" />
                          <span className="text-[13px] flex-1 min-w-0">{appareil.designation}</span>
                        </label>
                        {index < filtered.length - 1 && <div className="border-b border-border" />}
                      </div>
                    ))}
                  {availableAppareils.filter(a => a.designation.toLowerCase().includes(appareilSearchQuery.toLowerCase())).length === 0 && (
                    <div className="px-3 py-4 text-center text-[13px] text-textMuted">
                      Aucun appareil trouvé
                    </div>
                  )}
                </div>

                <button
                  onClick={handleAddAppareils}
                  disabled={selectedAppareilIds.length === 0}
                  className="w-full px-3 py-2 bg-accent text-white rounded text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  Ajouter {selectedAppareilIds.length > 0 ? `(${selectedAppareilIds.length} sélectionné${selectedAppareilIds.length > 1 ? 's' : ''})` : ''}
                </button>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHead>
          <CardTitle>Compétences générales</CardTitle>
        </CardHead>
        <CardBody className="space-y-4">
          {competencesGenerales.length === 0 ? (
            <div className="text-sm text-textMuted">Aucune compétence générale définie.</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div></div>
                <div className="flex items-center gap-2">
                  <span className="text-textMuted text-xs mono">
                    {validatedGeneralCount}/{competencesGenerales.length}
                  </span>
                  <Badge variant={
                    validatedGeneralCount === competencesGenerales.length ? 'ok' :
                    validatedGeneralCount > 0 ? 'warn' : 'neutral'
                  }>
                    {validatedGeneralCount === competencesGenerales.length ? 'Validé' :
                     validatedGeneralCount > 0 ? 'Partielle' : 'Non validée'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1">
                {competencesGenerales.map((ref) => {
                  const competence = generalCompetences.find(c => c.competence_ref_id === ref.id);
                  const compSt = competenceStatus(competence?.validated, competence?.date_peremption, ref.duree_alerte_mois);

                  const cardClass = compSt === null
                    ? 'bg-surface border-border hover:border-textMuted'
                    : compSt === 'en_retard' ? 'bg-dangerBg border-dangerBorder'
                    : compSt === 'a_prevoir' ? 'bg-warnBg border-warnBorder'
                    : 'bg-okBg border-okBorder';

                  const checkboxClass = compSt === null
                    ? 'bg-white border-borderStrong'
                    : compSt === 'en_retard' ? 'bg-danger border-danger'
                    : compSt === 'a_prevoir' ? 'bg-warn border-warn'
                    : 'bg-ok border-ok';

                  const textClass = compSt === null
                    ? 'text-text'
                    : compSt === 'en_retard' ? 'font-semibold text-danger'
                    : compSt === 'a_prevoir' ? 'font-semibold text-warn'
                    : 'font-semibold text-ok';

                  return (
                    <button
                      key={ref.id}
                      onClick={() => handleClickGeneralCompetence(ref.id, ref.libelle)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded border-1 transition-colors cursor-pointer ${cardClass}`}
                    >
                      <div className={`w-5 h-5 rounded-[3px] border-[1.5px] flex-shrink-0 flex items-center justify-center ${checkboxClass}`}>
                        {compSt !== null && <Check size={10} className="text-white" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className={`text-xs ${textClass}`}>
                          {ref.libelle}
                        </div>
                        {compSt !== null && competence?.date_validation && (
                          <div className="text-xs text-textMuted mt-0.5">
                            {formatDate(competence.date_validation)}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHead>
          <CardTitle>Compétences par appareil</CardTitle>
        </CardHead>
        <CardBody className="space-y-4">
          {appareilsAssignes.length === 0 ? (
            <div className="text-sm text-textMuted">Aucun appareil assigné — assignez-en via la section « Appareils assignés ».</div>
          ) : (
            appareilsAssignes.map((appareil, idx) => (
              <div key={appareil.id} className={idx > 0 ? 'border-t border-border pt-4' : ''}>
                <button
                  onClick={() => navigate(`/appareils/${appareil.id}`)}
                  className="flex items-center gap-1 text-[12px] font-semibold text-textMuted uppercase tracking-wide mb-3 hover:text-text transition-colors group"
                >
                  {appareil.designation}
                  <ArrowUpRight size={11} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <CompetencesAppareilSubsheet
                  appareilId={appareil.id}
                  travailleurId={travailleurId}
                />
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {editingGeneralComp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-lg shadow-lg w-80 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold">
                {editingGeneralComp.isValidated ? 'Modifier la validation' : 'Valider la compétence'}
              </h2>
              <button onClick={() => setEditingGeneralComp(null)} className="text-textMuted hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-textMuted mb-4">{editingGeneralComp.libelle}</p>
            <div className="space-y-4">
              <Field>
                <Label>Date de validation</Label>
                <Input
                  type="date"
                  value={editGeneralDate}
                  onChange={(e) => setEditGeneralDate(e.target.value)}
                />
              </Field>
              <div className="flex gap-2 justify-end mt-2">
                {editingGeneralComp.isValidated && (
                  <Button
                    variant="dangerGhost"
                    onClick={handleInvalidateGeneralComp}
                  >
                    Invalider
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setEditingGeneralComp(null)}>
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveGeneralComp}
                  disabled={!editGeneralDate}
                >
                  {editingGeneralComp.isValidated ? 'Mettre à jour' : 'Valider'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type SaveWithAlerte = (
  input: Parameters<typeof api.habilitation.update>[0],
  alerte?: { itemType: string; itemLabel: string; oldDelai: number; newDelai: number },
) => Promise<void>;

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: SaveWithAlerte;
  isLoading: boolean;
  travailleurId: number;
  habilitation: Habilitation;
  effectiveDelay: number;
}

function EditModalDosimetries({ isOpen, habilitation, onClose, onSave, isLoading, travailleurId, effectiveDelay }: EditModalProps) {
  const [passiveDate, setPassiveDate] = useState('');
  const [delaiAlerte, setDelaiAlerte] = useState(effectiveDelay);

  useEffect(() => {
    if (isOpen) {
      setPassiveDate(habilitation?.dosimetrie_passive_date || '');
      setDelaiAlerte(effectiveDelay);
    }
  }, [isOpen, habilitation?.dosimetrie_passive_date, effectiveDelay]);

  const handleSave = async () => {
    await onSave(
      { travailleurId, dosimetriePassiveDate: passiveDate || null, delaiAlerteDosimetriePassive: delaiAlerte },
      { itemType: 'dosimetrie_passive', itemLabel: 'Dosimétrie passive', oldDelai: effectiveDelay, newDelai: delaiAlerte },
    );
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter' && !isLoading) handleSave();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose, passiveDate, delaiAlerte, isLoading]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg shadow-lg w-96 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Dosimétrie passive</h2>
          <button onClick={onClose} className="text-textMuted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <Field>
            <Label>Date de validation</Label>
            <Input
              type="date"
              value={passiveDate}
              onChange={(e) => setPassiveDate(e.target.value)}
            />
            <p className="text-xs text-textMuted mt-1">Renouvellement tous les 2 ans</p>
          </Field>

          <DelaiAlerteField value={delaiAlerte} onChange={setDelaiAlerte} />

          <div className="flex gap-2 justify-end mt-6">
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>
              Annuler
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditModalDosimetriesOp({ isOpen, habilitation, onClose, onSave, isLoading, travailleurId, effectiveDelay }: EditModalProps) {
  const [operationnelleDate, setOperationnelleDate] = useState('');
  const [delaiAlerte, setDelaiAlerte] = useState(effectiveDelay);

  useEffect(() => {
    if (isOpen) {
      setOperationnelleDate(habilitation?.dosimetrie_operationnelle_date || '');
      setDelaiAlerte(effectiveDelay);
    }
  }, [isOpen, habilitation?.dosimetrie_operationnelle_date, effectiveDelay]);

  const handleSave = async () => {
    await onSave(
      { travailleurId, dosimetrieOperationnelleDate: operationnelleDate || null, delaiAlerteDosimetrieOp: delaiAlerte },
      { itemType: 'dosimetrie_operationnelle', itemLabel: 'Dosimétrie opérationnelle', oldDelai: effectiveDelay, newDelai: delaiAlerte },
    );
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter' && !isLoading) handleSave();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose, operationnelleDate, delaiAlerte, isLoading]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg shadow-lg w-96 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Dosimétrie opérationnelle</h2>
          <button onClick={onClose} className="text-textMuted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <Field>
            <Label>Date de validation</Label>
            <Input
              type="date"
              value={operationnelleDate}
              onChange={(e) => setOperationnelleDate(e.target.value)}
            />
            <p className="text-xs text-textMuted mt-1">Renouvellement tous les 2 ans</p>
          </Field>

          <DelaiAlerteField value={delaiAlerte} onChange={setDelaiAlerte} />

          <div className="flex gap-2 justify-end mt-6">
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>
              Annuler
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditModalFormationRp({
  isOpen,
  type,
  habilitation,
  onClose,
  onSave,
  isLoading,
  travailleurId,
  effectiveDelay,
}: {
  isOpen: boolean;
  type: 'travailleur' | 'patient';
  habilitation: Habilitation;
  onClose: () => void;
  onSave: SaveWithAlerte;
  isLoading: boolean;
  travailleurId: number;
  effectiveDelay: number;
}) {
  const [date, setDate] = useState('');
  const [delaiAlerte, setDelaiAlerte] = useState(effectiveDelay);

  useEffect(() => {
    if (isOpen) {
      const currentDate = type === 'travailleur' ? habilitation?.formation_rp_travailleurs_date || '' : habilitation?.formation_rp_patients_date || '';
      setDate(currentDate);
      setDelaiAlerte(effectiveDelay);
    }
  }, [isOpen, type, habilitation?.formation_rp_travailleurs_date, habilitation?.formation_rp_patients_date, effectiveDelay]);

  const handleSave = async () => {
    const isTrav = type === 'travailleur';
    const input: Parameters<typeof api.habilitation.update>[0] = {
      travailleurId,
      ...(isTrav
        ? { formationRpTravailleursDate: date || null, delaiAlerteFormationRpTrav: delaiAlerte }
        : { formationRpPatientsDate: date || null, delaiAlerteFormationRpPat: delaiAlerte }),
    };
    const itemType = isTrav ? 'formation_rp_travailleur' : 'formation_rp_patient';
    const itemLabel = isTrav ? 'Formation RP travailleurs' : 'Formation RP patients';
    await onSave(input, { itemType, itemLabel, oldDelai: effectiveDelay, newDelai: delaiAlerte });
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter' && !isLoading) handleSave();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose, date, delaiAlerte, type, isLoading]);

  if (!isOpen) return null;

  const title = type === 'travailleur' ? 'Formation RP travailleurs' : 'Formation RP patients';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg shadow-lg w-96 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Éditer {title}</h2>
          <button onClick={onClose} className="text-textMuted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <Field>
            <Label>Date de validation</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <p className="text-xs text-textMuted mt-1">
              Renouvellement tous les {type === 'travailleur' ? '3 ans' : '7 ans'}
            </p>
          </Field>

          <DelaiAlerteField value={delaiAlerte} onChange={setDelaiAlerte} />

          <div className="flex gap-2 justify-end mt-6">
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>
              Annuler
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VisiteMedicaleModeduree({
  habilitation,
  onSave,
  isLoading,
  travailleurId,
  effectiveDelay,
}: {
  habilitation: Habilitation;
  onSave: SaveWithAlerte;
  isLoading: boolean;
  travailleurId: number;
  effectiveDelay: number;
}) {
  const [visitDate, setVisitDate] = useState('');
  const [months, setMonths] = useState(12);
  const [delaiAlerte, setDelaiAlerte] = useState(effectiveDelay);

  useEffect(() => {
    setVisitDate(habilitation?.visite_medicale_date || '');
    setMonths(habilitation?.visite_medicale_duree_mois || 12);
    setDelaiAlerte(effectiveDelay);
  }, [habilitation?.visite_medicale_date, habilitation?.visite_medicale_duree_mois, effectiveDelay]);

  const calculateExpiration = (visitDate: string, months: number): string => {
    const date = new Date(visitDate);
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split('T')[0];
  };

  const expirationDate = visitDate ? calculateExpiration(visitDate, months) : '';

  const handleSave = async () => {
    await onSave(
      { travailleurId, visiteMedicaleDate: visitDate || null, visiteMedicaleDureeMois: months, visiteMedicaleDatePeremption: null, delaiAlerteVisiteMed: delaiAlerte },
      { itemType: 'visite_medicale', itemLabel: 'Visite médicale', oldDelai: effectiveDelay, newDelai: delaiAlerte },
    );
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isLoading && visitDate) handleSave();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitDate, delaiAlerte, isLoading]);

  return (
    <div className="space-y-4">
      <Field>
        <Label>Date de visite <span className="text-danger">*</span></Label>
        <Input
          type="date"
          value={visitDate}
          onChange={(e) => setVisitDate(e.target.value)}
        />
        {!visitDate && (
          <p className="text-xs text-textMuted">La date de visite est requise pour enregistrer.</p>
        )}
      </Field>

      <Field>
        <Label>Durée (mois)</Label>
        <Input
          type="number"
          value={months}
          onChange={(e) => setMonths(parseInt(e.target.value) || 12)}
          min="1"
          max="60"
        />
      </Field>

      {expirationDate && (
        <Field>
          <Label>Péremption calculée</Label>
          <Input
            type="text"
            value={expirationDate}
            disabled
            className="bg-surfaceHover"
          />
        </Field>
      )}

      <DelaiAlerteField value={delaiAlerte} onChange={setDelaiAlerte} />

      <Button
        variant="primary"
        onClick={handleSave}
        disabled={isLoading || !visitDate}
        className="w-full"
      >
        {isLoading ? 'Enregistrement...' : 'Enregistrer'}
      </Button>
    </div>
  );
}

function VisiteMedicaleModeDateDirecte({
  habilitation,
  onSave,
  isLoading,
  travailleurId,
  effectiveDelay,
}: {
  habilitation: Habilitation;
  onSave: SaveWithAlerte;
  isLoading: boolean;
  travailleurId: number;
  effectiveDelay: number;
}) {
  const [visitDate, setVisitDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [delaiAlerte, setDelaiAlerte] = useState(effectiveDelay);

  useEffect(() => {
    setVisitDate(habilitation?.visite_medicale_date || '');
    setExpirationDate(habilitation?.visite_medicale_date_peremption || '');
    setDelaiAlerte(effectiveDelay);
  }, [habilitation?.visite_medicale_date, habilitation?.visite_medicale_date_peremption, effectiveDelay]);

  const handleSave = async () => {
    await onSave(
      { travailleurId, visiteMedicaleDate: visitDate || null, visiteMedicaleDureeMois: null, visiteMedicaleDatePeremption: expirationDate || null, delaiAlerteVisiteMed: delaiAlerte },
      { itemType: 'visite_medicale', itemLabel: 'Visite médicale', oldDelai: effectiveDelay, newDelai: delaiAlerte },
    );
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isLoading && visitDate && expirationDate) handleSave();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitDate, expirationDate, delaiAlerte, isLoading]);

  return (
    <div className="space-y-4">
      <Field>
        <Label>Date de visite <span className="text-danger">*</span></Label>
        <Input
          type="date"
          value={visitDate}
          onChange={(e) => setVisitDate(e.target.value)}
        />
        {!visitDate && (
          <p className="text-xs text-textMuted">La date de visite est requise.</p>
        )}
      </Field>

      <Field>
        <Label>Date de péremption <span className="text-danger">*</span></Label>
        <Input
          type="date"
          value={expirationDate}
          onChange={(e) => setExpirationDate(e.target.value)}
        />
        {!expirationDate && (
          <p className="text-xs text-textMuted">La date de péremption est requise.</p>
        )}
      </Field>

      <DelaiAlerteField value={delaiAlerte} onChange={setDelaiAlerte} />

      <Button
        variant="primary"
        onClick={handleSave}
        disabled={isLoading || !visitDate || !expirationDate}
        className="w-full"
      >
        {isLoading ? 'Enregistrement...' : 'Enregistrer'}
      </Button>
    </div>
  );
}

function EditModalVisiteMedicale({ isOpen, habilitation, onClose, onSave, isLoading, travailleurId, effectiveDelay }: EditModalProps) {
  const [mode, setMode] = useState<VisiteMedicaleMode>(
    habilitation?.visite_medicale_date_peremption ? 'dateDirecte' : 'duree'
  );

  useEffect(() => {
    if (isOpen) {
      setMode(habilitation?.visite_medicale_date_peremption ? 'dateDirecte' : 'duree');
    }
  }, [isOpen, habilitation?.visite_medicale_date_peremption]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg shadow-lg w-[480px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Éditer Visite médicale</h2>
          <button onClick={onClose} className="text-textMuted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={mode === 'duree'} onChange={() => setMode('duree')} className="w-4 h-4" />
              <span className="text-sm">Durée + calcul auto</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={mode === 'dateDirecte'} onChange={() => setMode('dateDirecte')} className="w-4 h-4" />
              <span className="text-sm">Date de péremption directe</span>
            </label>
          </div>
          {mode === 'duree' ? (
            <VisiteMedicaleModeduree
              habilitation={habilitation}
              onSave={async (input, alerte) => { await onSave(input, alerte); onClose(); }}
              isLoading={isLoading}
              travailleurId={travailleurId}
              effectiveDelay={effectiveDelay}
            />
          ) : (
            <VisiteMedicaleModeDateDirecte
              habilitation={habilitation}
              onSave={async (input, alerte) => { await onSave(input, alerte); onClose(); }}
              isLoading={isLoading}
              travailleurId={travailleurId}
              effectiveDelay={effectiveDelay}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DelaiAlerteField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="border-t border-border pt-4">
      <Field>
        <Label>Délai d'alerte "À prévoir" (mois)</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={value}
            onChange={(e) => onChange(Math.max(1, Math.min(120, parseInt(e.target.value) || 1)))}
            min="1"
            max="120"
            className="w-24"
          />
          <span className="text-xs text-textMuted">
            mois avant expiration
          </span>
        </div>
        <p className="text-xs text-textMuted mt-1">
          L'item passera en orange «&nbsp;À prévoir&nbsp;» {value} mois avant sa date d'expiration.
        </p>
      </Field>
    </div>
  );
}

function AlerteDelaiConfirmModal({
  pending,
  isLoading,
  onAllWorkers,
  onDefaultOnly,
  onClose,
}: {
  pending: PendingAlerte | null;
  isLoading: boolean;
  onAllWorkers: () => void;
  onDefaultOnly: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!pending) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pending, onClose]);

  if (!pending) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-surface rounded-lg shadow-lg w-[480px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Délai d'alerte modifié</h2>
          <button onClick={onClose} className="text-textMuted hover:text-text" disabled={isLoading}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-textMuted">
            Vous avez changé le délai d'alerte «&nbsp;À prévoir&nbsp;» pour&nbsp;
            <span className="font-medium text-text">{pending.itemLabel}</span>&nbsp;:
            de <span className="font-medium text-text">{pending.oldDelai} mois</span> à&nbsp;
            <span className="font-medium text-text">{pending.newDelai} mois</span>.
          </p>
          <p className="text-sm text-textMuted">
            Souhaitez-vous appliquer ce nouveau délai à&nbsp;:
          </p>

          <div className="space-y-3">
            <button
              onClick={onAllWorkers}
              disabled={isLoading}
              className="w-full flex items-start gap-4 p-4 rounded-lg border border-border hover:border-accent hover:bg-surface2 transition-colors text-left disabled:opacity-50"
            >
              <div className="w-9 h-9 rounded-full bg-accentSoft flex items-center justify-center flex-shrink-0 mt-0.5">
                <Users className="w-4 h-4 text-accent" />
              </div>
              <div>
                <div className="font-semibold text-sm">Tous les travailleurs</div>
                <div className="text-xs text-textMuted mt-0.5">
                  Ce délai s'appliquera immédiatement à tous les travailleurs pour cet item. Les délais personnalisés existants seront réinitialisés.
                </div>
              </div>
            </button>

            <button
              onClick={onDefaultOnly}
              disabled={isLoading}
              className="w-full flex items-start gap-4 p-4 rounded-lg border border-border hover:border-accent hover:bg-surface2 transition-colors text-left disabled:opacity-50"
            >
              <div className="w-9 h-9 rounded-full bg-warnBg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Star className="w-4 h-4 text-warn" />
              </div>
              <div>
                <div className="font-semibold text-sm">Nouveau délai par défaut uniquement</div>
                <div className="text-xs text-textMuted mt-0.5">
                  Ce délai sera utilisé par défaut pour les nouveaux items. Les travailleurs avec un délai personnalisé conservent le leur.
                </div>
              </div>
            </button>
          </div>

          {isLoading && (
            <p className="text-xs text-textMuted text-center">Mise à jour en cours…</p>
          )}
        </div>
      </div>
    </div>
  );
}
