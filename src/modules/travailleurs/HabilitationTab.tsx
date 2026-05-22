import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { statusFromDate, statusToBadgeVariant } from '../../lib/status';
import { Card, CardBody, CardHead, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input, Label } from '../../components/ui/FormField';
import { Activity, GraduationCap, X, Check, Monitor, Search } from 'lucide-react';
import type { Habilitation } from '../../types/domain';
import CompetencesAppareilSubsheet from './CompetencesAppareilSubsheet';

interface HabilitationTabProps {
  travailleurId: number;
}

type EditModalType = 'dosimetries' | 'formationRpTravailleur' | 'formationRpPatient' | 'visiteMedicale' | null;
type VisiteMedicaleMode = 'duree' | 'dateDirecte';

export default function HabilitationTab({ travailleurId }: HabilitationTabProps) {
  const queryClient = useQueryClient();
  const [editingModal, setEditingModal] = useState<EditModalType>(null);
  const [isLoadingUpdate, setIsLoadingUpdate] = useState(false);
  const [selectedAppareilIds, setSelectedAppareilIds] = useState<number[]>([]);
  const [appareilSearchQuery, setAppareilSearchQuery] = useState('');

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


  if (!habStatus || !travailleur || !habilitation) {
    return (
      <div className="flex items-center justify-center py-12 text-textMuted text-sm">
        Chargement de l'habilitation…
      </div>
    );
  }

  const details = habStatus.details;
  const appareilsAssignes = appareils.filter(a => travailleurAppareils.includes(a.id));
  const assignedSet = new Set(travailleurAppareils);
  const availableAppareils = appareils.filter(
    a => !assignedSet.has(a.id)
  );
  const competencesGenerales = competenceRefs.filter(c => c.propre_appareil === 0);

  const handleUpdateHabilitation = async (input: Parameters<typeof api.habilitation.update>[0]) => {
    try {
      setIsLoadingUpdate(true);
      await api.habilitation.update(input);
      queryClient.invalidateQueries({ queryKey: ['habilitation', travailleurId] });
      queryClient.invalidateQueries({ queryKey: ['habilitationRaw', travailleurId] });
      setEditingModal(null);
    } finally {
      setIsLoadingUpdate(false);
    }
  };

  const handleToggleGeneralCompetence = async (competenceRefId: number) => {
    const existing = generalCompetences.find(c => c.competence_ref_id === competenceRefId);
    await api.competence.generalSet({
      travailleurId,
      competenceRefId,
      dateValidation: new Date().toISOString().slice(0, 10),
      validated: existing?.validated === 1 ? 0 : 1,
    });
    queryClient.invalidateQueries({ queryKey: ['competenceGeneral', travailleurId] });
    queryClient.invalidateQueries({ queryKey: ['habilitation', travailleurId] });
    queryClient.invalidateQueries({ queryKey: ['habilitationRaw', travailleurId] });
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

  const boolVariant = (ok: boolean): 'ok' | 'danger' => ok ? 'ok' : 'danger';

  const visitStatusLabels: Record<string, string> = {
    valide: 'Validé',
    a_prevoir: 'À prévoir',
    en_retard: 'Invalide',
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
  const visitStatus = statusFromDate(visitDeadline, 3);

  const habItems = [
    {
      id: 'dosimetries',
      icon: Activity,
      title: 'Dosimétries',
      variant: boolVariant(details.dosimetries_ok),
      label: details.dosimetries_ok ? 'Validé' : 'Invalide',
    },
    {
      id: 'formationRpTravailleur',
      icon: GraduationCap,
      title: 'Formation RP travailleurs',
      variant: boolVariant(details.formation_rp_ok),
      label: details.formation_rp_ok ? 'Validé' : 'Invalide',
    },
    {
      id: 'formationRpPatient',
      icon: GraduationCap,
      title: 'Formation RP patients',
      variant: boolVariant(details.formation_rp_patients_ok),
      label: details.formation_rp_patients_ok ? 'Validé' : 'Invalide',
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
                  {item.id === 'dosimetries' && (
                    <>
                      Passive: {formatDate(habilitation.dosimetrie_passive_date)} • Opérationnelle: {formatDate(habilitation.dosimetrie_operationnelle_date)}
                    </>
                  )}
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
        <EditModalDosimetries
          isOpen={editingModal === 'dosimetries'}
          habilitation={habilitation}
          onClose={() => setEditingModal(null)}
          onSave={handleUpdateHabilitation}
          isLoading={isLoadingUpdate}
          travailleurId={travailleurId}
        />
      )}

      {habilitation && (
        <>
          <EditModalFormationRp
            isOpen={editingModal === 'formationRpTravailleur'}
            type="travailleur"
            habilitation={habilitation}
            onClose={() => setEditingModal(null)}
            onSave={handleUpdateHabilitation}
            isLoading={isLoadingUpdate}
            travailleurId={travailleurId}
          />

          <EditModalFormationRp
            isOpen={editingModal === 'formationRpPatient'}
            type="patient"
            habilitation={habilitation}
            onClose={() => setEditingModal(null)}
            onSave={handleUpdateHabilitation}
            isLoading={isLoadingUpdate}
            travailleurId={travailleurId}
          />

          <EditModalVisiteMedicale
            isOpen={editingModal === 'visiteMedicale'}
            habilitation={habilitation}
            onClose={() => setEditingModal(null)}
            onSave={handleUpdateHabilitation}
            isLoading={isLoadingUpdate}
            travailleurId={travailleurId}
          />
        </>
      )}

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
                    {generalCompetences.filter(c => c.validated === 1).length}/{competencesGenerales.length}
                  </span>
                  <Badge variant={
                    generalCompetences.filter(c => c.validated === 1).length === competencesGenerales.length ? 'ok' :
                    generalCompetences.filter(c => c.validated === 1).length > 0 ? 'warn' : 'neutral'
                  }>
                    {generalCompetences.filter(c => c.validated === 1).length === competencesGenerales.length ? 'Validé' :
                     generalCompetences.filter(c => c.validated === 1).length > 0 ? 'Partielle' : 'Non validée'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1">
                {competencesGenerales.map((ref) => {
                  const competence = generalCompetences.find(c => c.competence_ref_id === ref.id);
                  const checked = competence?.validated === 1;

                  return (
                    <button
                      key={ref.id}
                      onClick={() => handleToggleGeneralCompetence(ref.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded border-1 transition-colors cursor-pointer ${
                        checked
                          ? 'bg-okBg border-okBorder'
                          : 'bg-surface border-border hover:border-textMuted'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-[3px] border-[1.5px] flex-shrink-0 flex items-center justify-center ${
                          checked
                            ? 'bg-ok border-ok'
                            : 'bg-white border-borderStrong'
                        }`}
                      >
                        {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className={`text-xs ${checked ? 'font-semibold text-ok' : 'text-text'}`}>
                          {ref.libelle}
                        </div>
                        {checked && competence?.date_validation && (
                          <div className="text-xs text-textMuted mt-0.5">
                            Validé: {formatDate(competence.date_validation)}
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
                <div className="text-[12px] font-semibold text-textMuted uppercase tracking-wide mb-3">
                  {appareil.designation}
                </div>
                <CompetencesAppareilSubsheet
                  appareilId={appareil.id}
                  travailleurId={travailleurId}
                />
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: Parameters<typeof api.habilitation.update>[0]) => Promise<void>;
  isLoading: boolean;
  travailleurId: number;
  habilitation: Habilitation;
}

function EditModalDosimetries({ isOpen, habilitation, onClose, onSave, isLoading, travailleurId }: EditModalProps) {
  const [passiveDate, setPassiveDate] = useState('');
  const [operationnelleDate, setOperationnelleDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPassiveDate(habilitation?.dosimetrie_passive_date || '');
      setOperationnelleDate(habilitation?.dosimetrie_operationnelle_date || '');
    }
  }, [isOpen, habilitation?.dosimetrie_passive_date, habilitation?.dosimetrie_operationnelle_date]);

  const handleSave = async () => {
    await onSave({
      travailleurId,
      dosimetriePassiveDate: passiveDate || null,
      dosimetrieOperationnelleDate: operationnelleDate || null,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg shadow-lg w-96 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Éditer Dosimétries</h2>
          <button onClick={onClose} className="text-textMuted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <Field>
            <Label>Dosimétrie passive</Label>
            <Input
              type="date"
              value={passiveDate}
              onChange={(e) => setPassiveDate(e.target.value)}
            />
          </Field>

          <Field>
            <Label>Dosimétrie opérationnelle</Label>
            <Input
              type="date"
              value={operationnelleDate}
              onChange={(e) => setOperationnelleDate(e.target.value)}
            />
          </Field>

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
}: {
  isOpen: boolean;
  type: 'travailleur' | 'patient';
  habilitation: Habilitation;
  onClose: () => void;
  onSave: (input: Parameters<typeof api.habilitation.update>[0]) => Promise<void>;
  isLoading: boolean;
  travailleurId: number;
}) {
  const [date, setDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      const currentDate = type === 'travailleur' ? habilitation?.formation_rp_travailleurs_date || '' : habilitation?.formation_rp_patients_date || '';
      setDate(currentDate);
    }
  }, [isOpen, type, habilitation?.formation_rp_travailleurs_date, habilitation?.formation_rp_patients_date]);

  const handleSave = async () => {
    const input: Parameters<typeof api.habilitation.update>[0] = {
      travailleurId,
      ...(type === 'travailleur' ? { formationRpTravailleursDate: date || null } : { formationRpPatientsDate: date || null }),
    };
    await onSave(input);
  };

  if (!isOpen) return null;

  const title = type === 'travailleur' ? 'Formation RP travailleurs' : 'Formation RP patients';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
}: {
  habilitation: Habilitation;
  onSave: (input: Parameters<typeof api.habilitation.update>[0]) => Promise<void>;
  isLoading: boolean;
  travailleurId: number;
}) {
  const [visitDate, setVisitDate] = useState('');
  const [months, setMonths] = useState(12);

  useEffect(() => {
    setVisitDate(habilitation?.visite_medicale_date || '');
    setMonths(habilitation?.visite_medicale_duree_mois || 12);
  }, [habilitation?.visite_medicale_date, habilitation?.visite_medicale_duree_mois]);

  const calculateExpiration = (visitDate: string, months: number): string => {
    const date = new Date(visitDate);
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split('T')[0];
  };

  const expirationDate = visitDate ? calculateExpiration(visitDate, months) : '';

  const handleSave = async () => {
    await onSave({
      travailleurId,
      visiteMedicaleDate: visitDate || null,
      visiteMedicaleDureeMois: months,
      visiteMedicaleDatePeremption: null,
    });
  };

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
}: {
  habilitation: Habilitation;
  onSave: (input: Parameters<typeof api.habilitation.update>[0]) => Promise<void>;
  isLoading: boolean;
  travailleurId: number;
}) {
  const [visitDate, setVisitDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');

  useEffect(() => {
    setVisitDate(habilitation?.visite_medicale_date || '');
    setExpirationDate(habilitation?.visite_medicale_date_peremption || '');
  }, [habilitation?.visite_medicale_date, habilitation?.visite_medicale_date_peremption]);

  const handleSave = async () => {
    await onSave({
      travailleurId,
      visiteMedicaleDate: visitDate || null,
      visiteMedicaleDureeMois: null,
      visiteMedicaleDatePeremption: expirationDate || null,
    });
  };

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

function EditModalVisiteMedicale({ isOpen, habilitation, onClose, onSave, isLoading, travailleurId }: EditModalProps) {
  const [mode, setMode] = useState<VisiteMedicaleMode>(
    habilitation?.visite_medicale_date_peremption ? 'dateDirecte' : 'duree'
  );

  useEffect(() => {
    if (isOpen) {
      setMode(habilitation?.visite_medicale_date_peremption ? 'dateDirecte' : 'duree');
    }
  }, [isOpen, habilitation?.visite_medicale_date_peremption]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
              onSave={async (input) => { await onSave(input); onClose(); }}
              isLoading={isLoading}
              travailleurId={travailleurId}
            />
          ) : (
            <VisiteMedicaleModeDateDirecte
              habilitation={habilitation}
              onSave={async (input) => { await onSave(input); onClose(); }}
              isLoading={isLoading}
              travailleurId={travailleurId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
