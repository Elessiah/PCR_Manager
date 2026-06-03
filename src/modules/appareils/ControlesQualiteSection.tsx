import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { statusFromDate, statusToBadgeVariant } from '../../lib/status';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHead, CardTitle } from '../../components/ui/Card';
import { Field, Label, Input } from '../../components/ui/FormField';
import { Plus, X, Check } from 'lucide-react';

interface ControlesQualiteSectionProps {
  appareilId: number;
}

export default function ControlesQualiteSection({ appareilId }: ControlesQualiteSectionProps) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    dateEcheance: new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    organisme: '',
    observations: '',
  });

  const { data: controles = [] } = useQuery({
    queryKey: ['controles'],
    queryFn: () => api.controleQualite.list(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.controleQualite.create({
        appareilId,
        type: 'externe',
        dateEcheance: formData.dateEcheance,
        statut: 'planifie',
        organisme: formData.organisme || null,
        observations: formData.observations || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controles'] });
      setShowModal(false);
      setFormData({
        dateEcheance: new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        organisme: '',
        observations: '',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (id: number) => {
      const c = controles.find(c => c.id === id);
      return api.controleQualite.update({
        id,
        appareilId,
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

  const unmarkMutation = useMutation({
    mutationFn: (id: number) => {
      const c = controles.find(c => c.id === id);
      return api.controleQualite.update({
        id,
        appareilId,
        type: c?.type_ || 'partiel_interne',
        statut: 'planifie',
        dateRealisation: null,
        dateEcheance: c?.date_echeance || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controles'] });
    },
  });

  const appareilControles = controles.filter(c => c.appareil_id === appareilId);

  const externe = appareilControles.find(c => c.type_ === 'externe');
  const internes = appareilControles
    .filter(c => c.type_ === 'partiel_interne' || c.type_ === 'complet_interne')
    .sort((a, b) => new Date(a.date_echeance).getTime() - new Date(b.date_echeance).getTime());

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  const formatRelativeDay = (dateStr: string) => {
    const today = new Date();
    const date = new Date(dateStr);
    const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `${Math.abs(diff)} jour(s) passé(s)`;
    if (diff === 0) return 'Aujourd\'hui';
    if (diff === 1) return 'Demain';
    return `${diff} jour(s)`;
  };

  return (
    <Card>
      <CardHead>
        <CardTitle>Contrôle qualité</CardTitle>
        <Button
          variant="primary"
          size="sm"
          className="inline-flex items-center gap-2"
          onClick={() => setShowModal(true)}
        >
          <Plus size={14} />
          Saisir CQ externe
        </Button>
      </CardHead>
      <CardBody className="space-y-4">
        {externe && (
          <div className="p-4 rounded-lg bg-accentSoft border border-accentSoftBorder">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-white border border-accentSoftBorder flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-accent"></div>
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Contrôle qualité externe — point de départ du cycle</div>
                <div className="text-xs text-textMuted mt-1">
                  Dernier contrôle externe : <span className="font-mono">{formatDate(externe.date_realisation)}</span> · les contrôles internes sont calculés automatiquement
                </div>
              </div>
              <Badge variant="accent">Référence cycle</Badge>
            </div>
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
                  alertLabel = 'Alerte 1 mois avant échéance';
                } else {
                  typeLabel = 'Contrôle qualité partiel interne (9 mois)';
                  alertLabel = 'Alerte 1 mois avant échéance';
                }
              } else {
                typeLabel = 'Contrôle qualité complet interne (6 mois)';
                alertLabel = 'Alerte 3 mois avant échéance';
              }

              return (
                <div
                  key={controle.id}
                  className={`py-3 px-4 flex items-center gap-6 transition-all ${
                    controle.statut === 'realise'
                      ? 'bg-emerald-50/50 backdrop-blur-sm rounded-lg border border-emerald-100'
                      : isLast ? '' : 'border-b border-border'
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{typeLabel}</div>
                    <div className="text-xs text-textMuted mt-0.5">{alertLabel}</div>
                  </div>
                  <div className="min-w-32 text-right">
                    <div className="text-sm font-mono">{formatDate(controle.date_echeance)}</div>
                    <div className="text-xs text-textMuted mt-0.5">{formatRelativeDay(controle.date_echeance)}</div>
                  </div>
                  {controle.statut !== 'realise' && (
                    <Badge variant={statusToBadgeVariant[status]}>
                      {status === 'valide' && 'Valide'}
                      {status === 'a_prevoir' && 'À prévoir'}
                      {status === 'en_retard' && 'En retard'}
                      {status === 'non_applicable' && 'N/A'}
                    </Badge>
                  )}
                  <button
                    onClick={() => {
                      if (controle.statut === 'planifie') {
                        updateMutation.mutate(controle.id);
                      } else if (controle.statut === 'realise') {
                        unmarkMutation.mutate(controle.id);
                      }
                    }}
                    disabled={updateMutation.isPending || unmarkMutation.isPending}
                    className="bg-transparent border-none p-0 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {controle.statut === 'planifie' ? (
                      <div className="w-5 h-5 rounded-full border-2 border-border flex items-center justify-center" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {internes.length === 0 && (
          <div className="text-center py-6 text-textMuted text-sm">
            {externe ? 'Les contrôles internes seront générés automatiquement' : 'Aucun contrôle qualité enregistré'}
          </div>
        )}
      </CardBody>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-lg shadow-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Nouveau contrôle qualité externe</h2>
              <button
                onClick={() => setShowModal(false)}
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
                  value={formData.dateEcheance}
                  onChange={e => setFormData({ ...formData, dateEcheance: e.target.value })}
                />
              </Field>

              <Field>
                <Label>Organisme (optionnel)</Label>
                <Input
                  value={formData.organisme}
                  onChange={e => setFormData({ ...formData, organisme: e.target.value })}
                  placeholder="Nom de l'organisme"
                />
              </Field>

              <Field>
                <Label>Observations (optionnel)</Label>
                <textarea
                  value={formData.observations}
                  onChange={e => setFormData({ ...formData, observations: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-border bg-surface text-text focus:outline-none focus:border-accent resize-none h-20"
                  placeholder="Notes"
                />
              </Field>

              <div className="flex gap-2 justify-end mt-6">
                <Button
                  variant="ghost"
                  onClick={() => setShowModal(false)}
                >
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                >
                  Ajouter
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
