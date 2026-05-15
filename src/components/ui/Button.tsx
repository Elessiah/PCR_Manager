import React from 'react';
import { cn } from '../../lib/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'dangerGhost';
  size?: 'default' | 'sm' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'default', className, ...props }, ref) => {
    const variantClasses = {
      default: 'bg-surface border border-border text-text hover:bg-surfaceHover',
      primary: 'bg-accent text-white hover:bg-accentHover',
      ghost: 'bg-transparent text-text hover:bg-surfaceHover',
      dangerGhost: 'bg-transparent text-danger hover:bg-dangerBg',
    };

    const sizeClasses = {
      default: 'h-9 px-3 text-sm',
      sm: 'h-8 px-2.5 text-xs',
      icon: 'h-9 w-9',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded font-medium transition-colors duration-100',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
