import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';

interface CompetencesAppareilSubsheetProps {
  appareilId: number;
  travailleurId: number;
}

const STATUS_CYCLE = {
  'non_validee': 'validee_seule',
  'validee_seule': 'validee_complete',
  'validee_complete': 'non_validee',
} as const;

const STATUS_LABELS: Record<string, string> = {
  'non_validee': 'Non validée',
  'validee_seule': 'Validée seule',
  'validee_complete': 'Validée complète',
};

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

  const setMutation = useMutation({
    mutationFn: (input: Parameters<typeof api.competence.set>[0]) =>
      api.competence.set(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competence', travailleurId] });
    },
  });

  const handleCycleStatus = async (competenceRefId: number) => {
    const existing = competences.find(
      c => c.appareil_id === appareilId && c.competence_ref_id === competenceRefId
    );

    const isValidated = existing?.validated === 1;
    const currentStatus = isValidated ? 'validee_seule' : 'non_validee';
    const nextStatus = STATUS_CYCLE[currentStatus as keyof typeof STATUS_CYCLE];

    await setMutation.mutateAsync({
      travailleurId,
      appareilId,
      competenceRefId,
      validated: nextStatus !== 'non_validee' ? 1 : 0,
    });
  };

  const appareilCompetences = competences.filter(c => c.appareil_id === appareilId);

  return (
    <Table>
      <THead>
        <TR>
          <TH>Compétence</TH>
          <TH>Statut</TH>
          <TH style={{ width: 100, textAlign: 'right' }}>Actions</TH>
        </TR>
      </THead>
      <TBody>
        {competenceRefs.map(ref => {
          const competence = appareilCompetences.find(
            c => c.competence_ref_id === ref.id
          );

          const status = competence?.validated === 1 ? 'validee_seule' : 'non_validee';

          return (
            <TR key={ref.id}>
              <TD>{ref.libelle}</TD>
              <TD>
                <span className="text-sm text-textMuted">
                  {STATUS_LABELS[status]}
                </span>
              </TD>
              <TD style={{ textAlign: 'right' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCycleStatus(ref.id)}
                  disabled={setMutation.isPending}
                >
                  Éditer
                </Button>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
