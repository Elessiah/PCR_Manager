import React from 'react';
import { cn } from '../../lib/cn';

interface KpiTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  footer?: React.ReactNode;
}

export const KpiTile = React.forwardRef<HTMLDivElement, KpiTileProps>(
  ({ label, value, footer, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-surface border border-border rounded-lg shadow-sm p-5',
        className
      )}
      {...props}
    >
      <div className="text-xs font-medium text-textSoft uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className="text-3xl font-bold mono">
        {value}
      </div>
      {footer && (
        <div className="text-xs text-textMuted mt-2">
          {footer}
        </div>
      )}
    </div>
  )
);

KpiTile.displayName = 'KpiTile';
