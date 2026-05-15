import { LayoutDashboard, Building2, Users, Wrench, ListChecks } from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
}

const navItems: NavItem[] = [
  { to: '/', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
  { to: '/etablissement', icon: <Building2 size={16} />, label: 'Établissement' },
  { to: '/travailleurs', icon: <Users size={16} />, label: 'Travailleurs' },
  { to: '/appareils', icon: <Wrench size={16} />, label: 'Appareils' },
  { to: '/actions', icon: <ListChecks size={16} />, label: 'Actions' },
];

export default function Sidebar() {
  return (
    <aside className="sticky top-0 h-screen w-60 bg-surface border-r border-border flex flex-col p-4">
      {/* Brand */}
      <div className="pb-6">
        <h1 className="text-lg font-semibold text-text">PCR Manager</h1>
      </div>

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
              <span className="text-xs font-medium bg-accentSoft text-accent rounded px-1.5 py-0.5">
                {item.count}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accentSoft text-accent flex items-center justify-center text-xs font-semibold">
            PM
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-text truncate">PCR Manager</div>
            <div className="text-xs text-textMuted truncate">Admin</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
