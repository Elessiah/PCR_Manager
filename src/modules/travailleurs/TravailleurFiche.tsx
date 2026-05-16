import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { ChevronLeft, Users, Shield } from 'lucide-react';
import { habilitationToBadge } from '../../lib/habilitation';
import DonneesPersonnellesTab from './DonneesPersonnellesTab';
import HabilitationTab from './HabilitationTab';

export default function TravailleurFiche() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'perso' | 'hab'>('perso');

  const { data: travailleur } = useQuery({
    queryKey: ['travailleur', id],
    queryFn: () => api.travailleur.get(Number(id!)),
    enabled: !!id,
  });

  const { data: habStatus } = useQuery({
    queryKey: ['habilitation', id],
    queryFn: () => api.habilitation.compute(Number(id!)),
    enabled: !!id,
  });

  if (!travailleur) return null;

  const habBadge = habStatus ? habilitationToBadge[habStatus.statut] : null;

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate('/travailleurs')}
        className="inline-flex items-center gap-1.5 text-textSoft text-[13px] hover:text-text transition-colors"
      >
        <ChevronLeft size={14} /> Travailleurs
      </button>

      <div className="flex items-center gap-4 mb-6">
        <Avatar name={`${travailleur.prenom} ${travailleur.nom}`} size={64} />
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {travailleur.prenom} {travailleur.nom}
          </h1>
          <div className="flex items-center gap-2.5 flex-wrap text-[14px] text-textMuted mt-1">
            {travailleur.fonction && <span>{travailleur.fonction}</span>}
            {travailleur.fonction && travailleur.categorie_reglementaire && <span>·</span>}
            {travailleur.categorie_reglementaire && <span>Catégorie {travailleur.categorie_reglementaire}</span>}
            {(travailleur.fonction || travailleur.categorie_reglementaire) && travailleur.date_debut_activite && <span>·</span>}
            {travailleur.date_debut_activite && <span>Depuis {new Date(travailleur.date_debut_activite).getFullYear()}</span>}
          </div>
        </div>
        {habBadge && (
          <div className="text-right">
            <div className="text-[11px] font-semibold text-textSoft uppercase tracking-[0.05em] mb-1">
              Habilitation
            </div>
            <Badge variant={habBadge.variant}>{habBadge.label}</Badge>
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b border-border mb-5 -mb-px">
        {[
          { value: 'perso', label: 'Données personnelles', icon: Users },
          { value: 'hab', label: 'Habilitation', icon: Shield },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value as 'perso' | 'hab')}
            className={`bg-transparent border-0 px-3.5 py-2.5 font-semibold text-[13.5px] inline-flex items-center gap-2 border-b-2 -mb-px transition-colors ${
              activeTab === tab.value
                ? 'text-accent border-accent'
                : 'text-textMuted border-transparent hover:text-text'
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'perso' && <DonneesPersonnellesTab travailleur={travailleur} />}
      {activeTab === 'hab' && <HabilitationTab travailleurId={Number(id!)} />}
    </div>
  );
}
