import { LayoutDashboard, Building2, Users, Wrench, ListChecks } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { statusFromDate } from '../../lib/status';
import type { Etablissement, Travailleur, Appareil, VerificationTechnique, ControleQualite } from '../../types/domain';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  countVariant?: 'accent' | 'danger';
}

function getInitials(denomination: string): string {
  return denomination
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
}

export default function Sidebar() {
  const { data: etablissement } = useQuery<Etablissement>({
    queryKey: ['etablissement', 1],
    queryFn: () => api.etablissement.get(1),
    staleTime: 60_000,
  });

  const { data: travailleurs = [] } = useQuery<Travailleur[]>({
    queryKey: ['travailleurs'],
    queryFn: () => api.travailleur.list(),
    staleTime: 60_000,
  });

  const { data: appareils = [] } = useQuery<Appareil[]>({
    queryKey: ['appareils'],
    queryFn: () => api.appareil.list(),
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

  const navItems: NavItem[] = [
    { to: '/', icon: <LayoutDashboard size={16} strokeWidth={1.75} />, label: 'Dashboard' },
    { to: '/etablissement', icon: <Building2 size={16} strokeWidth={1.75} />, label: 'Établissement' },
    { to: '/travailleurs', icon: <Users size={16} strokeWidth={1.75} />, label: 'Travailleurs', count: travailleurs.length, countVariant: 'accent' },
    { to: '/appareils', icon: <Wrench size={16} strokeWidth={1.75} />, label: 'Appareils', count: appareils.length, countVariant: 'accent' },
    { to: '/actions', icon: <ListChecks size={16} strokeWidth={1.75} />, label: 'Actions', count: countRetardActions(), countVariant: 'danger' },
  ];

  return (
    <aside className="sticky top-0 h-screen w-60 bg-surface border-r border-border flex flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3.5 border-b border-border">
        <img
          src="/logo.png"
          alt="PCR Manager"
          className="w-8 h-8 flex-shrink-0 rounded"
        />
        <div>
          <div className="font-bold text-sm tracking-tight">Gestionnaire PCR</div>
          <div className="text-[11px] text-textSoft mt-px">Suivi radioprotection</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-px flex-1 px-2.5 pt-3">
        <div className="text-[11px] font-semibold text-textSoft uppercase tracking-[0.06em] px-2.5 pt-3.5 pb-1.5">
          Navigation
        </div>

        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `flex items-center gap-2.5 px-2.5 py-[7px] rounded text-[13.5px] font-medium ${
              isActive
                ? 'bg-accentSoft text-accent'
                : 'text-textMuted hover:bg-surfaceHover hover:text-text'
            }`}
            end={item.to === '/'}
          >
            {({ isActive }) => (
              <>
                <span className="flex-shrink-0">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.count !== undefined && (
                  <span
                    className={`text-[11px] font-semibold px-[6px] py-px rounded-full border tabular-nums ${
                      item.countVariant === 'danger'
                        ? 'bg-dangerBg border-dangerBorder text-danger'
                        : isActive
                        ? 'bg-white border-accentSoftBorder text-accent'
                        : 'bg-neutralBg border-neutralBorder text-textMuted'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* Établissement Section */}
        <div className="pt-3.5 mt-1.5">
          <div className="text-[11px] font-semibold text-textSoft uppercase tracking-[0.06em] px-2.5 pt-3.5 pb-1.5">
            Établissement
          </div>
          <div className="bg-surface2 border border-border rounded px-3 py-2.5 mx-1.5 my-1">
            <div className="text-[12.5px] font-semibold leading-tight">
              {etablissement?.denomination ?? '—'}
            </div>
            <div className="text-[11px] text-textSoft mt-1">
              {etablissement?.ville ?? '—'}
            </div>
            <div className="text-[10.5px] font-mono text-textSoft mt-1">
              {etablissement?.siret ? `SIRET ${etablissement.siret}` : '—'}
            </div>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="flex items-center gap-2.5 px-3 py-3 border-t border-border">
        <div
          className="w-[30px] h-[30px] rounded-full grid place-items-center font-bold text-xs text-accent flex-shrink-0"
          style={{ background: 'oklch(0.85 0.04 245)' }}
        >
          {etablissement ? getInitials(etablissement.denomination) : '—'}
        </div>
        <div>
          <div className="text-[13px] font-semibold leading-tight">
            {etablissement?.denomination ?? '—'}
          </div>
          <div className="text-[11px] text-textSoft">
            PCR · Administrateur
          </div>
        </div>
      </div>
    </aside>
  );
}
