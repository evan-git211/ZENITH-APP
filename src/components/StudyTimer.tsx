import { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Pause, Play, RotateCcw, AlarmClock, Pencil, Check } from 'lucide-react';

const STORAGE_KEY = 'zenith-study-timer';

const PRESETS = [
  { label: '25m', minutes: 25 },
  { label: '45m', minutes: 45 },
  { label: '60m', minutes: 60 },
  { label: '90m', minutes: 90 },
];

interface Saved {
  selectedMinutes: number;
  endTime: number | null;
  pausedSecondsLeft: number;
}

function save(data: Saved) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function playTibetanBowl() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const fundamental = 880;
    const duration = 0.9;
    // Slightly inharmonic overtones mimic real marimba bar resonance
    const partials = [
      { freq: fundamental,        amp: 0.55 },
      { freq: fundamental * 2,    amp: 0.20 },
      { freq: fundamental * 3.01, amp: 0.08 },
      { freq: fundamental * 4.02, amp: 0.04 },
    ];
    const now = ctx.currentTime;
    partials.forEach(({ freq, amp }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.start(now); osc.stop(now + duration);
    });
    setTimeout(() => ctx.close(), (duration + 0.1) * 1000);
  } catch {}
}

function playTick() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 660; osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
  } catch {}
}

export function StudyTimer() {
  const saved = load();

  const [selectedMinutes, setSelectedMinutes] = useState<number>(
    saved?.selectedMinutes ?? 25
  );
  // endTime drives "is running" — null means paused/idle
  const [endTime, setEndTime] = useState<number | null>(() => {
    if (saved?.endTime && saved.endTime > Date.now()) return saved.endTime;
    return null;
  });
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (saved?.endTime && saved.endTime > Date.now())
      return Math.round((saved.endTime - Date.now()) / 1000);
    return saved?.pausedSecondsLeft ?? 25 * 60;
  });
  const [finished, setFinished] = useState(false);

  // Custom timer UI
  const [showCustom, setShowCustom] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const customInputRef = useRef<HTMLInputElement>(null);

  const running = endTime !== null;
  const totalSeconds = selectedMinutes * 60;
  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const mins = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const secs = (secondsLeft % 60).toString().padStart(2, '0');
  const circumference = 2 * Math.PI * 36;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alarmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCustomPreset = !PRESETS.some(p => p.minutes === selectedMinutes);

  // Persist on every meaningful change
  useEffect(() => {
    save({ selectedMinutes, endTime, pausedSecondsLeft: secondsLeft });
  }, [selectedMinutes, endTime, secondsLeft]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current) { clearInterval(alarmIntervalRef.current); alarmIntervalRef.current = null; }
    if (alarmTimeoutRef.current) { clearTimeout(alarmTimeoutRef.current); alarmTimeoutRef.current = null; }
  }, []);

  const startAlarm = useCallback(() => {
    stopAlarm();
    playTibetanBowl();
    alarmIntervalRef.current = setInterval(playTibetanBowl, 2000);
    alarmTimeoutRef.current = setTimeout(stopAlarm, 5 * 60 * 1000);
  }, [stopAlarm]);

  const reset = useCallback((minutes?: number) => {
    stopInterval();
    stopAlarm();
    const m = minutes ?? selectedMinutes;
    setEndTime(null);
    setSecondsLeft(m * 60);
    setFinished(false);
  }, [stopInterval, selectedMinutes]);

  // Tick loop — driven by endTime
  useEffect(() => {
    if (!running) { stopInterval(); return; }
    intervalRef.current = setInterval(() => {
      const remaining = Math.round((endTime! - Date.now()) / 1000);
      if (remaining <= 0) {
        stopInterval();
        setEndTime(null);
        setSecondsLeft(0);
        setFinished(true);
        startAlarm();
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      if (remaining <= 10) playTick();
      setSecondsLeft(remaining);
    }, 500);
    return stopInterval;
  }, [running, endTime, stopInterval, startAlarm]);

  const toggleRun = () => {
    if (finished) { reset(); return; }
    if (running) {
      // Pause: capture current remaining, clear endTime
      setEndTime(null);
    } else {
      // Start / Resume
      setEndTime(Date.now() + secondsLeft * 1000);
    }
  };

  const selectPreset = (minutes: number) => {
    setSelectedMinutes(minutes);
    setShowCustom(false);
    reset(minutes);
  };

  const commitCustom = () => {
    const val = parseInt(customInput, 10);
    if (!isNaN(val) && val >= 1 && val <= 999) {
      setSelectedMinutes(val);
      reset(val);
    }
    setShowCustom(false);
    setCustomInput('');
  };

  useEffect(() => {
    if (showCustom) customInputRef.current?.focus();
  }, [showCustom]);

  return (
    <div className="glass-surface rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Timer className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-slate-100">Study Timer</h3>
      </div>

      {/* Preset buttons + custom */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.minutes}
            onClick={() => selectPreset(p.minutes)}
            disabled={running}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition disabled:cursor-not-allowed ${
              selectedMinutes === p.minutes && !isCustomPreset
                ? 'bg-amber-500 text-white'
                : 'bg-white/[0.07] text-slate-400 hover:text-slate-200 disabled:opacity-50'
            }`}
          >
            {p.label}
          </button>
        ))}

        {/* Custom button / input */}
        {showCustom ? (
          <div className="flex items-center gap-1">
            <input
              ref={customInputRef}
              type="number"
              min={1}
              max={999}
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitCustom(); if (e.key === 'Escape') { setShowCustom(false); setCustomInput(''); } }}
              placeholder="min"
              className="w-16 px-2 py-1 rounded-lg text-xs bg-white/[0.07] border border-amber-500/40 text-slate-100 focus:outline-none focus:border-amber-500 text-center"
            />
            <button
              onClick={commitCustom}
              className="p-1 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { if (!running) setShowCustom(true); }}
            disabled={running}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition disabled:cursor-not-allowed flex items-center gap-1 ${
              isCustomPreset
                ? 'bg-amber-500 text-white'
                : 'bg-white/[0.07] text-slate-400 hover:text-slate-200 disabled:opacity-50'
            }`}
          >
            <Pencil className="w-3 h-3" />
            {isCustomPreset ? `${selectedMinutes}m` : 'Custom'}
          </button>
        )}
      </div>

      {/* Circular progress ring */}
      <div className="flex items-center gap-6">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" strokeWidth="6" className="stroke-timer-track" style={{ stroke: 'rgba(255,255,255,0.08)' }} />
            <circle
              cx="40" cy="40" r="36" fill="none"
              stroke={finished ? '#ef4444' : '#f59e0b'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-sm font-mono font-bold ${finished ? 'text-red-400' : 'text-slate-100'}`}>
              {finished ? <AlarmClock className="w-5 h-5" /> : `${mins}:${secs}`}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1">
          <button
            onClick={toggleRun}
            className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition ${
              finished
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : running
                ? 'bg-white/[0.1] hover:bg-white/[0.15] text-slate-200'
                : 'bg-amber-500 hover:bg-amber-400 text-white'
            }`}
          >
            {finished ? (
              <><RotateCcw className="w-4 h-4" /> Reset</>
            ) : running ? (
              <><Pause className="w-4 h-4" /> Pause</>
            ) : (
              <><Play className="w-4 h-4" /> {secondsLeft < totalSeconds && secondsLeft > 0 ? 'Resume' : 'Start'}</>
            )}
          </button>
          {!finished && (
            <button
              onClick={() => reset()}
              disabled={secondsLeft === totalSeconds && !running}
              className="flex items-center justify-center gap-2 py-1.5 px-4 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition disabled:opacity-30"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
