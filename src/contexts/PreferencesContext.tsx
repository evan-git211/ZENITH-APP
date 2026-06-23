import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { format as dfFormat } from 'date-fns';

export type AccentColor = 'amber' | 'blue' | 'violet' | 'emerald' | 'rose';
export type DateFormatPref = 'medium' | 'us' | 'eu';

export const FORMAT_STRINGS: Record<DateFormatPref, string> = {
  medium: 'MMM d, yyyy',
  us:     'MM/dd/yyyy',
  eu:     'dd/MM/yyyy',
};

export const FORMAT_LABELS: Record<DateFormatPref, string> = {
  medium: 'Jun 23, 2026',
  us:     '06/23/2026',
  eu:     '23/06/2026',
};

export const PREF_KEYS = {
  accent:       'zenith_accent_color',
  compact:      'zenith_compact_mode',
  dateFormat:   'zenith_date_format',
  confetti:     'zenith_confetti_enabled',
  revisionDays: 'zenith_default_revision_days',
  reminderTime: 'zenith_reminder_time',
  dailyGoal:    'zenith_daily_goal',
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

interface PreferencesContextType {
  accentColor: AccentColor;
  setAccentColor: (v: AccentColor) => void;
  compactMode: boolean;
  setCompactMode: (v: boolean) => void;
  dateFormat: DateFormatPref;
  setDateFormat: (v: DateFormatPref) => void;
  confettiEnabled: boolean;
  setConfettiEnabled: (v: boolean) => void;
  defaultRevisionDays: number;
  setDefaultRevisionDays: (v: number) => void;
  reminderTime: string;
  setReminderTime: (v: string) => void;
  dailyGoal: number;
  setDailyGoal: (v: number) => void;
  fmtDate: (date: Date | string) => string;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [accentColor, setAccentState]      = useState<AccentColor>(() => read(PREF_KEYS.accent, 'amber'));
  const [compactMode, setCompactState]     = useState<boolean>(() => read(PREF_KEYS.compact, false));
  const [dateFormat, setDateFmtState]      = useState<DateFormatPref>(() => read(PREF_KEYS.dateFormat, 'medium'));
  const [confettiEnabled, setConfettiState] = useState<boolean>(() => read(PREF_KEYS.confetti, true));
  const [defaultRevisionDays, setRevState] = useState<number>(() => read(PREF_KEYS.revisionDays, 7));
  const [reminderTime, setReminderState]   = useState<string>(() => read(PREF_KEYS.reminderTime, ''));
  const [dailyGoal, setGoalState]          = useState<number>(() => read(PREF_KEYS.dailyGoal, 0));

  // Accent color → html class
  useEffect(() => {
    const root = document.documentElement;
    (['amber', 'blue', 'violet', 'emerald', 'rose'] as AccentColor[]).forEach(c =>
      root.classList.remove(`accent-${c}`)
    );
    if (accentColor !== 'amber') root.classList.add(`accent-${accentColor}`);
  }, [accentColor]);

  // Compact mode → html class
  useEffect(() => {
    document.documentElement.classList.toggle('compact', compactMode);
  }, [compactMode]);

  // Daily study reminder via browser Notification API
  useEffect(() => {
    if (!reminderTime || typeof Notification === 'undefined') return;
    const id = setInterval(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      if (`${hh}:${mm}` === reminderTime && Notification.permission === 'granted') {
        new Notification('ZENITH — Time to study!', {
          body: "Check today's topics and keep your streak going.",
          icon: '/favicon.ico',
        });
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [reminderTime]);

  const setAccentColor       = (v: AccentColor)      => { setAccentState(v);    write(PREF_KEYS.accent, v); };
  const setCompactMode       = (v: boolean)           => { setCompactState(v);   write(PREF_KEYS.compact, v); };
  const setDateFormat        = (v: DateFormatPref)    => { setDateFmtState(v);   write(PREF_KEYS.dateFormat, v); };
  const setConfettiEnabled   = (v: boolean)           => { setConfettiState(v);  write(PREF_KEYS.confetti, v); };
  const setDefaultRevisionDays = (v: number)          => { setRevState(v);       write(PREF_KEYS.revisionDays, v); };
  const setReminderTime      = (v: string)            => { setReminderState(v);  write(PREF_KEYS.reminderTime, v); };
  const setDailyGoal         = (v: number)            => { setGoalState(v);      write(PREF_KEYS.dailyGoal, v); };

  const fmtDate = useCallback(
    (date: Date | string) => dfFormat(
      typeof date === 'string' ? new Date(date) : date,
      FORMAT_STRINGS[dateFormat]
    ),
    [dateFormat]
  );

  return (
    <PreferencesContext.Provider value={{
      accentColor, setAccentColor,
      compactMode, setCompactMode,
      dateFormat, setDateFormat,
      confettiEnabled, setConfettiEnabled,
      defaultRevisionDays, setDefaultRevisionDays,
      reminderTime, setReminderTime,
      dailyGoal, setDailyGoal,
      fmtDate,
    }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
