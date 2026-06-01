import { LayoutDashboard, Building2, Users, Wrench, ListChecks, BookOpen, LogOut } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { statusFromDate } from '../../lib/status';
import type { Etablissement, Travailleur, Appareil, VerificationTechnique, ControleQualite, Habilitation, HabilitationStatus } from '../../types/domain';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  countVariant?: 'accent' | 'danger' | 'warn' | 'neutral';
}

function getInitials(denomination: string | null | undefined): string {
  if (!denomination) return '?';
  return denomination
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
}

export default function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

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
    queryKey: ['controles'],
    queryFn: () => api.controleQualite.list(),
    staleTime: 60_000,
  });

  const habilitationQueries = useQueries({
    queries: travailleurs.map((t) => ({
      queryKey: ['habilitation', 'raw', t.id],
      queryFn: () => api.habilitation.getForTravailleur(t.id),
    })),
  });

  const habStatusQueries = useQueries({
    queries: travailleurs.map((t) => ({
      queryKey: ['habilitation', t.id],
      queryFn: () => api.habilitation.compute(t.id),
    })),
  });

  const computeActionsCounter = (): { count: number; variant: 'danger' | 'warn' | 'neutral' } => {
    let retard = 0;
    let aPrevoir = 0;
    let nonRenseigne = 0;

    const track = (deadline: string | null) => {
      const s = statusFromDate(deadline, 3);
      if (s === 'en_retard') retard++;
      else if (s === 'a_prevoir') aPrevoir++;
      else if (s === 'non_applicable') nonRenseigne++;
    };

    // Vérifications techniques : seulement la plus récente par (appareil, type)
    const latestVerifs = new Map<string, VerificationTechnique>();
    verifications.forEach(v => {
      const key = `${v.appareil_id}:${v.type_}`;
      const existing = latestVerifs.get(key);
      if (!existing || v.date_realisation > existing.date_realisation) {
        latestVerifs.set(key, v);
      }
    });
    latestVerifs.forEach((v) => {
      let years: number;
      if (v.type_ === 'annuelle_interne') years = 1;
      else if (v.type_ === 'triennale_externe') years = 3;
      else return;
      const deadline = new Date(v.date_realisation);
      deadline.setFullYear(deadline.getFullYear() + years);
      track(deadline.toISOString().split('T')[0]);
    });

    // Appareils sans vérification → non renseigné
    appareils.forEach((appareil) => {
      if (!latestVerifs.has(`${appareil.id}:annuelle_interne`)) nonRenseigne++;
      if (!latestVerifs.has(`${appareil.id}:triennale_externe`)) nonRenseigne++;
    });

    // Contrôles qualité non réalisés
    controleQualites.forEach((cq) => {
      if (cq.statut === 'realise') return;
      track(cq.date_echeance);
    });

    // Habilitations
    const habMap = new Map<number, Habilitation>();
    habilitationQueries.forEach((q, idx) => {
      if (q.data && travailleurs[idx]) habMap.set(travailleurs[idx].id, q.data);
    });

    const habStatusMap = new Map<number, HabilitationStatus>();
    habStatusQueries.forEach((q, idx) => {
      if (q.data && travailleurs[idx]) habStatusMap.set(travailleurs[idx].id, q.data as HabilitationStatus);
    });

    travailleurs.forEach((t) => {
      const hab = habMap.get(t.id);
      if (!hab) return;

      if (hab.formation_rp_travailleurs_date) {
        const d = new Date(hab.formation_rp_travailleurs_date);
        d.setFullYear(d.getFullYear() + 3);
        track(d.toISOString().split('T')[0]);
      } else { nonRenseigne++; }

      if (hab.formation_rp_patients_date) {
        const d = new Date(hab.formation_rp_patients_date);
        d.setFullYear(d.getFullYear() + 7);
        track(d.toISOString().split('T')[0]);
      } else { nonRenseigne++; }

      if (hab.dosimetrie_passive_date) {
        const d = new Date(hab.dosimetrie_passive_date);
        d.setFullYear(d.getFullYear() + 2);
        track(d.toISOString().split('T')[0]);
      } else { nonRenseigne++; }

      if (hab.dosimetrie_operationnelle_date) {
        const d = new Date(hab.dosimetrie_operationnelle_date);
        d.setFullYear(d.getFullYear() + 2);
        track(d.toISOString().split('T')[0]);
      } else { nonRenseigne++; }

      if (hab.visite_medicale_date_peremption) {
        track(hab.visite_medicale_date_peremption);
      } else if (hab.visite_medicale_date) {
        const d = new Date(hab.visite_medicale_date);
        if (hab.visite_medicale_duree_mois) d.setMonth(d.getMonth() + hab.visite_medicale_duree_mois);
        else d.setFullYear(d.getFullYear() + 1);
        track(d.toISOString().split('T')[0]);
      } else { nonRenseigne++; }

      const status = habStatusMap.get(t.id);
      if (status?.details?.competences_ok === false) nonRenseigne++;
    });

    const count = retard + aPrevoir + nonRenseigne;
    const variant = retard > 0 ? 'danger' : aPrevoir > 0 ? 'warn' : 'neutral';
    return { count, variant };
  };

  const actionsCounter = computeActionsCounter();

  const navItems: NavItem[] = [
    { to: '/', icon: <LayoutDashboard size={16} strokeWidth={1.75} />, label: 'Dashboard' },
    { to: '/etablissement', icon: <Building2 size={16} strokeWidth={1.75} />, label: 'Établissement' },
    { to: '/travailleurs', icon: <Users size={16} strokeWidth={1.75} />, label: 'Travailleurs', count: travailleurs.length, countVariant: 'accent' },
    { to: '/appareils', icon: <Wrench size={16} strokeWidth={1.75} />, label: 'Appareils', count: appareils.length, countVariant: 'accent' },
    { to: '/competences', icon: <BookOpen size={16} strokeWidth={1.75} />, label: 'Compétences' },
    { to: '/actions', icon: <ListChecks size={16} strokeWidth={1.75} />, label: 'Actions', count: actionsCounter.count, countVariant: actionsCounter.variant },
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
                        : item.countVariant === 'warn'
                        ? 'bg-warnBg border-warnBorder text-warn'
                        : item.countVariant === 'neutral'
                        ? 'bg-neutralBg border-neutralBorder text-textMuted'
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
        <button
          onClick={handleLogout}
          title="Se déconnecter"
          className="ml-auto w-7 h-7 rounded grid place-items-center text-textSoft hover:bg-surface2 hover:text-danger transition-colors"
        >
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}
