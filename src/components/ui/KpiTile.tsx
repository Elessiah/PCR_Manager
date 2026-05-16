import React from 'react';
import { cn } from '../../lib/cn';

interface KpiTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  footer?: React.ReactNode;
  tone?: 'danger' | 'warn' | 'ok';
  /**
   * Élément rendu en haut à droite (typiquement un `<Badge variant="...">`).
   * Le composant est rendu tel quel — ne pas le wrapper dans un Badge ici sinon
   * on obtient un Badge imbriqué (double border, double padding).
   */
  chip?: React.ReactNode;
}

export const KpiTile = React.forwardRef<HTMLDivElement, KpiTileProps>(
  ({ label, value, footer, tone, chip, className, ...props }, ref) => {
    const toneColorMap = {
      danger: 'var(--danger)',
      warn: 'var(--warn)',
      ok: 'var(--ok)',
    };

    const valueColor = tone ? toneColorMap[tone] : 'var(--text)';

    return (
      <div
        ref={ref}
        className={cn(
          'bg-surface border border-border rounded-lg shadow-md p-4 px-5',
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="text-xs font-semibold text-textMuted uppercase tracking-[0.04em]">
            {label}
          </div>
          {chip}
        </div>
        <div
          className="text-[32px] font-bold leading-none tracking-tight tabular-nums font-mono mb-2.5"
          style={{ color: valueColor }}
        >
          {value}
        </div>
        {footer && (
          <div className="text-xs text-textSoft">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

KpiTile.displayName = 'KpiTile';
