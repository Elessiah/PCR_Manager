import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';
import { ArrowLeft } from 'lucide-react';
import DonneesPersonnellesTab from './DonneesPersonnellesTab';
import HabilitationTab from './HabilitationTab';

export default function TravailleurFiche() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'donnees' | 'habilitation'>('donnees');

  const { data: travailleur } = useQuery({
    queryKey: ['travailleur', id],
    queryFn: () => api.travailleur.get(Number(id!)),
    enabled: !!id,
  });

  if (!travailleur) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-textMuted mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/travailleurs')}
          className="inline-flex items-center gap-2"
        >
          <ArrowLeft size={14} />
          Travailleurs
        </Button>
        <span>/</span>
        <span>{travailleur.prenom} {travailleur.nom}</span>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{travailleur.prenom} {travailleur.nom.toUpperCase()}</h1>
        <div className="flex items-center gap-2 text-sm text-textMuted">
          {travailleur.fonction && <span>{travailleur.fonction}</span>}
          {travailleur.fonction && travailleur.categorie_reglementaire && <span>·</span>}
          {travailleur.categorie_reglementaire && <span>Catégorie {travailleur.categorie_reglementaire}</span>}
        </div>
      </div>

      <Tabs>
        <TabList>
          <Tab
            active={activeTab === 'donnees'}
            onClick={() => setActiveTab('donnees')}
          >
            Données personnelles
          </Tab>
          <Tab
            active={activeTab === 'habilitation'}
            onClick={() => setActiveTab('habilitation')}
          >
            Habilitation
          </Tab>
        </TabList>

        {activeTab === 'donnees' && (
          <TabPanel className="mt-6">
            <DonneesPersonnellesTab travailleur={travailleur} />
          </TabPanel>
        )}

        {activeTab === 'habilitation' && (
          <TabPanel className="mt-6">
            <HabilitationTab travailleurId={Number(id!)} />
          </TabPanel>
        )}
      </Tabs>
    </div>
  );
}
