import { Search, Bell } from 'lucide-react';
import { useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { statusFromDate } from '../../lib/status';
import type { Etablissement, Travailleur, Appareil, VerificationTechnique, ControleQualite } from '../../types/domain';

export default function Topbar() {
  const location = useLocation();
  const params = useParams();

  const { data: etablissement } = useQuery<Etablissement>({
    queryKey: ['etablissement', 1],
    queryFn: () => api.etablissement.get(1),
    staleTime: 60_000,
  });

  const { data: verifications = [] } = useQuery<VerificationTechnique[]>({
    queryKey: ['verifications'],
    queryFn: () => api.verification.list(),
    staleTime: 60_000,
  });

  const { data: controleQualites = [] } = useQuery<ControleQualite[]>({
    queryKey: ['controleQualites'],
    queryFn: () => api.controleQualite.list(),
    staleTime: 60_000,
  });

  // For detail pages, fetch the specific entity
  const { data: travailleur } = useQuery<Travailleur>({
    queryKey: ['travailleur', params.id],
    queryFn: () => api.travailleur.get(Number(params.id)),
    enabled: location.pathname.startsWith('/travailleurs/') && !!params.id,
    staleTime: 60_000,
  });

  const { data: appareil } = useQuery<Appareil>({
    queryKey: ['appareil', params.id],
    queryFn: () => api.appareil.get(Number(params.id)),
    enabled: location.pathname.startsWith('/appareils/') && !!params.id,
    staleTime: 60_000,
  });

  const countRetardActions = () => {
    let count = 0;

    verifications.forEach((v) => {
      const deadline = new Date(v.date_realisation);
      deadline.setFullYear(deadline.getFullYear() + 1);
      if (statusFromDate(deadline.toISOString().split('T')[0]) === 'en_retard') {
        count++;
      }
    });

    controleQualites.forEach((cq) => {
      if (statusFromDate(cq.date_echeance) === 'en_retard') {
        count++;
      }
    });

    return count;
  };

  const getPageLabel = (): string => {
    const pathname = location.pathname;

    if (pathname === '/') return 'Tableau de bord';
    if (pathname === '/etablissement') return 'Établissement';
    if (pathname === '/travailleurs') return 'Travailleurs';
    if (pathname.startsWith('/travailleurs/') && travailleur) {
      return `${travailleur.prenom} ${travailleur.nom}`;
    }
    if (pathname === '/appareils') return 'Appareils';
    if (pathname.startsWith('/appareils/') && appareil) {
      return appareil.designation;
    }
    if (pathname === '/actions') return 'Actions';

    return 'PCR Manager';
  };

  const hasNotifications = countRetardActions() > 0;

  return (
    <header className="sticky top-0 z-10 h-14 bg-surface border-b border-border flex items-center gap-4 px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-textSoft">
        <span>{etablissement?.denomination ?? 'PCR Manager'}</span>
        <span className="opacity-50">›</span>
        <span className="text-text font-semibold">{getPageLabel()}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="flex items-center gap-2 bg-surface2 border border-border rounded px-2.5 py-1.5 w-[280px] text-textSoft">
        <Search size={14} />
        <input
          type="text"
          placeholder="Rechercher travailleur, appareil, document…"
          className="bg-transparent border-0 outline-0 flex-1 text-[13px] placeholder:text-textSoft"
        />
        <kbd className="font-mono text-[10.5px] bg-white border border-border px-[5px] py-px rounded-sm text-textSoft">⌘K</kbd>
      </div>

      {/* Notification bell */}
      <button className="relative w-9 h-9 rounded grid place-items-center text-textSoft hover:bg-surface2 hover:text-text transition-colors">
        <Bell size={16} />
        {hasNotifications && (
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-danger border-2 border-white" />
        )}
      </button>
    </header>
  );
}
