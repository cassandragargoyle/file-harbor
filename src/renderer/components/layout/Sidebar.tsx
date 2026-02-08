import {
  Inbox,
  UserRound,
  Receipt,
  Landmark,
  Shield,
  Heart,
  House,
  Briefcase,
  Baby,
  ReceiptText,
  Scale,
  Zap,
  FolderOpen,
} from 'lucide-react';
import type { Category } from '../../../shared/types';
import { CATEGORIES } from '../../../shared/constants';
import { useAppStore, type ViewType } from '../../stores/app-store';
import { cn } from '../../lib/utils';

const CATEGORY_ICONS: Record<Category, React.ComponentType<{ className?: string }>> = {
  Identity: UserRound,
  Taxes: Receipt,
  Banking: Landmark,
  Insurance: Shield,
  Medical: Heart,
  Home: House,
  Work: Briefcase,
  Kids: Baby,
  Receipts: ReceiptText,
  Legal: Scale,
  Utilities: Zap,
  Other: FolderOpen,
};

export function Sidebar() {
  const currentView = useAppStore((s) => s.currentView);
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const sidebarCounts = useAppStore((s) => s.sidebarCounts);
  const inboxCount = sidebarCounts?.inbox ?? 0;

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-neutral-800 bg-neutral-900/50">
      <div className="h-10 shrink-0 [-webkit-app-region:drag]" />

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <SidebarItem
          icon={Inbox}
          label="Inbox"
          count={inboxCount}
          active={currentView === 'inbox'}
          onClick={() => setCurrentView('inbox')}
          highlight={inboxCount > 0}
        />

        <div className="mx-2 my-2 border-t border-neutral-800" />

        {CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat];
          const count = sidebarCounts?.[cat] ?? 0;
          return (
            <SidebarItem
              key={cat}
              icon={Icon}
              label={cat}
              count={count}
              active={currentView === cat}
              onClick={() => setCurrentView(cat)}
            />
          );
        })}
      </nav>
    </aside>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  count,
  active,
  onClick,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-neutral-800 text-neutral-100'
          : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate text-left">{label}</span>
      {count > 0 && (
        <span
          className={cn(
            'text-xs tabular-nums',
            highlight && !active
              ? 'rounded-full bg-blue-600/20 px-1.5 py-0.5 text-blue-400'
              : 'text-neutral-500'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
