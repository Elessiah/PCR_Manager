import React from 'react';
import { cn } from '../../lib/cn';

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, ...props }, ref) => (
    <table
      ref={ref}
      className={cn('w-full text-sm border-collapse', className)}
      {...props}
    />
  )
);

Table.displayName = 'Table';

interface THeadProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export const THead = React.forwardRef<HTMLTableSectionElement, THeadProps>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn('bg-surface2', className)}
      {...props}
    />
  )
);

THead.displayName = 'THead';

interface TBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export const TBody = React.forwardRef<HTMLTableSectionElement, TBodyProps>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn(className)} {...props} />
  )
);

TBody.displayName = 'TBody';

interface TRProps extends React.HTMLAttributes<HTMLTableRowElement> {}

export const TR = React.forwardRef<HTMLTableRowElement, TRProps>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn('hover:bg-surfaceHover', className)}
      {...props}
    />
  )
);

TR.displayName = 'TR';

interface THProps extends React.ThHTMLAttributes<HTMLTableCellElement> {}

export const TH = React.forwardRef<HTMLTableCellElement, THProps>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'text-left uppercase text-xs font-medium px-3 py-2 border-b border-border text-textSoft',
        className
      )}
      {...props}
    />
  )
);

TH.displayName = 'TH';

interface TDProps extends React.TdHTMLAttributes<HTMLTableCellElement> {}

export const TD = React.forwardRef<HTMLTableCellElement, TDProps>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn('px-3 py-2 border-b border-border', className)}
      {...props}
    />
  )
);

TD.displayName = 'TD';
