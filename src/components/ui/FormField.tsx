import React from 'react';
import { cn } from '../../lib/cn';

interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1.5', className)} {...props} />
  )
);

Field.displayName = 'Field';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-xs font-medium text-textMuted', className)}
      {...props}
    />
  )
);

Label.displayName = 'Label';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full h-9 px-3 rounded border border-border bg-surface text-text focus:outline-none focus:border-accent focus:ring-2 focus:ring-accentSoft',
        className
      )}
      {...props}
    />
  )
);

Input.displayName = 'Input';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full h-9 px-3 rounded border border-border bg-surface text-text focus:outline-none focus:border-accent focus:ring-2 focus:ring-accentSoft',
        className
      )}
      {...props}
    />
  )
);

Select.displayName = 'Select';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full px-3 py-2 rounded border border-border bg-surface text-text focus:outline-none focus:border-accent focus:ring-2 focus:ring-accentSoft',
        className
      )}
      {...props}
    />
  )
);

Textarea.displayName = 'Textarea';
