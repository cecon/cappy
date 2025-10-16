import React from 'react';
import logo from '../../../resources/icons/cappy-activity.svg';
import { TabsList, TabsTrigger } from '../ui/Tabs';
import { cn } from '../../lib/utils';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

const Header: React.FC<HeaderProps> = ({ currentTab, onTabChange }) => {
  const isGraph = currentTab === 'knowledge-graph';
  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b border-border/50 backdrop-blur',
        'bg-background/80 supports-[backdrop-filter]:bg-background/60 shadow-sm'
      )}
    >
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-4 px-4 sm:px-6">
        {/* Left: Brand + (optional) breadcrumb */}
        <div className="flex shrink-0 items-center gap-2">
          <a href="#" className="group flex items-center gap-2">
            <img src={logo} alt="Cappy" className="h-5 w-5 transition-transform group-hover:scale-110" />
            <span className="font-semibold tracking-tight">Cappy</span>
          </a>
        </div>

        {/* Center: Navigation Tabs - expand to fill space */}
        <div className="flex min-w-0 flex-1 items-center">
          <div className="w-full overflow-x-auto no-scrollbar">
            <TabsList className="h-9 w-full gap-1 whitespace-nowrap rounded-lg border border-border/50 bg-muted/60 p-1">
              <TabsTrigger
                value="documents"
                className={cn(
                  'cursor-pointer px-3 py-1.5 text-xs md:text-sm transition-all',
                  'data-[state=active]:!bg-emerald-500 data-[state=active]:!text-white',
                  currentTab === 'documents' ? '!bg-emerald-500 !text-white' : 'hover:bg-background/60'
                )}
                onClick={() => onTabChange('documents')}
              >
                📁 Documents
              </TabsTrigger>
              <TabsTrigger
                value="knowledge-graph"
                className={cn(
                  'cursor-pointer px-3 py-1.5 text-xs md:text-sm transition-all',
                  'data-[state=active]:!bg-emerald-500 data-[state=active]:!text-white',
                  currentTab === 'knowledge-graph' ? '!bg-emerald-500 !text-white' : 'hover:bg-background/60'
                )}
                onClick={() => onTabChange('knowledge-graph')}
              >
                🌐 Knowledge Graph
              </TabsTrigger>
              <TabsTrigger
                value="retrieval"
                className={cn(
                  'cursor-pointer px-3 py-1.5 text-xs md:text-sm transition-all',
                  'data-[state=active]:!bg-emerald-500 data-[state=active]:!text-white',
                  currentTab === 'retrieval' ? '!bg-emerald-500 !text-white' : 'hover:bg-background/60'
                )}
                onClick={() => onTabChange('retrieval')}
              >
                🔍 Retrieval
              </TabsTrigger>
              <TabsTrigger
                value="api"
                className={cn(
                  'cursor-pointer px-3 py-1.5 text-xs md:text-sm transition-all',
                  'data-[state=active]:!bg-emerald-500 data-[state=active]:!text-white',
                  currentTab === 'api' ? '!bg-emerald-500 !text-white' : 'hover:bg-background/60'
                )}
                onClick={() => onTabChange('api')}
              >
                📡 API
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Right: Actions compact and fixed */}
        <nav className="flex shrink-0 items-center gap-2">
          {isGraph && (
            <div className="relative hidden items-center lg:flex">
              <span className="pointer-events-none absolute left-2 text-sm text-muted-foreground">🔎</span>
              <input
                type="text"
                placeholder="Search…"
                className="h-9 w-36 rounded-md border border-input bg-background/60 pl-8 pr-2 text-xs text-foreground outline-none transition focus:border-ring/60"
              />
            </div>
          )}
          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-accent"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            🌙
          </button>
          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-accent"
            title="Settings"
            aria-label="Open settings"
          >
            ⚙️
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
