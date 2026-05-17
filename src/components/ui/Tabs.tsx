import React from 'react';
import { cn } from '../../lib/cn';

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn(className)} {...props} />
  )
);

Tabs.displayName = 'Tabs';

interface TabListProps extends React.HTMLAttributes<HTMLDivElement> {}

export const TabList = React.forwardRef<HTMLDivElement, TabListProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex border-b border-border', className)}
      {...props}
    />
  )
);

TabList.displayName = 'TabList';

interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const Tab = React.forwardRef<HTMLButtonElement, TabProps>(
  ({ active = false, className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'px-4 py-2.5 text-sm border-b-2 border-transparent',
        active
          ? 'text-accent border-accent'
          : 'text-textMuted hover:text-text',
        className
      )}
      {...props}
    />
  )
);

Tab.displayName = 'Tab';

interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {}

export const TabPanel = React.forwardRef<HTMLDivElement, TabPanelProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn(className)} {...props} />
  )
);

TabPanel.displayName = 'TabPanel';
