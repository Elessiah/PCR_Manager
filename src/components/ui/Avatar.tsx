import React from 'react';
import { cn } from '../../lib/cn';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  size?: 30 | 40 | 48 | 64;
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ name, size = 40, className, ...props }, ref) => {
    const initials = name
      .split(' ')
      .map(s => s[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;

    const sizeClasses = {
      30: 'w-7 h-7 text-[11px]',
      40: 'w-10 h-10 text-sm',
      48: 'w-12 h-12 text-base',
      64: 'w-16 h-16 text-2xl',
    };

    return (
      <div
        ref={ref}
        className={cn('rounded-full flex items-center justify-center font-bold', sizeClasses[size], className)}
        style={{
          background: `oklch(0.92 0.04 ${h})`,
          color: `oklch(0.4 0.1 ${h})`,
        }}
        {...props}
      >
        {initials}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';
