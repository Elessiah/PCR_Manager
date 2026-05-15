import React from 'react';
import { cn } from '../../lib/cn';

interface PillFilterProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}

export const PillFilter = React.forwardRef<HTMLDivElement, PillFilterProps>(
  ({ options, value, onChange, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'inline-flex bg-surface2 border border-border rounded p-1 gap-0.5',
        className
      )}
      {...props}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'px-3 py-1.5 text-sm rounded font-medium transition-colors',
            value === option.value
              ? 'bg-surface shadow-sm text-text'
              : 'text-textMuted hover:text-text'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
);

PillFilter.displayName = 'PillFilter';
