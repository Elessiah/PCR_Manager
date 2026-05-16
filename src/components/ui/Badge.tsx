import React from 'react';
import { Check, Clock, AlertTriangle, Circle } from 'lucide-react';
import { cn } from '../../lib/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'ok' | 'warn' | 'danger' | 'neutral' | 'accent';
  icon?: React.ReactNode | null;
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

    const iconMap = {
      ok: <Check size={12} strokeWidth={2.25} />,
      warn: <Clock size={12} strokeWidth={2.25} />,
      danger: <AlertTriangle size={12} strokeWidth={2.25} />,
      neutral: <Circle size={12} strokeWidth={2.25} />,
      accent: <Circle size={12} strokeWidth={2.25} />,
    };

    const displayIcon = icon !== null ? (icon ?? iconMap[variant]) : null;

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold',
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {displayIcon && <span className="inline-flex">{displayIcon}</span>}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
