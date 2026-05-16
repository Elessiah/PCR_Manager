import React from 'react';
import { cn } from '../../lib/cn';

interface ReadFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}

export const ReadField = React.forwardRef<HTMLDivElement, ReadFieldProps>(
  ({ label, value, mono, className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1.5', className)} {...props}>
      <div className="text-xs font-medium text-textMuted">{label}</div>
      <div className={cn('text-sm text-text', mono && 'font-mono')}>
        {value || '–'}
      </div>
    </div>
  )
);

ReadField.displayName = 'ReadField';
