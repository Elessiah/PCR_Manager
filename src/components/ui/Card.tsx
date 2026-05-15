import React from 'react';
import { cn } from '../../lib/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('bg-surface border border-border rounded-lg shadow-sm', className)}
      {...props}
    />
  )
);

Card.displayName = 'Card';

interface CardHeadProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHead = React.forwardRef<HTMLDivElement, CardHeadProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-5 py-4 border-b border-border flex items-center justify-between', className)}
      {...props}
    />
  )
);

CardHead.displayName = 'CardHead';

interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardBody = React.forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-5', className)} {...props} />
  )
);

CardBody.displayName = 'CardBody';

interface CardTitleProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardTitle = React.forwardRef<HTMLDivElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('font-semibold text-sm', className)}
      {...props}
    />
  )
);

CardTitle.displayName = 'CardTitle';
