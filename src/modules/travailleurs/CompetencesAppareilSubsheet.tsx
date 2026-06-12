import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Check, X } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { competenceStatus } from '../../lib/status';
import { Field, Input, Label } from '../../components/ui/FormField';

interface CompetencesAppareilSubsheetProps {
  appareilId: number;
  travailleurId: number;
}

interface EditingState {
  competenceRefId: number;
  libelle: string;
  isValidated: boolean;
}

export default function CompetencesAppareilSubsheet({
  appareilId,
  travailleurId,
}: CompetencesAppareilSubsheetProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [editDate, setEditDate] = useState('');

  const { data: competences = [] } = useQuery({
    queryKey: ['competence', travailleurId],
    queryFn: () => api.competence.getForTravailleur(travailleurId),
  });

  const { data: competenceRefs = [] } = useQuery({
    queryKey: ['competence_list'],
    queryFn: () => api.competence.list(),
  });

  const { data: requiredCompetenceIds = [] } = useQuery({
    queryKey: ['appareilCompetences', appareilId],
    queryFn: () => api.appareil.competenceList(appareilId),
  });

  const setMutation = useMutation({
    mutationFn: (input: Parameters<typeof api.competence.set>[0]) =>
      api.competence.set(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competence', travailleurId] });
      queryClient.invalidateQueries({ queryKey: ['habilitation', travailleurId] });
      queryClient.invalidateQueries({ queryKey: ['habilitationRaw', travailleurId] });
    },
  });

  const handleClickCompetence = (competenceRefId: number, libelle: string) => {
    const existing = competences.find(
      c => c.appareil_id === appareilId && c.competence_ref_id === competenceRefId
    );
    const isValidated = existing?.validated === 1;
    setEditing({ competenceRefId, libelle, isValidated });
    setEditDate(
      isValidated
        ? (existing?.date_validation || new Date().toISOString().slice(0, 10))
        : new Date().toISOString().slice(0, 10)
    );
  };

  const handleSave = async () => {
    if (!editing) return;
    await setMutation.mutateAsync({
      travailleurId,
      appareilId,
      competenceRefId: editing.competenceRefId,
      dateValidation: editDate || null,
      validated: 1,
    });
    setEditing(null);
  };

  const handleInvalidate = async () => {
    if (!editing) return;
    await setMutation.mutateAsync({
      travailleurId,
      appareilId,
      competenceRefId: editing.competenceRefId,
      validated: 0,
    });
    setEditing(null);
  };

  useEffect(() => {
    if (!editing) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditing(null);
      else if (e.key === 'Enter' && !setMutation.isPending && editDate) handleSave();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, editDate, setMutation.isPending]);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  const appareilCompetences = competences.filter(c => c.appareil_id === appareilId);
  const requiredSet = new Set(requiredCompetenceIds);
  const filteredRefs = competenceRefs.filter(c => c.propre_appareil === 1 && requiredSet.has(c.id));
  const validatedCount = filteredRefs.filter(ref => {
    const comp = appareilCompetences.find(c => c.competence_ref_id === ref.id);
    const st = competenceStatus(comp?.validated, comp?.date_peremption, ref.duree_alerte_mois);
    return st === 'valide' || st === 'a_prevoir';
  }).length;
  const variant = validatedCount === filteredRefs.length && filteredRefs.length > 0 ? 'ok' : validatedCount > 0 ? 'warn' : 'neutral';

  return (
    <div>
      {filteredRefs.length === 0 ? (
        <div className="text-sm text-textMuted">Aucune compétence requise pour cet appareil.</div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div></div>
            <div className="flex items-center gap-2">
              <span className="text-textMuted text-xs mono">{validatedCount}/{filteredRefs.length}</span>
              <Badge variant={variant}>
                {validatedCount === filteredRefs.length ? 'Complète' : validatedCount > 0 ? 'Partielle' : 'Non validée'}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1">
            {filteredRefs.map((ref, idx) => {
              const competence = appareilCompetences.find(
                c => c.competence_ref_id === ref.id
              );
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
                  onClick={() => handleClickCompetence(ref.id, ref.libelle)}
                  disabled={setMutation.isPending}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded border-1 transition-colors cursor-pointer ${cardClass}`}
                >
                  <div className={`w-5 h-5 rounded-[3px] border-[1.5px] flex-shrink-0 flex items-center justify-center ${checkboxClass}`}>
                    {compSt !== null && <Check size={10} className="text-white" strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-xs text-textMuted mono">{String(idx + 1).padStart(2, '0')}</div>
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

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-lg shadow-lg w-80 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold">
                {editing.isValidated ? 'Modifier la validation' : 'Valider la compétence'}
              </h2>
              <button onClick={() => setEditing(null)} className="text-textMuted hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-textMuted mb-4">{editing.libelle}</p>
            <div className="space-y-4">
              <Field>
                <Label>Date de validation</Label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </Field>
              <div className="flex gap-2 justify-end mt-2">
                {editing.isValidated && (
                  <Button
                    variant="dangerGhost"
                    onClick={handleInvalidate}
                    disabled={setMutation.isPending}
                  >
                    Invalider
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setEditing(null)} disabled={setMutation.isPending}>
                  Annuler
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={setMutation.isPending || !editDate}>
                  {setMutation.isPending ? 'Enregistrement…' : editing.isValidated ? 'Mettre à jour' : 'Valider'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
