import { useAuth } from '../contexts/AuthContext';
import { LogOut, User } from 'lucide-react';
import { ZenithLogo } from './ZenithLogo';

interface HeaderProps {
  examName?: string;
}

export function Header({ examName }: HeaderProps) {
  const { user, signOut } = useAuth();

  return (
    <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <ZenithLogo size={32} />
              <span className="text-lg font-bold tracking-widest bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
                ZENITH
              </span>
            </div>
            {examName && (
              <>
                <span className="text-neutral-700">/</span>
                <span className="text-neutral-400 font-medium">{examName}</span>
              </>
            )}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* User Menu */}
            <div className="flex items-center gap-3 pl-3 border-l border-neutral-800">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-amber-500" />
                </div>
                <span
                  className="text-sm font-medium text-neutral-300 truncate max-w-[160px]"
                  title={user?.email}
                >
                  {user?.email}
                </span>
              </div>

              <button
                onClick={signOut}
                className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
                aria-label="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
