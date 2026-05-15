import React from 'react';
import { Card, CardHead, CardBody, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { statusFromDate, statusToBadgeVariant } from '../../lib/status';

interface Alerte {
  libelle: string;
  deadline: string | null;
  lienId?: number;
}

interface AlertesCardProps {
  titre: string;
  icone: React.ReactNode | string;
  alertes: Alerte[];
  alertMonths?: number;
}

export default function AlertesCard({
  titre,
  icone,
  alertes,
  alertMonths = 1,
}: AlertesCardProps) {
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const displayAlertes = alertes.slice(0, 5);

  return (
    <Card>
      <CardHead>
        <div className="flex items-center gap-2">
          <span className="text-lg">{icone}</span>
          <CardTitle>{titre}</CardTitle>
        </div>
      </CardHead>
      <CardBody>
        {displayAlertes.length === 0 ? (
          <div className="text-xs text-textMuted py-3">Aucune alerte</div>
        ) : (
          <div className="space-y-0">
            {displayAlertes.map((alerte, idx) => {
              const status = statusFromDate(alerte.deadline, alertMonths);
              const variant = statusToBadgeVariant[status];
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between py-1.5 border-b border-border last:border-b-0"
                >
                  <span className="text-sm text-text flex-1 truncate">{alerte.libelle}</span>
                  <Badge variant={variant} className="ml-2 flex-shrink-0">
                    {formatDate(alerte.deadline)}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
