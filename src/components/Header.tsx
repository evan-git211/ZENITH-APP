import { useState, useEffect } from 'react';
import { LogOut, Settings, Flame } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getStreakData } from '../lib/streakService';
import { ZenithLogo } from './ZenithLogo';
import { SettingsModal } from './SettingsModal';

function getInitials(displayName: string, email: string): string {
  const name = displayName.trim();
  if (name) {
    const parts = name.split(/\s+/);
    return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }
  return (email?.[0] ?? '?').toUpperCase();
}

function getDisplayLabel(displayName: string, email: string): string {
  const name = displayName.trim();
  if (name) return name;
  return email ?? '';
}

interface HeaderProps {
  examName?: string;
}

export function Header({ examName }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const displayName = (user?.user_metadata?.display_name as string | undefined) ?? '';
  const avatarUrl   = (user?.user_metadata?.avatar_url  as string | undefined) ?? '';
  const email       = user?.email ?? '';

  const loadStreak = async () => {
    try {
      const { currentStreak: s } = await getStreakData();
      setCurrentStreak(s);
    } catch {}
  };

  useEffect(() => { loadStreak(); }, []);

  const handleSettingsClose = () => {
    setShowSettings(false);
    loadStreak();
  };

  return (
    <>
      {showSettings && <SettingsModal onClose={handleSettingsClose} />}

      <header className="zenith-header backdrop-blur-md border-b border-neutral-800/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Left — logo + brand + optional exam breadcrumb */}
            <div className="flex items-center gap-3">
              <ZenithLogo size={28} />
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent select-none">
                ZENITH
              </span>
              {examName && (
                <>
                  <span className="text-neutral-600 mx-1">/</span>
                  <span className="text-neutral-300 font-medium text-sm truncate max-w-[140px] sm:max-w-[240px]">{examName}</span>
                </>
              )}
            </div>

            {/* Right — streak, avatar, settings, logout */}
            <div className="flex items-center gap-2">

              {/* Streak badge */}
              {currentStreak > 0 && (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-sm font-bold text-amber-400 tabular-nums">{currentStreak}</span>
                </div>
              )}

              {/* Settings */}
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>

              {/* Avatar + display name */}
              <div className="hidden sm:flex items-center gap-2.5 pl-2">
                <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-neutral-700 flex-shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-amber-500 flex items-center justify-center">
                      <span className="text-xs font-bold text-neutral-900 leading-none">
                        {getInitials(displayName, email)}
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium text-neutral-300 max-w-[120px] truncate">
                  {getDisplayLabel(displayName, email)}
                </span>
              </div>

              {/* Logout */}
              <button
                onClick={signOut}
                className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-red-400 transition"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
