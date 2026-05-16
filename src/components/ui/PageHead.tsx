import React from 'react';
import { cn } from '../../lib/cn';

interface PageHeadProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHead = React.forwardRef<HTMLDivElement, PageHeadProps>(
  ({ title, sub, actions, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-end justify-between gap-6 mb-6', className)}
        {...props}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight m-0">{title}</h1>
          {sub && <p className="text-sm text-textMuted mt-1">{sub}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    );
  }
);

PageHead.displayName = 'PageHead';
