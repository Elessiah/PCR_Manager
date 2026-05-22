import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { statusFromDate, statusToBadgeVariant } from '../../lib/status';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody, CardHead, CardTitle } from '../../components/ui/Card';
import { PageHead } from '../../components/ui/PageHead';
import { ReadField } from '../../components/ui/ReadField';
import { Field, Label, Input, Select } from '../../components/ui/FormField';
import { ChevronLeft, Edit, Plus, Calendar, X, Check, Trash2, Users } from 'lucide-react';
import type { StatusColor } from '../../lib/status';

function VerifRow({ label, sub, last, dateLast, dateDeadline, status }: {
  label: string; sub: string; last: boolean;
  dateLast: string | null | undefined; dateDeadline: string | null | undefined;
  status: StatusColor;
}) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '–';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  return (
    <div className="grid items-center gap-6 py-3.5" style={{ gridTemplateColumns: '1fr auto auto auto', borderBottom: last ? '0' : '1px solid var(--border)' }}>
      <div>
        <div className="font-semibold text-[14px]">{label}</div>
        <div className="text-textSoft text-[12.5px] mt-px">{sub}</div>
      </div>
      <div>
        <div className="text-[11px] font-semibold text-textSoft uppercase tracking-[0.05em]">Dernier</div>
        <div className="font-mono text-[13px]">{formatDate(dateLast)}</div>
      </div>
      <div>
        <div className="text-[11px] font-semibold text-textSoft uppercase tracking-[0.05em]">Échéance</div>
        <div className="font-mono text-[13px]">{formatDate(dateDeadline)}</div>
      </div>
      <Badge variant={statusToBadgeVariant[status]}>
        {status === 'valide' && 'Valide'}
        {status === 'a_prevoir' && 'À prévoir'}
        {status === 'en_retard' && 'En retard'}
        {status === 'non_applicable' && 'N/A'}
      </Badge>
    </div>
  );
}

