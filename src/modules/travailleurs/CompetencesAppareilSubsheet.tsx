import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Check } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';

interface CompetencesAppareilSubsheetProps {
  appareilId: number;
  travailleurId: number;
}

export default function CompetencesAppareilSubsheet({
  appareilId,
  travailleurId,
}: CompetencesAppareilSubsheetProps) {
  const queryClient = useQueryClient();

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

  const handleToggle = async (competenceRefId: number) => {
    const existing = competences.find(
      c => c.appareil_id === appareilId && c.competence_ref_id === competenceRefId
    );

    const isValidated = existing?.validated === 1;

    await setMutation.mutateAsync({
      travailleurId,
      appareilId,
      competenceRefId,
      validated: isValidated ? 0 : 1,
    });
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  const appareilCompetences = competences.filter(c => c.appareil_id === appareilId);
  const requiredSet = new Set(requiredCompetenceIds);
  const filteredRefs = competenceRefs.filter(c => c.propre_appareil === 1 && requiredSet.has(c.id));
  const validatedCount = filteredRefs.filter(ref => {
    const competence = appareilCompetences.find(c => c.competence_ref_id === ref.id);
    return competence?.validated === 1;
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
              const checked = competence?.validated === 1;

              return (
                <button
                  key={ref.id}
                  onClick={() => handleToggle(ref.id)}
                  disabled={setMutation.isPending}
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
                    <div className="text-xs text-textMuted mono">{String(idx + 1).padStart(2, '0')}</div>
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
    </div>
  );
}
