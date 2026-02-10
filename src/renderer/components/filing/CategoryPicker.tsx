import { useEffect, useRef } from 'react';
import { Command } from 'cmdk';
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
  Users,
  ReceiptText,
  Scale,
  Zap,
  Mail,
  FolderOpen,
  Sparkles,
} from 'lucide-react';
import type { Category } from '../../../shared/types';
import { CATEGORIES } from '../../../shared/constants';

const CATEGORY_ICONS: Record<Category, React.ComponentType<{ className?: string }>> = {
  Identity: UserRound,
  Taxes: Receipt,
  Banking: Landmark,
  Insurance: Shield,
  Medical: Heart,
  Home: House,
  Work: Briefcase,
  Kids: Baby,
  Family: Users,
  Receipts: ReceiptText,
  Legal: Scale,
  Utilities: Zap,
  Mail: Mail,
  Other: FolderOpen,
};

interface CategoryPickerProps {
  onSelect: (category: Category | null) => void;
  onClose: () => void;
  suggestedCategory?: Category;
}

export function CategoryPicker({ onSelect, onClose, suggestedCategory }: CategoryPickerProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[20vh]"
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <Command
        className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-base shadow-2xl"
        label="File to category"
      >
        <Command.Input
          autoFocus
          placeholder="Choose category..."
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground placeholder-faint outline-none"
        />
        <Command.List className="max-h-72 overflow-y-auto p-2">
          <Command.Empty className="px-4 py-6 text-center text-sm text-faint">
            No matching category.
          </Command.Empty>
          <Command.Item
            value="Inbox"
            onSelect={() => onSelect(null)}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-secondary data-[selected=true]:bg-elevated data-[selected=true]:text-foreground"
          >
            <Inbox className="h-4 w-4 shrink-0 text-faint" />
            Inbox
          </Command.Item>
          <div className="mx-2 my-1 border-t border-border/50" />
          {CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat];
            const isSuggested = cat === suggestedCategory;
            return (
              <Command.Item
                key={cat}
                value={cat}
                onSelect={() => onSelect(cat)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-secondary data-[selected=true]:bg-elevated data-[selected=true]:text-foreground"
              >
                <Icon className="h-4 w-4 shrink-0 text-faint" />
                {cat}
                {isSuggested && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                    <Sparkles className="h-2.5 w-2.5" />
                    Suggested
                  </span>
                )}
              </Command.Item>
            );
          })}
        </Command.List>
      </Command>
    </div>
  );
}
