import React from 'react';
import { cn } from '../../lib/cn';
import { Badge } from './Badge';

interface KpiTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  footer?: React.ReactNode;
  tone?: 'danger' | 'warn' | 'ok';
  chip?: React.ReactNode;
}

export const KpiTile = React.forwardRef<HTMLDivElement, KpiTileProps>(
  ({ label, value, footer, tone, chip, className, ...props }, ref) => {
    const toneClassMap = {
      danger: 'text-danger',
      warn: 'text-warn',
      ok: 'text-ok',
    };

    const valueClass = tone ? toneClassMap[tone] : undefined;

    return (
      <div
        ref={ref}
        className={cn(
          'bg-surface border border-border rounded-lg shadow-sm p-5',
          className
        )}
        {...props}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="text-xs font-medium text-textSoft uppercase tracking-wider">
            {label}
          </div>
          {chip && <Badge variant={tone || 'neutral'}>{chip}</Badge>}
        </div>
        <div className={cn('text-3xl font-bold mono', valueClass)}>
          {value}
        </div>
        {footer && (
          <div className="text-xs text-textMuted mt-2">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

KpiTile.displayName = 'KpiTile';
