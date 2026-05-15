import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { habilitationToBadge } from '../../lib/habilitation';
import { Badge } from '../../components/ui/Badge';
import { Dot } from '../../components/ui/Dot';
import { Card, CardBody, CardHead, CardTitle } from '../../components/ui/Card';
import CompetencesAppareilSubsheet from './CompetencesAppareilSubsheet';

interface HabilitationTabProps {
  travailleurId: number;
}

export default function HabilitationTab({ travailleurId }: HabilitationTabProps) {
  const { data: habStatus } = useQuery({
    queryKey: ['habilitation', travailleurId],
    queryFn: () => api.habilitation.compute(travailleurId),
  });

  const { data: travailleurs = [] } = useQuery({
    queryKey: ['travailleurs'],
    queryFn: () => api.travailleur.list(),
  });

  const { data: appareils = [] } = useQuery({
    queryKey: ['appareils'],
    queryFn: () => api.appareil.list(),
  });

  const travailleur = travailleurs.find(t => t.id === travailleurId);

  if (!habStatus || !travailleur) {
    return null;
  }

  const badge = habilitationToBadge[habStatus.statut];
  const details = habStatus.details;

  const getDotVariant = (isOk: boolean): 'ok' | 'warn' | 'danger' | 'neutral' => {
    return isOk ? 'ok' : 'neutral';
  };

  const travailleurAppareils = appareils.filter(
    a => a.etablissement_id === travailleur.etablissement_id
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex items-center gap-4">
          <div>
            <div className="text-xs font-semibold text-textMuted uppercase tracking-wider">
              Statut global
            </div>
            <Badge variant={badge.variant} className="mt-2">
              {badge.label}
            </Badge>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHead>
          <CardTitle>Items d'habilitation</CardTitle>
        </CardHead>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <span className="text-sm font-medium">Formation radioprotection</span>
            <Dot variant={getDotVariant(details.formation_rp_ok)} />
          </div>
          <div className="flex items-center justify-between p-3 border-b border-border">
            <span className="text-sm font-medium">Dosimétries</span>
            <Dot variant={getDotVariant(details.dosimetries_ok)} />
          </div>
          <div className="flex items-center justify-between p-3 border-b border-border">
            <span className="text-sm font-medium">Compétences</span>
            <Dot variant={getDotVariant(details.competences_ok)} />
          </div>
          <div className="flex items-center justify-between p-3">
            <span className="text-sm font-medium">Visite médicale</span>
            <Dot variant={getDotVariant(details.visite_med_ok)} />
          </div>
        </CardBody>
      </Card>

      {travailleurAppareils.length > 0 && (
        <Card>
          <CardHead>
            <CardTitle>Compétences par appareil</CardTitle>
          </CardHead>
          <CardBody className="space-y-6">
            {travailleurAppareils.map(appareil => (
              <div key={appareil.id}>
                <h4 className="font-medium mb-3">{appareil.designation}</h4>
                <CompetencesAppareilSubsheet
                  appareilId={appareil.id}
                  travailleurId={travailleurId}
                />
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
