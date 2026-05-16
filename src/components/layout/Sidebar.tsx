import { LayoutDashboard, Building2, Users, Wrench, ListChecks } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { statusFromDate } from '../../lib/status';
import { Badge } from '../ui/Badge';
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
    { to: '/', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
    { to: '/etablissement', icon: <Building2 size={16} />, label: 'Établissement' },
    { to: '/travailleurs', icon: <Users size={16} />, label: 'Travailleurs', count: travailleurs.length, countVariant: 'accent' },
    { to: '/appareils', icon: <Wrench size={16} />, label: 'Appareils', count: appareils.length, countVariant: 'accent' },
    { to: '/actions', icon: <ListChecks size={16} />, label: 'Actions', count: countRetardActions(), countVariant: 'danger' },
  ];

  return (
    <aside className="sticky top-0 h-screen w-60 bg-surface border-r border-border flex flex-col p-4">
      {/* Brand Header */}
      <div className="pb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-accent text-white flex items-center justify-center text-xs font-mono font-bold">
            RP
          </div>
          <h1 className="text-lg font-semibold text-text">Gestionnaire PCR</h1>
        </div>
        <p className="text-xs text-textMuted mt-1">Suivi radioprotection</p>
      </div>

      {/* Navigation Label */}
      <div className="text-xs font-semibold text-textSoft uppercase tracking-widest mb-2 px-2.5">Navigation</div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm text-textMuted hover:bg-surfaceHover transition-colors ${
                isActive
                  ? 'bg-accentSoft text-accent border border-accentSoftBorder'
                  : ''
              }`
            }
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.count !== undefined && (
              <Badge variant={item.countVariant || 'accent'}>
                {item.count}
              </Badge>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Établissement Section */}
      <div className="py-3 border-t border-border">
        <div className="text-xs font-semibold text-textSoft uppercase tracking-widest mb-2 px-0.5">
          Établissement
        </div>
        <div className="bg-surface2 rounded p-3 border border-border">
          <div className="text-sm font-medium text-text leading-snug">
            {etablissement?.denomination || '—'}
          </div>
          <div className="text-xs text-textMuted mt-1">
            {etablissement?.ville || '—'}
          </div>
          <div className="text-xs font-mono text-textMuted mt-1">
            SIRET {etablissement?.siret || '—'}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accentSoft text-accent flex items-center justify-center text-xs font-semibold flex-shrink-0">
            {etablissement ? getInitials(etablissement.denomination) : '—'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-text truncate">
              {etablissement?.denomination || '—'}
            </div>
            <div className="text-xs text-textMuted truncate">
              PCR · Administrateur
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
