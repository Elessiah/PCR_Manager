import { useRef, useEffect, useState, useMemo } from 'react';
import { Search, Bell } from 'lucide-react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { statusFromDate } from '../../lib/status';
import type { Etablissement, Travailleur, Appareil, VerificationTechnique, ControleQualite } from '../../types/domain';

export default function Topbar() {
  const location = useLocation();
  const params = useParams();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    queryKey: ['controles'],
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

  const [panelOpen, setPanelOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const retardActions = useMemo(() => {
    const items: { label: string; detail: string; path: string }[] = [];

    verifications.forEach((v) => {
      let years: number;
      if (v.type_ === 'annuelle_interne') {
        years = 1;
      } else if (v.type_ === 'triennale_externe') {
        years = 3;
      } else {
        return;
      }
      const deadline = new Date(v.date_realisation);
      deadline.setFullYear(deadline.getFullYear() + years);
      const deadlineStr = deadline.toISOString().split('T')[0];
      if (statusFromDate(deadlineStr) === 'en_retard') {
        items.push({
          label: `Vérification — ${v.type_}`,
          detail: `Échue le ${deadline.toLocaleDateString('fr-FR')}`,
          path: `/appareils/${v.appareil_id}`,
        });
      }
    });

    controleQualites.forEach((cq) => {
      if (statusFromDate(cq.date_echeance) === 'en_retard') {
        items.push({
          label: `Contrôle qualité — ${cq.type_}`,
          detail: `Échue le ${new Date(cq.date_echeance!).toLocaleDateString('fr-FR')}`,
          path: `/appareils/${cq.appareil_id}`,
        });
      }
    });

    return items;
  }, [verifications, controleQualites]);

  const count = retardActions.length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setPanelOpen(false);
      }
    };
    if (panelOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panelOpen]);

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
          ref={searchInputRef}
          type="text"
          placeholder="Rechercher travailleur, appareil, document…"
          className="bg-transparent border-0 outline-0 flex-1 text-[13px] placeholder:text-textSoft"
        />
        <kbd className="font-mono text-[10.5px] bg-white border border-border px-[5px] py-px rounded-sm text-textSoft">Ctrl+F</kbd>
      </div>

      {/* Notification bell */}
      <div className="relative">
        <button
          ref={bellRef}
          onClick={() => setPanelOpen((o) => !o)}
          className="relative w-9 h-9 rounded grid place-items-center text-textSoft hover:bg-surface2 hover:text-text transition-colors"
        >
          <Bell size={16} />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-danger text-white text-[9px] flex items-center justify-center px-1 border-2 border-white">
              {count}
            </span>
          )}
        </button>

        {panelOpen && (
          <div
            ref={panelRef}
            className="absolute right-0 top-full mt-2 w-72 bg-surface border border-border rounded-lg shadow-lg z-50 overflow-hidden"
          >
            <div className="px-4 py-2.5 border-b border-border">
              <span className="text-[13px] font-semibold text-text">Actions en retard</span>
            </div>
            {retardActions.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-textSoft text-center">Aucune action en retard</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {retardActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => { navigate(action.path); setPanelOpen(false); }}
                    className="w-full text-left px-4 py-3 hover:bg-surface2 border-b border-border last:border-b-0 transition-colors"
                  >
                    <div className="text-[13px] font-medium text-text">{action.label}</div>
                    <div className="text-[11px] text-danger mt-0.5">{action.detail}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
