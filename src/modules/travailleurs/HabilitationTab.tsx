import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody, CardHead, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input, Label } from '../../components/ui/FormField';
import { Activity, GraduationCap, X, Check } from 'lucide-react';
import type { Habilitation } from '../../types/domain';
import CompetencesAppareilSubsheet from './CompetencesAppareilSubsheet';

interface HabilitationTabProps {
  travailleurId: number;
}

type EditModalType = 'dosimetries' | 'formationRpTravailleur' | 'formationRpPatient' | null;
type VisiteMedicaleMode = 'duree' | 'dateDirecte';

export default function HabilitationTab({ travailleurId }: HabilitationTabProps) {
  const queryClient = useQueryClient();
  const [editingModal, setEditingModal] = useState<EditModalType>(null);
  const [isLoadingUpdate, setIsLoadingUpdate] = useState(false);
  const [visiteMedicaleEditMode, setVisiteMedicaleEditMode] = useState<VisiteMedicaleMode>('duree');

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
    queryKey: ['competence_list'],
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

  useEffect(() => {
    if (habilitation?.visite_medicale_date_peremption !== null && habilitation?.visite_medicale_date_peremption !== undefined) {
      setVisiteMedicaleEditMode('dateDirecte');
    } else {
      setVisiteMedicaleEditMode('duree');
    }
  }, [habilitation?.visite_medicale_date_peremption]);

  if (!habStatus || !travailleur || !habilitation) {
    return null;
  }

  const details = habStatus.details;
  const appareilsAssignes = appareils.filter(a => travailleurAppareils.includes(a.id));
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
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Non validé';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  const calculateExpirationDate = (visitDate: string, months: number): string => {
    const date = new Date(visitDate);
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split('T')[0];
  };

  const getVisiteMedicaleStatus = () => {
    const today = new Date();
    let expirationDate: Date | null = null;

    if (habilitation.visite_medicale_date_peremption) {
      expirationDate = new Date(habilitation.visite_medicale_date_peremption);
    } else if (habilitation.visite_medicale_date && habilitation.visite_medicale_duree_mois) {
      const calculated = calculateExpirationDate(
        habilitation.visite_medicale_date,
        habilitation.visite_medicale_duree_mois
      );
      expirationDate = new Date(calculated);
    }

    if (!expirationDate) return { status: 'Non renseigné', variant: 'neutral' as const };
    if (today <= expirationDate) return { status: 'Validé', variant: 'ok' as const };
    return { status: 'En retard', variant: 'danger' as const };
  };

  const habItems = [
    {
      id: 'dosimetries',
      icon: Activity,
      title: 'Dosimétries',
      ok: details.dosimetries_ok,
    },
    {
      id: 'formationRpTravailleur',
      icon: GraduationCap,
      title: 'Formation RP travailleurs',
      ok: details.formation_rp_ok,
    },
    {
      id: 'formationRpPatient',
      icon: GraduationCap,
      title: 'Formation RP patients',
      ok: details.formation_rp_ok,
    },
  ];

  const visiteMedicaleStatus = getVisiteMedicaleStatus();
  const visiteMedicaleMode: VisiteMedicaleMode =
    habilitation?.visite_medicale_date_peremption !== null && habilitation?.visite_medicale_date_peremption !== undefined ? 'dateDirecte' : 'duree';

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
              className={`flex items-center gap-3.5 px-4 py-3.5 ${i < habItems.length - 1 ? 'border-b border-border' : ''}`}
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
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingModal(item.id as EditModalType)}
                >
                  Éditer
                </Button>
                <Badge variant={item.ok ? 'ok' : 'neutral'}>
                  {item.ok ? 'Validé' : 'Non validé'}
                </Badge>
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
        </>
      )}

      <Card>
        <CardHead>
          <CardTitle>Visite médicale</CardTitle>
        </CardHead>
        <CardBody className="space-y-4">
          <div className="space-y-3">
            <Label>Mode de saisie</Label>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="modeduree"
                  value="duree"
                  checked={visiteMedicaleEditMode === 'duree'}
                  onChange={(e) => e.target.checked && setVisiteMedicaleEditMode('duree')}
                  className="w-4 h-4 cursor-pointer"
                />
                <label htmlFor="modeduree" className="text-sm cursor-pointer">Durée + calcul auto</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="modedatedirecte"
                  value="dateDirecte"
                  checked={visiteMedicaleEditMode === 'dateDirecte'}
                  onChange={(e) => e.target.checked && setVisiteMedicaleEditMode('dateDirecte')}
                  className="w-4 h-4 cursor-pointer"
                />
                <label htmlFor="modedatedirecte" className="text-sm cursor-pointer">Date de péremption directe</label>
              </div>
            </div>
          </div>

          {habilitation && (
            <>
              {visiteMedicaleEditMode === 'duree' ? (
                <VisiteMedicaleModeduree
                  habilitation={habilitation}
                  onSave={handleUpdateHabilitation}
                  isLoading={isLoadingUpdate}
                  travailleurId={travailleurId}
                />
              ) : (
                <VisiteMedicaleModeDateDirecte
                  habilitation={habilitation}
                  onSave={handleUpdateHabilitation}
                  isLoading={isLoadingUpdate}
                  travailleurId={travailleurId}
                />
              )}

              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-textMuted">Statut</div>
                    <div className="text-sm font-medium mt-1">
                      {habilitation.visite_medicale_date ? (
                        <>
                          {`Visite: ${formatDate(habilitation.visite_medicale_date)} • `}
                          {visiteMedicaleMode === 'duree' && habilitation.visite_medicale_duree_mois ? (
                            <>
                              {`Péremption calculée: ${calculateExpirationDate(habilitation.visite_medicale_date, habilitation.visite_medicale_duree_mois)}`}
                            </>
                          ) : habilitation.visite_medicale_date_peremption ? (
                            `Péremption: ${formatDate(habilitation.visite_medicale_date_peremption)}`
                          ) : (
                            'Péremption non définie'
                          )}
                        </>
                      ) : (
                        'Aucune visite enregistrée'
                      )}
                    </div>
                  </div>
                  <Badge variant={visiteMedicaleStatus.variant}>
                    {visiteMedicaleStatus.status}
                  </Badge>
                </div>
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
            <div className="text-sm text-textMuted">Aucun appareil assigné — assignation depuis l'onglet Données personnelles.</div>
          ) : (
            appareilsAssignes.map((appareil) => (
              <CompetencesAppareilSubsheet
                key={appareil.id}
                appareilId={appareil.id}
                travailleurId={travailleurId}
              />
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
        <Label>Date de visite</Label>
        <Input
          type="date"
          value={visitDate}
          onChange={(e) => setVisitDate(e.target.value)}
        />
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
        <Label>Date de visite</Label>
        <Input
          type="date"
          value={visitDate}
          onChange={(e) => setVisitDate(e.target.value)}
        />
      </Field>

      <Field>
        <Label>Date de péremption</Label>
        <Input
          type="date"
          value={expirationDate}
          onChange={(e) => setExpirationDate(e.target.value)}
        />
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
