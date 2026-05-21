import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { statusFromDate, statusToBadgeVariant } from '../../lib/status';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHead, CardTitle } from '../../components/ui/Card';
import { Field, Label, Input } from '../../components/ui/FormField';
import { Plus, X } from 'lucide-react';

interface VerificationsSectionProps {
  appareilId: number;
}

export default function VerificationsSection({ appareilId }: VerificationsSectionProps) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    type: 'annuelle_interne',
    dateRealisation: new Date().toISOString().split('T')[0],
    realisePar: '',
    organisme: '',
    observations: '',
  });

  const { data: verifications = [] } = useQuery({
    queryKey: ['verifications'],
    queryFn: () => api.verification.list(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.verification.create({
        appareilId,
        type: formData.type,
        dateRealisation: formData.dateRealisation,
        realisePar: formData.realisePar || null,
        organisme: formData.organisme || null,
        observations: formData.observations || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verifications'] });
      setShowModal(false);
      setFormData({
        type: 'annuelle_interne',
        dateRealisation: new Date().toISOString().split('T')[0],
        realisePar: '',
        organisme: '',
        observations: '',
      });
    },
  });

  const appareilVerifications = verifications.filter(v => v.appareil_id === appareilId);

  const getLatest = (type: string) => {
    return appareilVerifications
      .filter(v => v.type_ === type)
      .sort((a, b) => new Date(b.date_realisation).getTime() - new Date(a.date_realisation).getTime())[0];
  };

  const getNextDue = (type: string) => {
    const latest = getLatest(type);
    if (!latest) return null;
    const next = new Date(latest.date_realisation);
    if (type === 'annuelle_interne') {
      next.setFullYear(next.getFullYear() + 1);
    } else {
      next.setFullYear(next.getFullYear() + 3);
    }
    return next.toISOString().split('T')[0];
  };

  const annuelleLatest = getLatest('annuelle_interne');
  const annuelleNext = getNextDue('annuelle_interne');
  const annuelleStatus = statusFromDate(annuelleNext, 3);

  const triennaleLatest = getLatest('triennale_externe');
  const triennaleNext = getNextDue('triennale_externe');
  const triennaleStatus = statusFromDate(triennaleNext, 3);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  return (
    <Card>
      <CardHead>
        <CardTitle>Vérification technique</CardTitle>
        <Button
          variant="primary"
          size="sm"
          className="inline-flex items-center gap-2"
          onClick={() => setShowModal(true)}
        >
          <Plus size={14} />
          Saisir
        </Button>
      </CardHead>
      <CardBody className="space-y-0">
        <div className="py-3 px-4 border-b border-border flex items-center gap-6">
          <div className="flex-1">
            <div className="font-medium text-sm">Vérification annuelle interne</div>
            <div className="text-xs text-textMuted mt-0.5">Réalisée par la PCR ou un organisme agréé · échéance 1 an</div>
          </div>
          <div className="min-w-32 text-right">
            <div className="text-xs text-textMuted uppercase tracking-wide mb-1">Dernier</div>
            <div className="text-sm font-mono">{formatDate(annuelleLatest?.date_realisation)}</div>
          </div>
          <div className="min-w-32 text-right">
            <div className="text-xs text-textMuted uppercase tracking-wide mb-1">Échéance</div>
            <div className="text-sm font-mono">{formatDate(annuelleNext)}</div>
          </div>
          <Badge variant={statusToBadgeVariant[annuelleStatus]}>
            {annuelleStatus === 'valide' && 'Valide'}
            {annuelleStatus === 'a_prevoir' && 'À prévoir'}
            {annuelleStatus === 'en_retard' && 'En retard'}
            {annuelleStatus === 'non_applicable' && 'N/A'}
          </Badge>
        </div>

        <div className="py-3 px-4 flex items-center gap-6">
          <div className="flex-1">
            <div className="font-medium text-sm">Vérification triennale externe</div>
            <div className="text-xs text-textMuted mt-0.5">Réalisée par un organisme agréé · échéance 3 ans</div>
          </div>
          <div className="min-w-32 text-right">
            <div className="text-xs text-textMuted uppercase tracking-wide mb-1">Dernier</div>
            <div className="text-sm font-mono">{formatDate(triennaleLatest?.date_realisation)}</div>
          </div>
          <div className="min-w-32 text-right">
            <div className="text-xs text-textMuted uppercase tracking-wide mb-1">Échéance</div>
            <div className="text-sm font-mono">{formatDate(triennaleNext)}</div>
          </div>
          <Badge variant={statusToBadgeVariant[triennaleStatus]}>
            {triennaleStatus === 'valide' && 'Valide'}
            {triennaleStatus === 'a_prevoir' && 'À prévoir'}
            {triennaleStatus === 'en_retard' && 'En retard'}
            {triennaleStatus === 'non_applicable' && 'N/A'}
          </Badge>
        </div>
      </CardBody>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-lg shadow-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Nouvelle vérification technique</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-textMuted hover:text-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <Field>
                <Label>Type</Label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
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
                  value={formData.dateRealisation}
                  onChange={e => setFormData({ ...formData, dateRealisation: e.target.value })}
                />
              </Field>

              <Field>
                <Label>Réalisé par (optionnel)</Label>
                <Input
                  value={formData.realisePar}
                  onChange={e => setFormData({ ...formData, realisePar: e.target.value })}
                  placeholder="Nom ou organisme"
                />
              </Field>

              <Field>
                <Label>Organisme (optionnel)</Label>
                <Input
                  value={formData.organisme}
                  onChange={e => setFormData({ ...formData, organisme: e.target.value })}
                  placeholder="Organisme"
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
