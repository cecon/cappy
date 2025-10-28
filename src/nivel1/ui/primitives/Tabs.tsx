import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../../lib/utils';

const Tabs = TabsPrimitive.Root;

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>;
type TabsListRef = React.ComponentRef<typeof TabsPrimitive.List>;
const TabsList = React.forwardRef<TabsListRef, TabsListProps>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-md p-1',
      'bg-muted text-muted-foreground',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

type TabsTriggerProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>;
type TabsTriggerRef = React.ComponentRef<typeof TabsPrimitive.Trigger>;
const TabsTrigger = React.forwardRef<TabsTriggerRef, TabsTriggerProps>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5',
      'text-sm font-medium ring-offset-background transition-all',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

type TabsContentProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>;
type TabsContentRef = React.ComponentRef<typeof TabsPrimitive.Content>;
const TabsContent = React.forwardRef<TabsContentRef, TabsContentProps>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
