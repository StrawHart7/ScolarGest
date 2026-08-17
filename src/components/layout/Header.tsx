import { Badge } from '@/components/ui/badge';

export interface HeaderProps {
  schoolName?: string;
  role?: string;
  userName?: string;
}

export function Header({ schoolName, role, userName }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-header items-center justify-between border-b border-surface-border bg-surface-container-low px-6">
      <div className="text-headline-sm text-text-primary">{schoolName ?? ''}</div>
      <div className="flex items-center gap-3">
        {role && <Badge variant="primary">{role}</Badge>}
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded px-2 text-body-md text-text-secondary hover:bg-surface-container"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-secondary-on text-label-md">
            {(userName ?? 'U').slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden sm:inline">{userName}</span>
        </button>
      </div>
    </header>
  );
}
