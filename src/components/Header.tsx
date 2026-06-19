import { useState, useEffect } from 'react';
import { Settings, LogOut, Flame } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ZenithLogo } from './ZenithLogo';
import { SettingsModal } from './SettingsModal';
import { getStreakData } from '../lib/streakService';

interface HeaderProps {
  examName?: string;
}

function getInitials(displayName: string | undefined, email: string | undefined): string {
  if (displayName?.trim()) {
    const parts = displayName.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  }
  return email ? email[0].toUpperCase() : '?';
}

function getDisplayLabel(displayName: string | undefined, email: string | undefined): string {
  if (displayName?.trim()) return displayName.trim();
  const prefix = email?.split('@')[0] ?? '';
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

export function Header({ examName }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);

  const displayName = user?.user_metadata?.display_name as string | undefined;
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const initials = getInitials(displayName, user?.email);
  const displayLabel = getDisplayLabel(displayName, user?.email);

  useEffect(() => {
    getStreakData().then(({ currentStreak }) => setCurrentStreak(currentStreak));
  }, []);

  // Re-fetch streak when settings close (user may have completed topics)
  const handleSettingsClose = () => {
    setShowSettings(false);
    getStreakData().then(({ currentStreak }) => setCurrentStreak(currentStreak));
  };

  return (
    <>
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Left — Logo & exam breadcrumb */}
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

            {/* Right — streak, user, actions */}
            <div className="flex items-center gap-2">

              {/* Compact streak — only when active */}
              {currentStreak > 0 && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800">
                  <Flame
                    className={`w-4 h-4 ${
                      currentStreak >= 7 ? 'text-orange-500' : 'text-amber-500'
                    }`}
                  />
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      currentStreak >= 7 ? 'text-orange-400' : 'text-amber-400'
                    }`}
                  >
                    {currentStreak}
                  </span>
                </div>
              )}

              {/* User identity */}
              <div className="flex items-center gap-2 pl-2 border-l border-neutral-800 ml-1">
                <div className="hidden sm:flex items-center gap-2">
                  {/* Avatar — photo or initials fallback */}
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 overflow-hidden ring-1 ring-neutral-700">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-neutral-900 leading-none">
                        {initials}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-sm font-medium text-neutral-300 truncate max-w-[140px]"
                    title={user?.email}
                  >
                    {displayLabel}
                  </span>
                </div>

                {/* Settings */}
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
                  aria-label="Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>

                {/* Sign out */}
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

      {showSettings && <SettingsModal onClose={handleSettingsClose} />}
    </>
  );
}
