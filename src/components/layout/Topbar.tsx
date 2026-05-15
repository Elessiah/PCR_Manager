import { Search } from 'lucide-react';

interface Breadcrumb {
  label: string;
  to?: string;
}

interface TopbarProps {
  breadcrumb?: Breadcrumb[];
}

export default function Topbar({ breadcrumb = [] }: TopbarProps) {
  return (
    <header className="sticky top-0 z-10 h-14 bg-surface border-b border-border flex items-center justify-between px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-textMuted">
        {breadcrumb.length > 0 ? (
          breadcrumb.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {item.to ? (
                <a href={item.to} className="text-accent hover:text-accentHover">
                  {item.label}
                </a>
              ) : (
                <span className="text-text font-medium">{item.label}</span>
              )}
              {idx < breadcrumb.length - 1 && <span className="text-textMuted">/</span>}
            </div>
          ))
        ) : (
          <span className="text-textMuted">Home</span>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="w-80 h-9 bg-surface2 border border-border rounded flex items-center gap-2 px-3">
          <Search size={14} className="text-textMuted flex-shrink-0" />
          <input
            type="text"
            placeholder="Rechercher..."
            className="flex-1 bg-transparent text-sm text-text placeholder-textMuted outline-none"
          />
        </div>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-accentSoft text-accent flex items-center justify-center text-xs font-semibold flex-shrink-0">
          PM
        </div>
      </div>
    </header>
  );
}
