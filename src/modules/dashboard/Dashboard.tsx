import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { KpiTile } from '../../components/ui/KpiTile';
import { Card, CardHead, CardBody, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Dot } from '../../components/ui/Dot';
import { api } from '../../lib/api';
import { statusFromDate, statusToBadgeVariant } from '../../lib/status';
import AlertesCard from './AlertesCard';

export default function Dashboard() {
  const { data: travailleurs = [], isLoading: loadingTrav } = useQuery({
    queryKey: ['travailleurs'],
    queryFn: () => api.travailleur.list(),
  });

  const { data: appareils = [], isLoading: loadingApp } = useQuery({
    queryKey: ['appareils'],
    queryFn: () => api.appareil.list(),
  });

  const { data: verifications = [], isLoading: loadingVerif } = useQuery({
    queryKey: ['verifications'],
    queryFn: () => api.verification.list(),
  });

  const { data: controles = [], isLoading: loadingControle } = useQuery({
    queryKey: ['controles'],
    queryFn: () => api.controleQualite.list(),
  });

  const countAlertsInRetard = () => {
    const verificationsRetard = verifications.filter(
      v => statusFromDate(v.date_realisation, 1) === 'en_retard'
    ).length;
    const controlesRetard = controles.filter(
      c => statusFromDate(c.date_echeance, 1) === 'en_retard'
    ).length;
    return verificationsRetard + controlesRetard;
  };

  const isLoading = loadingTrav || loadingApp || loadingVerif || loadingControle;

  if (isLoading) {
    return <div className="p-8 text-textMuted text-sm">Chargement des données...</div>;
  }

  const alertsInRetard = countAlertsInRetard();

  return (
    <div className="space-y-6 p-8">
      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-4">
        <KpiTile
          label="Travailleurs actifs"
          value={travailleurs.length}
          footer="Personnes en activité"
        />
        <KpiTile
          label="Appareils suivis"
          value={appareils.length}
          footer="Équipements médicaux"
        />
        <KpiTile
          label="Alertes en retard"
          value={alertsInRetard}
          footer="Échéances dépassées"
        />
      </div>

      {/* Alert Cards Grid */}
      <div className="grid grid-cols-2 gap-4">
        <AlertesCard
          titre="Formations"
          icone="📚"
          alertes={[]}
          alertMonths={12}
        />
        <AlertesCard
          titre="Dosimétries"
          icone="☢️"
          alertes={[]}
          alertMonths={12}
        />
        <AlertesCard
          titre="Vérifications techniques"
          icone="🔧"
          alertes={verifications.map(v => ({
            libelle: `${v.type_} - ${v.organisme || 'N/A'}`,
            deadline: v.date_realisation,
            lienId: v.id,
          }))}
          alertMonths={1}
        />
        <AlertesCard
          titre="Contrôles qualité"
          icone="✓"
          alertes={controles.map(c => ({
            libelle: `${c.type_} - ${c.organisme || 'N/A'}`,
            deadline: c.date_echeance,
            lienId: c.id,
          }))}
          alertMonths={1}
        />
      </div>

      {/* Visites Médicales Card */}
      <AlertesCard
        titre="Visites médicales"
        icone="👨‍⚕️"
        alertes={[]}
        alertMonths={12}
      />

      {/* Info Box */}
      <Card>
        <CardBody>
          <p className="text-xs text-textMuted">
            ⚠️ Formations, Dosimétries et Visites médicales nécessitent une API pour récupérer les habilitations des travailleurs.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
