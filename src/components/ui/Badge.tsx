import React from 'react';
import { cn } from '../../lib/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'ok' | 'warn' | 'danger' | 'neutral' | 'accent';
  icon?: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'neutral', icon, className, children, ...props }, ref) => {
    const variantClasses = {
      ok: 'bg-okBg border border-okBorder text-ok',
      warn: 'bg-warnBg border border-warnBorder text-warn',
      danger: 'bg-dangerBg border border-dangerBorder text-danger',
      neutral: 'bg-neutralBg border border-neutralBorder text-textMuted',
      accent: 'bg-accentSoft border border-accentSoftBorder text-accent',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {icon && <span className="inline-flex">{icon}</span>}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
