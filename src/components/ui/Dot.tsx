import React from 'react';
import { cn } from '../../lib/cn';

interface DotProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'ok' | 'warn' | 'danger' | 'neutral';
}

export const Dot = React.forwardRef<HTMLDivElement, DotProps>(
  ({ variant = 'neutral', className, ...props }, ref) => {
    const variantClasses = {
      ok: 'bg-ok',
      warn: 'bg-warn',
      danger: 'bg-danger',
      neutral: 'bg-neutral',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'h-2 w-2 rounded-full inline-block',
          variantClasses[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Dot.displayName = 'Dot';
