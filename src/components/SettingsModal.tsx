import { useState, useEffect, useRef } from 'react';
import {
  X, User, Palette, Calendar, Bell, Shield,
  Check, Loader2, Eye, EyeOff, AlertTriangle, Sparkles, Camera, Trash2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  usePreferences,
  type AccentColor,
  type DateFormatPref,
  FORMAT_LABELS,
} from '../contexts/PreferencesContext';
import { AvatarCropModal } from './AvatarCropModal';

// ── Day weights (study schedule defaults) ──────────────────────────────────
export const DEFAULT_WEIGHTS_KEY = 'zenith_default_day_weights';

const BASE_DAYS = [
  { dayOfWeek: 0, weight: 1, label: 'Sun' },
  { dayOfWeek: 1, weight: 1, label: 'Mon' },
  { dayOfWeek: 2, weight: 1, label: 'Tue' },
  { dayOfWeek: 3, weight: 1, label: 'Wed' },
  { dayOfWeek: 4, weight: 1, label: 'Thu' },
  { dayOfWeek: 5, weight: 1, label: 'Fri' },
  { dayOfWeek: 6, weight: 1, label: 'Sat' },
];

export function loadDefaultDayWeights() {
  try {
    const raw = localStorage.getItem(DEFAULT_WEIGHTS_KEY);
    return raw ? JSON.parse(raw) : BASE_DAYS;
  } catch {
    return BASE_DAYS;
  }
}

// ── Accent color palette ───────────────────────────────────────────────────
const ACCENT_COLORS: { id: AccentColor; bg: string; label: string }[] = [
  { id: 'amber',   bg: '#f59e0b', label: 'Amber'   },
  { id: 'blue',    bg: '#3b82f6', label: 'Blue'    },
  { id: 'violet',  bg: '#8b5cf6', label: 'Violet'  },
  { id: 'emerald', bg: '#10b981', label: 'Emerald' },
  { id: 'rose',    bg: '#f43f5e', label: 'Rose'    },
];

function notifStatus(): 'unsupported' | 'default' | 'granted' | 'denied' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as 'default' | 'granted' | 'denied';
}

interface Props { onClose: () => void; }
type Section = 'profile' | 'appearance' | 'study' | 'notifications' | 'account';

