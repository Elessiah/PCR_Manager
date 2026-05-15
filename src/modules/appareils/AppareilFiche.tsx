import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHead, CardTitle } from '../../components/ui/Card';
import { Label } from '../../components/ui/FormField';
import { ArrowLeft } from 'lucide-react';
import VerificationsSection from './VerificationsSection';
import ControlesQualiteSection from './ControlesQualiteSection';

export default function AppareilFiche() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: appareil } = useQuery({
    queryKey: ['appareil', id],
    queryFn: () => api.appareil.get(Number(id!)),
    enabled: !!id,
  });

  if (!appareil) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-textMuted mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/appareils')}
          className="inline-flex items-center gap-2"
        >
          <ArrowLeft size={14} />
          Appareils
        </Button>
        <span>/</span>
        <span>{appareil.designation}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{appareil.designation}</h1>
          <div className="flex items-center gap-2 text-sm text-textMuted">
            {appareil.marque && <span>{appareil.marque}</span>}
            {appareil.marque && appareil.modele && <span>·</span>}
            {appareil.modele && <span>{appareil.modele}</span>}
            {(appareil.marque || appareil.modele) && appareil.numero_serie && <span>·</span>}
            {appareil.numero_serie && <span className="font-mono">{appareil.numero_serie}</span>}
          </div>
        </div>
        <Button variant="primary" className="inline-flex items-center gap-2">
          Enregistrer
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHead>
            <CardTitle>Informations générales</CardTitle>
          </CardHead>
          <CardBody className="space-y-4">
            <div>
              <Label>Marque</Label>
              <div className="text-sm text-text">{appareil.marque || '-'}</div>
            </div>
            <div>
              <Label>Modèle</Label>
              <div className="text-sm text-text">{appareil.modele || '-'}</div>
            </div>
            <div>
              <Label>Numéro de série</Label>
              <div className="text-sm font-mono text-text">{appareil.numero_serie || '-'}</div>
            </div>
            <div>
              <Label>Type</Label>
              <div className="text-sm text-text">{appareil.type_ || '-'}</div>
            </div>
            <div>
              <Label>Année de mise en service</Label>
              <div className="text-sm text-text">{appareil.annee_mise_en_service || '-'}</div>
            </div>
            <div>
              <Label>Lieu d'utilisation</Label>
              <div className="text-sm text-text">{appareil.lieu_utilisation || '-'}</div>
            </div>
            <div>
              <Label>Utilisation partagée</Label>
              <div className="text-sm text-text">{appareil.utilisation_partagee ? 'Oui' : 'Non'}</div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHead>
            <CardTitle>Caractéristiques techniques</CardTitle>
          </CardHead>
          <CardBody className="space-y-4">
            <div>
              <Label>Tension nominale (kV)</Label>
              <div className="text-sm font-mono text-text">{appareil.tension_nominale_kv ? `${appareil.tension_nominale_kv} kV` : '-'}</div>
            </div>
            <div>
              <Label>Intensité maximale (mA)</Label>
              <div className="text-sm font-mono text-text">{appareil.intensite_maximale_ma ? `${appareil.intensite_maximale_ma} mA` : '-'}</div>
            </div>
          </CardBody>
        </Card>
      </div>

      <VerificationsSection appareilId={Number(id!)} />
      <ControlesQualiteSection appareilId={Number(id!)} />
    </div>
  );
}
