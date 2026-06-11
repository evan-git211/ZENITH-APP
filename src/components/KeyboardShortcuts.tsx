import { useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface Shortcut {
  key: string;
  description: string;
  action: () => void;
  showInHelp?: boolean;
}

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Skip if meta/ctrl keys are pressed (browser shortcuts)
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const shortcuts: Shortcut[] = [
        {
          key: 'n',
          description: 'New study plan',
          showInHelp: location.pathname !== '/new',
          action: () => navigate('/new'),
        },
        {
          key: 'h',
          description: 'Go to home',
          showInHelp: location.pathname !== '/',
          action: () => navigate('/'),
        },
        {
          key: 'g',
          description: 'Focus search',
          showInHelp: false,
          action: () => {
            const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
            if (searchInput) searchInput.focus();
          },
        },
      ];

      for (const shortcut of shortcuts) {
        if (e.key.toLowerCase() === shortcut.key.toLowerCase()) {
          e.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, location.pathname]);

  return <>{children}</>;
}

// Help component to show shortcuts
export function KeyboardShortcutsHelp() {
  const shortcuts = [
    { keys: 'N', description: 'New study plan' },
    { keys: 'H', description: 'Go home' },
    { keys: 'Esc', description: 'Close modal' },
    { keys: 'Enter', description: 'Confirm action' },
    { keys: '?', description: 'Show shortcuts' },
  ];

  return (
    <div className="text-sm text-slate-600 dark:text-slate-400">
      <div className="font-medium mb-2">Keyboard Shortcuts:</div>
      <div className="grid gap-1">
        {shortcuts.map((s) => (
          <div key={s.keys} className="flex items-center gap-3">
            <kbd className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-xs font-mono">
              {s.keys}
            </kbd>
            <span className="text-xs">{s.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