export default function AppareilFiche() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showVerifModal, setShowVerifModal] = useState(false);
  const [showCQModal, setShowCQModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAttempted, setEditAttempted] = useState(false);
  const [editFormData, setEditFormData] = useState({
    designation: '',
    marque: '',
    modele: '',
    numeroSerie: '',
    type: '',
    anneeMiseEnService: '',
    lieuUtilisation: '',
    utilisationPartagee: false,
    tensionNominaleKv: '',
    intensiteMaximaleMa: '',
  });
  const [verifFormData, setVerifFormData] = useState({
    type: 'annuelle_interne',
    dateRealisation: new Date().toISOString().split('T')[0],
    realisePar: '',
    organisme: '',
    observations: '',
  });
  const [cqFormData, setCQFormData] = useState({
    dateEcheance: new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    organisme: '',
    observations: '',
  });

  const { data: appareil } = useQuery({
    queryKey: ['appareil', id],
    queryFn: () => api.appareil.get(Number(id!)),
    enabled: !!id,
  });

  const { data: verifications = [] } = useQuery({
    queryKey: ['verifications'],
    queryFn: () => api.verification.list(),
  });

  const { data: controles = [] } = useQuery({
    queryKey: ['controles'],
    queryFn: () => api.controleQualite.list(),
  });

  const createVerifMutation = useMutation({
    mutationFn: () =>
      api.verification.create({
        appareilId: Number(id!),
        type: verifFormData.type,
        dateRealisation: verifFormData.dateRealisation,
        realisePar: verifFormData.realisePar || null,
        organisme: verifFormData.organisme || null,
        observations: verifFormData.observations || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verifications'] });
      setShowVerifModal(false);
      setVerifFormData({
        type: 'annuelle_interne',
        dateRealisation: new Date().toISOString().split('T')[0],
        realisePar: '',
        organisme: '',
        observations: '',
      });
    },
  });

  const createCQMutation = useMutation({
    mutationFn: () =>
      api.controleQualite.create({
        appareilId: Number(id!),
        type: 'externe',
        dateEcheance: cqFormData.dateEcheance,
        statut: 'planifie',
        organisme: cqFormData.organisme || null,
        observations: cqFormData.observations || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controles'] });
      setShowCQModal(false);
      setCQFormData({
        dateEcheance: new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        organisme: '',
        observations: '',
      });
    },
  });

  const updateCQMutation = useMutation({
    mutationFn: (controleId: number) => {
      const c = controles.find(ctrl => ctrl.id === controleId);
      return api.controleQualite.update({
        id: controleId,
        appareilId: Number(id!),
        type: c?.type_ || 'partiel_interne',
        statut: 'realise',
        dateRealisation: new Date().toISOString().split('T')[0],
        dateEcheance: c?.date_echeance || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controles'] });
    },
  });

  const updateAppareilMutation = useMutation({
    mutationFn: () =>
      api.appareil.update({
        id: Number(id!),
        etablissementId: appareil!.etablissement_id,
        designation: editFormData.designation,
        marque: editFormData.marque || null,
        modele: editFormData.modele || null,
        numeroSerie: editFormData.numeroSerie || null,
        type: editFormData.type || null,
        anneeMiseEnService: editFormData.anneeMiseEnService ? parseInt(editFormData.anneeMiseEnService) : null,
        lieuUtilisation: editFormData.lieuUtilisation || null,
        utilisationPartagee: editFormData.utilisationPartagee ? 1 : 0,
        tensionNominaleKv: editFormData.tensionNominaleKv ? parseFloat(editFormData.tensionNominaleKv) : null,
        intensiteMaximaleMa: editFormData.intensiteMaximaleMa ? parseFloat(editFormData.intensiteMaximaleMa) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appareil', id] });
      queryClient.invalidateQueries({ queryKey: ['appareils'] });
      setShowEditModal(false);
    },
    onError: () => {
      // erreur affichée via updateAppareilMutation.isError dans la modale
    },
  });

  const openEditModal = () => {
    if (!appareil) return;
    setEditFormData({
      designation: appareil.designation,
      marque: appareil.marque ?? '',
      modele: appareil.modele ?? '',
      numeroSerie: appareil.numero_serie ?? '',
      type: appareil.type_ ?? '',
      anneeMiseEnService: appareil.annee_mise_en_service?.toString() ?? '',
      lieuUtilisation: appareil.lieu_utilisation ?? '',
      utilisationPartagee: Boolean(appareil.utilisation_partagee),
      tensionNominaleKv: appareil.tension_nominale_kv?.toString() ?? '',
      intensiteMaximaleMa: appareil.intensite_maximale_ma?.toString() ?? '',
    });
    setEditAttempted(false);
    setShowEditModal(true);
  };

  const deleteAppareilMutation = useMutation({
    mutationFn: () => api.appareil.delete(Number(id!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appareils'] });
      navigate('/appareils');
    },
  });

  if (!appareil) return null;

  const appareilVerifications = verifications.filter(v => v.appareil_id === Number(id!));
  const appareilControles = controles.filter(c => c.appareil_id === Number(id!));

  const getLatestVerif = (type: string) => {
    return appareilVerifications
      .filter(v => v.type_ === type)
      .sort((a, b) => new Date(b.date_realisation).getTime() - new Date(a.date_realisation).getTime())[0];
  };

  const getNextDue = (type: string) => {
    const latest = getLatestVerif(type);
    if (!latest) return null;
    const next = new Date(latest.date_realisation);
    if (type === 'annuelle_interne') {
      next.setFullYear(next.getFullYear() + 1);
    } else {
      next.setFullYear(next.getFullYear() + 3);
    }
    return next.toISOString().split('T')[0];
  };

  const annuelleLatest = getLatestVerif('annuelle_interne');
  const annuelleNext = getNextDue('annuelle_interne');
  const annuelleStatus = statusFromDate(annuelleNext, 3);

  const triennaleLatest = getLatestVerif('triennale_externe');
  const triennaleNext = getNextDue('triennale_externe');
  const triennaleStatus = statusFromDate(triennaleNext, 3);

  const externe = appareilControles.find(c => c.type_ === 'externe');
  const internes = appareilControles
    .filter(c => c.type_ === 'partiel_interne' || c.type_ === 'complet_interne')
    .sort((a, b) => new Date(a.date_echeance).getTime() - new Date(b.date_echeance).getTime());

  const statutGlobalStatus = [annuelleStatus, triennaleStatus, ...internes.map(c => statusFromDate(c.date_echeance, 3))].includes('en_retard')
    ? 'en_retard'
    : [annuelleStatus, triennaleStatus, ...internes.map(c => statusFromDate(c.date_echeance, 3))].includes('a_prevoir')
    ? 'a_prevoir'
    : 'valide';

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/appareils')} className="inline-flex items-center gap-1.5 text-textSoft text-[13px] hover:text-text">
        <ChevronLeft size={14} /> Appareils
      </button>

      <PageHead
        title={appareil.designation}
        sub={<span className="font-mono text-[13px]">{appareil.marque} · {appareil.modele} · {appareil.numero_serie}</span>}
        actions={
          <>
            <Badge variant={statusToBadgeVariant[statutGlobalStatus]}>
              {statutGlobalStatus === 'valide' && 'Valide'}
              {statutGlobalStatus === 'a_prevoir' && 'À prévoir'}
              {statutGlobalStatus === 'en_retard' && 'En retard'}
            </Badge>
            <Button className="inline-flex items-center gap-1.5" onClick={openEditModal}>
              <Edit size={14} /> Modifier
            </Button>
            <Button variant="ghost" className="inline-flex items-center gap-1.5 text-danger hover:text-danger" onClick={() => setShowDeleteModal(true)}>
              <Trash2 size={14} /> Supprimer
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3.5">
        <Card>
          <CardHead>
            <CardTitle>Informations générales</CardTitle>
          </CardHead>
          <CardBody className="grid grid-cols-2 gap-y-3.5 gap-x-5">
            <ReadField label="Marque" value={appareil.marque} />
            <ReadField label="Modèle" value={appareil.modele} />
            <div className="col-span-2">
              <ReadField label="Numéro de série" value={appareil.numero_serie} mono />
            </div>
            <ReadField label="Type" value={appareil.type_} />
            <ReadField label="Année de mise en service" value={appareil.annee_mise_en_service?.toString()} />
            <div className="col-span-2">
              <ReadField label="Lieu d'utilisation" value={appareil.lieu_utilisation} />
            </div>
            <ReadField label="Utilisation partagée" value={appareil.utilisation_partagee ? 'Oui' : 'Non'} />
          </CardBody>
        </Card>

        <Card>
          <CardHead>
            <CardTitle>Caractéristiques techniques</CardTitle>
          </CardHead>
          <CardBody className="grid grid-cols-2 gap-y-3.5 gap-x-5">
            <ReadField mono label="Tension nominale (kV)" value={appareil.tension_nominale_kv ? `${appareil.tension_nominale_kv} kV` : null} />
            <ReadField mono label="Intensité maximale (mA)" value={appareil.intensite_maximale_ma ? `${appareil.intensite_maximale_ma} mA` : null} />
          </CardBody>
        </Card>

        <Card className="col-span-2">
          <CardHead>
            <CardTitle>Vérification technique</CardTitle>
            <Button variant="primary" size="sm" className="inline-flex items-center gap-1.5 text-[12px]" onClick={() => setShowVerifModal(true)}>
              <Plus size={12} /> Saisir
            </Button>
          </CardHead>
          <CardBody className="divide-y divide-border">
            <VerifRow label="Vérification annuelle interne" sub="Périodicité : 1 an" last={false} dateLast={annuelleLatest?.date_realisation} dateDeadline={annuelleNext} status={annuelleStatus} />
            <VerifRow label="Vérification triennale externe" sub="Périodicité : 3 ans" last={true} dateLast={triennaleLatest?.date_realisation} dateDeadline={triennaleNext} status={triennaleStatus} />
          </CardBody>
        </Card>

        <Card className="col-span-2">
          <CardHead>
            <CardTitle>Contrôle qualité</CardTitle>
            <Button variant="primary" size="sm" className="inline-flex items-center gap-1.5 text-[12px]" onClick={() => setShowCQModal(true)}>
              <Plus size={12} /> Saisir CQ externe
            </Button>
          </CardHead>
          <CardBody className="space-y-3.5">
            {externe && (
              <div className="flex items-center gap-3.5 px-3.5 py-3 bg-accentSoft border border-accentSoftBorder rounded-lg">
                <div className="w-9 h-9 rounded bg-white border border-accentSoftBorder grid place-items-center text-accent">
                  <Calendar size={16} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-[14px]">Contrôle qualité externe — point de départ du cycle</div>
                  <div className="text-textSoft text-[12.5px] mt-px">
                    Dernier contrôle externe : {externe.date_realisation ? new Date(externe.date_realisation).toLocaleDateString('fr-FR') : '–'} · les contrôles internes sont calculés automatiquement
                  </div>
                </div>
                <Badge variant="accent" icon={null}>
                  Référence cycle
                </Badge>
              </div>
            )}

            {internes.length > 0 && (
              <div className="space-y-2">
                {internes.map((controle, idx) => {
                  const status = statusFromDate(controle.date_echeance, 3);
                  const isLast = idx === internes.length - 1;
                  let typeLabel = '';
                  let alertLabel = '';
                  if (controle.type_ === 'partiel_interne') {
                    if (idx === 0) {
                      typeLabel = 'Contrôle qualité partiel interne (3 mois)';
                      alertLabel = 'À effectuer 3 mois après l\'externe';
                    } else {
                      typeLabel = 'Contrôle qualité partiel interne (9 mois)';
                      alertLabel = 'À effectuer 9 mois après l\'externe';
                    }
                  } else {
                    typeLabel = 'Contrôle qualité complet interne (6 mois)';
                    alertLabel = 'À effectuer 6 mois après l\'externe';
                  }

                  return (
                    <div key={controle.id} className={`py-3 px-4 flex items-center gap-6 ${isLast ? '' : 'border-b border-border'}`}>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{typeLabel}</div>
                        <div className="text-xs text-textMuted mt-0.5">{alertLabel}</div>
                      </div>
                      <div className="min-w-32 text-right">
                        <div className="text-sm font-mono">{new Date(controle.date_echeance).toLocaleDateString('fr-FR')}</div>
                        <div className="text-xs text-textMuted mt-0.5">
                          {(() => {
                            const today = new Date();
                            const date = new Date(controle.date_echeance);
                            const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            if (diff < 0) return `${Math.abs(diff)} jour(s) passé(s)`;
                            if (diff === 0) return 'Aujourd\'hui';
                            if (diff === 1) return 'Demain';
                            return `${diff} jour(s)`;
                          })()}
                        </div>
                      </div>
                      <Badge variant={statusToBadgeVariant[status]}>
                        {status === 'valide' && 'Valide'}
                        {status === 'a_prevoir' && 'À prévoir'}
                        {status === 'en_retard' && 'En retard'}
                        {status === 'non_applicable' && 'N/A'}
                      </Badge>
                      {controle.statut === 'planifie' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateCQMutation.mutate(controle.id)}
                          disabled={updateCQMutation.isPending}
                        >
                          Marquer effectué
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <div className="col-span-2">
          <CompetencesRequises appareilId={appareil.id} />
        </div>
      </div>

      {showVerifModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-lg shadow-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Nouvelle vérification technique</h2>
              <button
                onClick={() => setShowVerifModal(false)}
                className="text-textMuted hover:text-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <Field>
                <Label>Type</Label>
                <select
                  value={verifFormData.type}
                  onChange={e => setVerifFormData({ ...verifFormData, type: e.target.value })}
                  className="w-full h-9 px-3 rounded border border-border bg-surface text-text focus:outline-none focus:border-accent"
                >
                  <option value="annuelle_interne">Annuelle interne</option>
                  <option value="triennale_externe">Triennale externe</option>
                </select>
              </Field>

              <Field>
                <Label>Date de réalisation</Label>
                <Input
                  type="date"
                  value={verifFormData.dateRealisation}
                  onChange={e => setVerifFormData({ ...verifFormData, dateRealisation: e.target.value })}
                />
              </Field>

              <Field>
                <Label>Réalisé par (optionnel)</Label>
                <Input
                  value={verifFormData.realisePar}
                  onChange={e => setVerifFormData({ ...verifFormData, realisePar: e.target.value })}
                  placeholder="Nom ou organisme"
                />
              </Field>

              <Field>
                <Label>Organisme (optionnel)</Label>
                <Input
                  value={verifFormData.organisme}
                  onChange={e => setVerifFormData({ ...verifFormData, organisme: e.target.value })}
                  placeholder="Organisme"
                />
              </Field>

              <Field>
                <Label>Observations (optionnel)</Label>
                <textarea
                  value={verifFormData.observations}
                  onChange={e => setVerifFormData({ ...verifFormData, observations: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-border bg-surface text-text focus:outline-none focus:border-accent resize-none h-20"
                  placeholder="Notes"
                />
              </Field>

              <div className="flex gap-2 justify-end mt-6">
                <Button
                  variant="ghost"
                  onClick={() => setShowVerifModal(false)}
                >
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  onClick={() => createVerifMutation.mutate()}
                  disabled={createVerifMutation.isPending}
                >
                  Ajouter
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCQModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-lg shadow-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Nouveau contrôle qualité externe</h2>
              <button
                onClick={() => setShowCQModal(false)}
                className="text-textMuted hover:text-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <Field>
                <Label>Date d'échéance</Label>
                <Input
                  type="date"
                  value={cqFormData.dateEcheance}
                  onChange={e => setCQFormData({ ...cqFormData, dateEcheance: e.target.value })}
                />
              </Field>

              <Field>
                <Label>Organisme (optionnel)</Label>
                <Input
                  value={cqFormData.organisme}
                  onChange={e => setCQFormData({ ...cqFormData, organisme: e.target.value })}
                  placeholder="Nom de l'organisme"
                />
              </Field>

              <Field>
                <Label>Observations (optionnel)</Label>
                <textarea
                  value={cqFormData.observations}
                  onChange={e => setCQFormData({ ...cqFormData, observations: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-border bg-surface text-text focus:outline-none focus:border-accent resize-none h-20"
                  placeholder="Notes"
                />
              </Field>

              <div className="flex gap-2 justify-end mt-6">
                <Button
                  variant="ghost"
                  onClick={() => setShowCQModal(false)}
                >
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  onClick={() => createCQMutation.mutate()}
                  disabled={createCQMutation.isPending}
                >
                  Ajouter
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-[16px] font-semibold">Modifier l'appareil</h2>
            <div className="space-y-4">
              <Field>
                <Label>Désignation *</Label>
                <Input
                  value={editFormData.designation}
                  onChange={e => setEditFormData({ ...editFormData, designation: e.target.value })}
                  placeholder="Ex : Tube radiogène"
                  autoFocus
                />
                {editAttempted && !editFormData.designation.trim() && (
                  <p className="text-xs text-danger">La désignation est obligatoire.</p>
                )}
              </Field>
              <Field>
                <Label>Marque</Label>
                <Input
                  value={editFormData.marque}
                  onChange={e => setEditFormData({ ...editFormData, marque: e.target.value })}
                />
              </Field>
              <Field>
                <Label>Modèle</Label>
                <Input
                  value={editFormData.modele}
                  onChange={e => setEditFormData({ ...editFormData, modele: e.target.value })}
                />
              </Field>
              <Field>
                <Label>Numéro de série</Label>
                <Input
                  value={editFormData.numeroSerie}
                  onChange={e => setEditFormData({ ...editFormData, numeroSerie: e.target.value })}
                />
              </Field>
              <Field>
                <Label>Type</Label>
                <Select value={editFormData.type} onChange={e => setEditFormData({ ...editFormData, type: e.target.value })}>
                  <option value="">— Sélectionner —</option>
                  <option value="Fixe">Fixe</option>
                  <option value="Deplacable">Déplaçable</option>
                </Select>
              </Field>
              <Field>
                <Label>Année de mise en service</Label>
                <Input
                  type="number"
                  value={editFormData.anneeMiseEnService}
                  onChange={e => setEditFormData({ ...editFormData, anneeMiseEnService: e.target.value })}
                  placeholder="Ex : 2020"
                />
              </Field>
              <Field>
                <Label>Lieu d'utilisation</Label>
                <Input
                  value={editFormData.lieuUtilisation}
                  onChange={e => setEditFormData({ ...editFormData, lieuUtilisation: e.target.value })}
                />
              </Field>
              <button
                type="button"
                onClick={() => setEditFormData(d => ({ ...d, utilisationPartagee: !d.utilisationPartagee }))}
                className={[
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded border text-sm font-medium transition-colors duration-150',
                  editFormData.utilisationPartagee
                    ? 'border-accent bg-accentSoft text-accent'
                    : 'border-border bg-surface text-textMuted hover:bg-surfaceHover',
                ].join(' ')}
              >
                <span className={[
                  'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
                  editFormData.utilisationPartagee ? 'bg-accent' : 'bg-border',
                ].join(' ')}>
                  <span className={[
                    'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
                    editFormData.utilisationPartagee ? 'translate-x-4' : 'translate-x-0',
                  ].join(' ')} />
                </span>
                <Users size={14} className="shrink-0" />
                Utilisation partagée
              </button>
              <Field>
                <Label>Tension nominale (kV)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={editFormData.tensionNominaleKv}
                  onChange={e => setEditFormData({ ...editFormData, tensionNominaleKv: e.target.value })}
                  placeholder="Ex : 150"
                />
              </Field>
              <Field>
                <Label>Intensité maximale (mA)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={editFormData.intensiteMaximaleMa}
                  onChange={e => setEditFormData({ ...editFormData, intensiteMaximaleMa: e.target.value })}
                  placeholder="Ex : 500"
                />
              </Field>
              {updateAppareilMutation.isError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {updateAppareilMutation.error instanceof Error
                    ? updateAppareilMutation.error.message
                    : 'Erreur lors de la modification.'}
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={() => setShowEditModal(false)}>Annuler</Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditAttempted(true);
                    if (!editFormData.designation.trim()) return;
                    updateAppareilMutation.mutate();
                  }}
                  disabled={updateAppareilMutation.isPending}
                >
                  {updateAppareilMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-surface border border-border rounded-lg shadow-lg w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">Supprimer l'appareil</h2>
            <p className="text-sm text-textMuted mb-6">
              Êtes-vous sûr de vouloir supprimer <strong>{appareil.designation}</strong> ? Cette action est irréversible.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>Annuler</Button>
              <Button
                variant="primary"
                className="bg-danger hover:bg-danger/90"
                onClick={() => deleteAppareilMutation.mutate()}
                disabled={deleteAppareilMutation.isPending}
              >
                {deleteAppareilMutation.isPending ? 'Suppression...' : 'Supprimer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant : compétences requises par appareil
// ─────────────────────────────────────────────────────────────────────────────

function CompetencesRequises({ appareilId }: { appareilId: number }) {
  const qc = useQueryClient();

  const { data: allCompetences = [] } = useQuery({
    queryKey: ['competences'],
    queryFn: () => api.competence.list(),
    staleTime: 60_000,
  });

  const { data: linkedIds = [] } = useQuery({
    queryKey: ['appareil_competences', appareilId],
    queryFn: () => api.appareil.competenceList(appareilId),
    staleTime: 0,
  });

  const linkedSet = new Set(linkedIds);

  const addMut = useMutation({
    mutationFn: (competenceRefId: number) =>
      api.appareil.competenceAdd(appareilId, competenceRefId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appareil_competences', appareilId] }),
  });

  const removeMut = useMutation({
    mutationFn: (competenceRefId: number) =>
      api.appareil.competenceRemove(appareilId, competenceRefId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appareil_competences', appareilId] }),
  });

  const toggle = (competenceRefId: number, isLinked: boolean) => {
    if (isLinked) removeMut.mutate(competenceRefId);
    else addMut.mutate(competenceRefId);
  };

  if (!allCompetences || allCompetences.length === 0) return null;

  const linkedCount = linkedIds.length;

  return (
    <Card>
      <CardHead>
        <CardTitle>Compétences requises</CardTitle>
        {linkedCount > 0 && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-accentSoft text-accent border border-accentSoftBorder">
            {linkedCount} sélectionnée{linkedCount > 1 ? 's' : ''}
          </span>
        )}
      </CardHead>
      <CardBody className="p-3">
        <div className="grid gap-2">
          {allCompetences.map(c => {
            const linked = linkedSet.has(c.id);
            const isPending =
              (addMut.isPending && addMut.variables === c.id) ||
              (removeMut.isPending && removeMut.variables === c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id, linked)}
                disabled={isPending}
                className={[
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left',
                  'transition-all duration-150 cursor-pointer select-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
                  linked
                    ? 'bg-accentSoft border-accentSoftBorder'
                    : 'bg-surface border-border hover:border-accent/40 hover:bg-accent/5',
                  isPending ? 'opacity-60' : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150',
                    linked
                      ? 'bg-accent border-accent'
                      : 'border-border bg-transparent',
                  ].join(' ')}
                >
                  {linked && (
                    <Check className="w-3 h-3 text-white stroke-[3]" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <span className={[
                    'block text-[13px] font-medium leading-tight',
                    linked ? 'text-accent' : 'text-text',
                  ].join(' ')}>
                    {c.libelle}
                  </span>
                  {c.description && (
                    <span className="block text-[11.5px] text-textSoft mt-0.5 leading-snug">
                      {c.description}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