export function SettingsModal({ onClose }: Props) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const prefs = usePreferences();

  const [section, setSection] = useState<Section>('profile');
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Profile state ──────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(
    (user?.user_metadata?.display_name as string | undefined) ?? ''
  );
  const [dailyGoalInput, setDailyGoalInput] = useState(String(prefs.dailyGoal || ''));
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>(
    (user?.user_metadata?.avatar_url as string | undefined) ?? ''
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  // ── Study schedule state ───────────────────────────────────────────────
  const [dayWeights, setDayWeights] = useState(loadDefaultDayWeights);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [localRevDays, setLocalRevDays] = useState(prefs.defaultRevisionDays);

  // ── Notification state ─────────────────────────────────────────────────
  const [notifPerm, setNotifPerm] = useState(notifStatus());
  const [requestingPerm, setRequestingPerm] = useState(false);

  // ── Account state ──────────────────────────────────────────────────────
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');
  const [deletingData, setDeletingData] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const saveDisplayName = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    setSavingName(true);
    try {
      await supabase.auth.updateUser({ data: { display_name: trimmed } });
      prefs.setDailyGoal(parseInt(dailyGoalInput) || 0);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } finally {
      setSavingName(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setAvatarError('Please choose an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setAvatarError('Image must be under 5 MB.'); return; }
    setAvatarError('');
    setCropImageSrc(URL.createObjectURL(file));
  };

  const handleCropApply = async (blob: Blob) => {
    setCropImageSrc(null);
    setAvatarUploading(true);
    setAvatarError('');
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) throw new Error('Not authenticated');
      const path = `${u.id}/avatar`;
      const { error: uploadErr } = await supabase.storage
        .from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const bustedUrl = `${publicUrl}?t=${Date.now()}`;
      await supabase.auth.updateUser({ data: { avatar_url: bustedUrl } });
      setAvatarUrl(bustedUrl);
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleCropCancel = () => {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    setCropImageSrc(null);
  };

  const removeAvatar = async () => {
    setAvatarUploading(true);
    setAvatarError('');
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) {
        await supabase.storage.from('avatars').remove([`${u.id}/avatar`]).catch(() => {});
        await supabase.auth.updateUser({ data: { avatar_url: null } });
      }
      setAvatarUrl('');
    } catch { setAvatarError('Failed to remove avatar.'); }
    finally { setAvatarUploading(false); }
  };

  const updateDayWeight = (dayOfWeek: number, weight: number) => {
    setDayWeights((prev: typeof BASE_DAYS) =>
      prev.map(d => d.dayOfWeek === dayOfWeek ? { ...d, weight } : d)
    );
  };

  const saveScheduleDefaults = () => {
    localStorage.setItem(DEFAULT_WEIGHTS_KEY, JSON.stringify(dayWeights));
    prefs.setDefaultRevisionDays(localRevDays);
    setScheduleSaved(true);
    setTimeout(() => setScheduleSaved(false), 2000);
  };

  const requestNotifPermission = async () => {
    setRequestingPerm(true);
    try {
      const result = await Notification.requestPermission();
      setNotifPerm(result);
    } finally { setRequestingPerm(false); }
  };

  const changePassword = async () => {
    if (newPw.length < 6) { setPwError('Minimum 6 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    setPwError('');
    setPwSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setPwSaved(true);
      setNewPw(''); setConfirmPw('');
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally { setPwSaving(false); }
  };

  const deleteAllData = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeletingData(true);
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return;
      await supabase.from('exams').delete().eq('user_id', u.id);
      await supabase.from('todos').delete().eq('user_id', u.id);
      await supabase.from('milestones').delete().eq('user_id', u.id);
      await supabase.from('study_streaks').delete().eq('user_id', u.id);
      await supabase.auth.signOut();
    } finally { setDeletingData(false); }
  };

  const sections: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: 'profile',       label: 'Profile',       icon: User    },
    { id: 'appearance',    label: 'Appearance',     icon: Palette },
    { id: 'study',         label: 'Study Schedule', icon: Calendar },
    { id: 'notifications', label: 'Notifications',  icon: Bell    },
    { id: 'account',       label: 'Account',        icon: Shield  },
  ];

  return (
    <>
      {cropImageSrc && (
        <AvatarCropModal imageSrc={cropImageSrc} onApply={handleCropApply} onCancel={handleCropCancel} />
      )}
      <div
        ref={overlayRef}
        onClick={handleOverlayClick}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <div className="w-full max-w-xl bg-slate-800 rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 flex-shrink-0">
            <h2 className="text-lg font-semibold text-white">Settings</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-44 border-r border-neutral-800 py-3 flex-shrink-0 overflow-y-auto">
              {sections.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSection(id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition text-left ${
                    section === id
                      ? 'text-amber-400 bg-amber-500/10'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">

              {/* ── PROFILE ── */}
              {section === 'profile' && (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-200 mb-1">Profile Photo</h3>
                    <p className="text-xs text-neutral-500 mb-3">JPG, PNG or WebP — max 5 MB.</p>
                    <div className="flex items-center gap-4">
                      <div className="relative group flex-shrink-0">
                        <div className="w-20 h-20 rounded-full overflow-hidden bg-amber-500 flex items-center justify-center ring-2 ring-neutral-700">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl font-bold text-neutral-900 leading-none select-none">
                              {displayName.trim()
                                ? displayName.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
                                : (user?.email?.[0] ?? '?').toUpperCase()}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={avatarUploading}
                          className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition disabled:cursor-wait"
                        >
                          {avatarUploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={avatarUploading}
                          className="px-3 py-1.5 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800 transition disabled:opacity-50"
                        >
                          {avatarUploading ? 'Uploading…' : 'Upload photo'}
                        </button>
                        {avatarUrl && (
                          <button onClick={removeAvatar} disabled={avatarUploading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-400 hover:bg-red-900/20 transition disabled:opacity-50">
                            <Trash2 className="w-3.5 h-3.5" />Remove
                          </button>
                        )}
                      </div>
                    </div>
                    {avatarError && <p className="text-xs text-red-400 mt-2">{avatarError}</p>}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-neutral-200 mb-1">Display Name</h3>
                    <p className="text-xs text-neutral-500 mb-3">Replaces your email in the header.</p>
                    <input
                      type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveDisplayName(); }}
                      placeholder="e.g. Shilpa" autoFocus
                      className="w-full px-3 py-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-neutral-600"
                    />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-neutral-200 mb-1">Daily Study Goal</h3>
                    <p className="text-xs text-neutral-500 mb-3">Topics per day shown in your greeting. Set 0 to disable.</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="number" min={0} max={50} value={dailyGoalInput}
                        onChange={e => setDailyGoalInput(e.target.value)}
                        className="w-24 px-3 py-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="text-sm text-neutral-500">topics / day</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-neutral-200 mb-1">Email</h3>
                    <p className="text-sm text-neutral-500 select-all">{user?.email}</p>
                  </div>

                  <button
                    onClick={saveDisplayName}
                    disabled={savingName || !displayName.trim()}
                    className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : nameSaved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Profile'}
                  </button>
                </>
              )}

              {/* ── APPEARANCE ── */}
              {section === 'appearance' && (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-200 mb-1">Theme</h3>
                    <p className="text-xs text-neutral-500 mb-3">Saved automatically.</p>
                    <div className="flex gap-3">
                      {(['dark', 'light'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => { if (theme !== t) toggleTheme(); }}
                          className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition ${
                            theme === t ? 'border-amber-500 text-amber-400 bg-amber-500/10' : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                          }`}
                        >
                          {t === 'dark' ? '🌙  Dark' : '☀️  Light'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-neutral-200 mb-1">Accent Color</h3>
                    <p className="text-xs text-neutral-500 mb-3">Changes the brand color throughout the app.</p>
                    <div className="flex gap-3">
                      {ACCENT_COLORS.map(({ id, bg, label }) => (
                        <button
                          key={id} onClick={() => prefs.setAccentColor(id)} title={label}
                          className="relative w-9 h-9 rounded-full transition hover:scale-110 focus:outline-none"
                          style={{ backgroundColor: bg, boxShadow: prefs.accentColor === id ? `0 0 0 3px ${bg}40` : undefined }}
                        >
                          {prefs.accentColor === id && <span className="absolute inset-0 flex items-center justify-center"><Check className="w-4 h-4 text-white drop-shadow" /></span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-neutral-200 mb-1">Date Format</h3>
                    <p className="text-xs text-neutral-500 mb-3">How dates appear across the app.</p>
                    <div className="flex flex-col gap-2">
                      {(['medium', 'us', 'eu'] as DateFormatPref[]).map(f => (
                        <button
                          key={f} onClick={() => prefs.setDateFormat(f)}
                          className={`flex items-center justify-between px-4 py-2.5 rounded-lg border-2 text-sm transition ${
                            prefs.dateFormat === f ? 'border-amber-500 text-amber-400 bg-amber-500/10' : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                          }`}
                        >
                          <span>{FORMAT_LABELS[f]}</span>
                          {prefs.dateFormat === f && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-neutral-200 mb-1">Compact Mode</h3>
                    <p className="text-xs text-neutral-500 mb-3">Tighter layout for more content on screen.</p>
                    <button
                      onClick={() => prefs.setCompactMode(!prefs.compactMode)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${prefs.compactMode ? 'bg-amber-500' : 'bg-neutral-700'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${prefs.compactMode ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </>
              )}

              {/* ── STUDY SCHEDULE ── */}
              {section === 'study' && (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-200 mb-1">Default Weekly Schedule</h3>
                    <p className="text-xs text-neutral-500 mb-4">Pre-fills day weights every time you create a new study plan.</p>
                    <div className="grid grid-cols-7 gap-1.5 mb-4">
                      {dayWeights.map((day: { dayOfWeek: number; weight: number; label: string }) => (
                        <div key={day.dayOfWeek} className="text-center">
                          <div className="text-xs font-medium text-neutral-500 mb-1.5">{day.label}</div>
                          <div className="flex flex-col gap-1">
                            {[0, 1, 2, 3].map(w => (
                              <button
                                key={w} onClick={() => updateDayWeight(day.dayOfWeek, w)}
                                className={`w-full py-1.5 rounded text-xs font-medium transition ${
                                  day.weight === w ? 'bg-amber-500 text-neutral-900' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                                }`}
                              >
                                {w === 0 ? 'Off' : w}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-neutral-200 mb-1">Default Revision Days</h3>
                    <p className="text-xs text-neutral-500 mb-3">Pre-fills the revision slider when creating new plans.</p>
                    <div className="flex items-center gap-4">
                      <input
                        type="range" min={0} max={21} value={localRevDays}
                        onChange={e => setLocalRevDays(parseInt(e.target.value))}
                        className="flex-1 h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <span className="text-lg font-bold text-amber-400 tabular-nums w-12 text-right">{localRevDays}d</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-neutral-200 mb-1">Celebration Animation</h3>
                    <p className="text-xs text-neutral-500 mb-3">Confetti when you complete all today's topics.</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => prefs.setConfettiEnabled(!prefs.confettiEnabled)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${prefs.confettiEnabled ? 'bg-amber-500' : 'bg-neutral-700'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${prefs.confettiEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                      <Sparkles className={`w-4 h-4 ${prefs.confettiEnabled ? 'text-amber-400' : 'text-neutral-600'}`} />
                      <span className="text-sm text-neutral-400">{prefs.confettiEnabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </div>

                  <button
                    onClick={saveScheduleDefaults}
                    className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold text-sm transition flex items-center justify-center gap-2"
                  >
                    {scheduleSaved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Schedule Defaults'}
                  </button>
                </>
              )}

              {/* ── NOTIFICATIONS ── */}
              {section === 'notifications' && (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-200 mb-1">Browser Notifications</h3>
                    <p className="text-xs text-neutral-500 mb-3">Works while this app is open in your browser.</p>
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-4 ${
                      notifPerm === 'granted' ? 'bg-emerald-500/10 text-emerald-400'
                      : notifPerm === 'denied' ? 'bg-red-900/20 text-red-400'
                      : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${notifPerm === 'granted' ? 'bg-emerald-400' : notifPerm === 'denied' ? 'bg-red-400' : 'bg-neutral-500'}`} />
                      {notifPerm === 'granted' && 'Notifications allowed'}
                      {notifPerm === 'denied' && 'Blocked — enable in browser settings'}
                      {notifPerm === 'default' && 'Permission not yet granted'}
                      {notifPerm === 'unsupported' && 'Not supported by your browser'}
                    </div>
                    {notifPerm !== 'granted' && notifPerm !== 'unsupported' && (
                      <button
                        onClick={requestNotifPermission}
                        disabled={requestingPerm || notifPerm === 'denied'}
                        className="mb-4 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold text-sm transition disabled:opacity-50"
                      >
                        {requestingPerm ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Allow Notifications'}
                      </button>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-200 mb-1">Daily Study Reminder</h3>
                    <p className="text-xs text-neutral-500 mb-3">Get a nudge at a set time each day. Requires notifications to be allowed.</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="time" value={prefs.reminderTime}
                        onChange={e => prefs.setReminderTime(e.target.value)}
                        disabled={notifPerm !== 'granted'}
                        className="px-3 py-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-40"
                      />
                      {prefs.reminderTime && notifPerm === 'granted' && (
                        <button onClick={() => prefs.setReminderTime('')} className="text-xs text-neutral-500 hover:text-red-400 transition">Clear</button>
                      )}
                    </div>
                    {prefs.reminderTime && notifPerm === 'granted' && (
                      <p className="text-xs text-emerald-400 mt-2">Reminder set for {prefs.reminderTime} daily.</p>
                    )}
                  </div>
                </>
              )}

              {/* ── ACCOUNT ── */}
              {section === 'account' && (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-200 mb-1">Change Password</h3>
                    <p className="text-xs text-neutral-500 mb-4">Minimum 6 characters.</p>
                    <div className="space-y-2 mb-3">
                      <div className="relative">
                        <input
                          type={showNewPw ? 'text' : 'password'} value={newPw}
                          onChange={e => setNewPw(e.target.value)} placeholder="New password"
                          className="w-full px-3 py-2 pr-10 rounded-lg border border-neutral-700 bg-neutral-950 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-neutral-600"
                        />
                        <button onClick={() => setShowNewPw(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-300">
                          {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showConfirmPw ? 'text' : 'password'} value={confirmPw}
                          onChange={e => setConfirmPw(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') changePassword(); }}
                          placeholder="Confirm new password"
                          className="w-full px-3 py-2 pr-10 rounded-lg border border-neutral-700 bg-neutral-950 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-neutral-600"
                        />
                        <button onClick={() => setShowConfirmPw(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-300">
                          {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {pwError && <p className="text-xs text-red-400 mb-2">{pwError}</p>}
                    {pwSaved && <p className="text-xs text-emerald-400 mb-2">Password updated successfully.</p>}
                    <button
                      onClick={changePassword} disabled={pwSaving || !newPw || !confirmPw}
                      className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : pwSaved ? <><Check className="w-4 h-4" /> Updated</> : 'Update Password'}
                    </button>
                  </div>

                  <div className="border-t border-red-900/40 pt-5">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
                    </div>
                    <p className="text-xs text-neutral-500 mb-4">
                      Permanently deletes all your study plans, todos, milestones, and streak data.
                      This <strong className="text-neutral-300">cannot be undone</strong>.
                      Type <code className="text-red-400 bg-red-900/20 px-1 rounded">DELETE</code> to confirm.
                    </p>
                    <input
                      type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                      placeholder="Type DELETE to confirm"
                      className="w-full px-3 py-2 rounded-lg border border-red-900/40 bg-neutral-950 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder:text-neutral-600 mb-3"
                    />
                    <button
                      onClick={deleteAllData} disabled={deleteConfirm !== 'DELETE' || deletingData}
                      className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {deletingData ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete All My Data'}
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
