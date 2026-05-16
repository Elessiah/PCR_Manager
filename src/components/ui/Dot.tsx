import React from 'react';
import { cn } from '../../lib/cn';

interface DotProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'ok' | 'warn' | 'danger' | 'neutral' | 'accent';
}

export const Dot = React.forwardRef<HTMLSpanElement, DotProps>(
  ({ variant = 'neutral', className, ...props }, ref) => {
    const variantMap = {
      ok: 'var(--ok)',
      warn: 'var(--warn)',
      danger: 'var(--danger)',
      neutral: 'var(--neutral)',
      accent: 'var(--accent)',
    };

    return (
      <span
        ref={ref}
        className={cn('inline-block w-2 h-2 rounded-full', className)}
        style={{ backgroundColor: variantMap[variant] }}
        {...props}
      />
    );
  }
);

Dot.displayName = 'Dot';
