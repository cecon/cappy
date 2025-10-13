import React from 'react';
import { TabsList, TabsTrigger } from '../ui/Tabs';
import { cn } from '../../lib/utils';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

const Header: React.FC<HeaderProps> = ({ currentTab, onTabChange }) => {
  return (
    <header className="sticky top-0 z-50 flex h-10 w-full items-center border-b border-border/40 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Logo/Title */}
      <div className="flex min-w-[200px] items-center">
        <a href="#" className="flex items-center gap-2">
          <span className="text-emerald-400" aria-hidden="true">🦫</span>
          <span className="font-bold">Cappy</span>
        </a>
      </div>

      {/* Navigation Tabs */}
      <div className="flex h-10 flex-1 items-center justify-center">
        <TabsList className="h-8 gap-2">
          <TabsTrigger
            value="documents"
            className={cn(
              'cursor-pointer px-2 py-1 transition-all',
              currentTab === 'documents'
                ? '!bg-emerald-400 !text-zinc-50'
                : 'hover:bg-background/60'
            )}
            onClick={() => onTabChange('documents')}
          >
            📁 Documents
          </TabsTrigger>
          <TabsTrigger
            value="knowledge-graph"
            className={cn(
              'cursor-pointer px-2 py-1 transition-all',
              currentTab === 'knowledge-graph'
                ? '!bg-emerald-400 !text-zinc-50'
                : 'hover:bg-background/60'
            )}
            onClick={() => onTabChange('knowledge-graph')}
          >
            🌐 Knowledge Graph
          </TabsTrigger>
          <TabsTrigger
            value="retrieval"
            className={cn(
              'cursor-pointer px-2 py-1 transition-all',
              currentTab === 'retrieval'
                ? '!bg-emerald-400 !text-zinc-50'
                : 'hover:bg-background/60'
            )}
            onClick={() => onTabChange('retrieval')}
          >
            🔍 Retrieval
          </TabsTrigger>
          <TabsTrigger
            value="api"
            className={cn(
              'cursor-pointer px-2 py-1 transition-all',
              currentTab === 'api'
                ? '!bg-emerald-400 !text-zinc-50'
                : 'hover:bg-background/60'
            )}
            onClick={() => onTabChange('api')}
          >
            📡 API
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Right Section - Theme Toggle, Settings */}
      <nav className="flex w-[200px] items-center justify-end gap-2">
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          title="Toggle theme"
        >
          🌙
        </button>
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          title="Settings"
        >
          ⚙️
        </button>
      </nav>
    </header>
  );
};

export default Header;
