import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody, CardHead, CardTitle } from '../../components/ui/Card';
import { Activity, GraduationCap, Stethoscope, CheckCircle2 } from 'lucide-react';
import CompetencesAppareilSubsheet from './CompetencesAppareilSubsheet';

interface HabilitationTabProps {
  travailleurId: number;
}

export default function HabilitationTab({ travailleurId }: HabilitationTabProps) {
  const { data: habStatus } = useQuery({
    queryKey: ['habilitation', travailleurId],
    queryFn: () => api.habilitation.compute(travailleurId),
  });

  const { data: appareils = [] } = useQuery({
    queryKey: ['appareils'],
    queryFn: () => api.appareil.list(),
  });

  const { data: travailleur } = useQuery({
    queryKey: ['travailleur', travailleurId],
    queryFn: () => api.travailleur.get(travailleurId),
  });

  if (!habStatus || !travailleur) {
    return null;
  }

  const details = habStatus.details;
  const travailleurAppareils = appareils.filter(
    a => a.etablissement_id === travailleur.etablissement_id
  );

  const habItems = [
    {
      icon: Activity,
      title: 'Dosimétries',
      ok: details.dosimetries_ok,
    },
    {
      icon: GraduationCap,
      title: 'Formation radioprotection',
      ok: details.formation_rp_ok,
    },
    {
      icon: CheckCircle2,
      title: 'Compétences',
      ok: details.competences_ok,
    },
    {
      icon: Stethoscope,
      title: 'Visite médicale',
      ok: details.visite_med_ok,
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
              key={i}
              className={`flex items-center gap-3.5 px-4 py-3.5 ${i < habItems.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="w-8 h-8 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-textMuted" />
              </div>
              <div className="flex-1">
                <div className="font-medium">{item.title}</div>
              </div>
              <Badge variant={item.ok ? 'ok' : 'neutral'}>
                {item.ok ? 'Validé' : 'Non validé'}
              </Badge>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHead>
          <CardTitle>Compétences par appareil</CardTitle>
        </CardHead>
        <CardBody className="space-y-4">
          {travailleurAppareils.map((appareil) => (
            <CompetencesAppareilSubsheet
              key={appareil.id}
              appareilId={appareil.id}
              travailleurId={travailleurId}
            />
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
