import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '../components/Header';
import {
  Plus, Calendar, CheckSquare, Flag, BookOpen, Clock, Trash2,
  Loader2, Pause, Check, X, Timer, RotateCcw, AlarmClock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getExams, deleteExam } from '../lib/examService';
import { getTodos, createTodo, updateTodo, deleteTodo, type Todo } from '../lib/todoService';
import { getMilestones, createMilestone, deleteMilestone, type Milestone } from '../lib/milestoneService';
import { format, differenceInDays, parseISO } from 'date-fns';
import type { Exam } from '../types/database';

type Tab = 'plans' | 'todos' | 'milestones';

// Preset timer durations in minutes
const TIMER_PRESETS = [1, 2, 5, 10, 15, 20, 25, 30, 45, 60];

// Sound utilities
function playCompletionBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

function playAlarmSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const totalDuration = 5;

    // Fire 5 bursts across 5 seconds
    for (let i = 0; i < 10; i++) {
      const t = ctx.currentTime + i * 0.5;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      // Alternating high-low tones for alarm effect
      osc.frequency.value = i % 2 === 0 ? 1200 : 900;
      osc.type = 'square';
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.05);
      gain.gain.setValueAtTime(0.4, t + 0.35);
      gain.gain.linearRampToValueAtTime(0, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.45);
    }
  } catch {}
}

export function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('plans');
  const [exams, setExams] = useState<Exam[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Todo form state
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [showTodoForm, setShowTodoForm] = useState(false);

  // Timer state
  const [activeTimerTodoId, setActiveTimerTodoId] = useState<string | null>(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(0);
  const [timerDurationSeconds, setTimerDurationSeconds] = useState(0);
  const [timerExpired, setTimerExpired] = useState(false);
  const [showTimerPicker, setShowTimerPicker] = useState<string | null>(null); // todoId
  const [customMinutes, setCustomMinutes] = useState('');
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Milestone state
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);

  useEffect(() => {
    loadExams();
    loadTodos();
    loadMilestones();
  }, []);

  // Countdown tick
  useEffect(() => {
    if (activeTimerTodoId && timerSecondsLeft > 0 && !timerExpired) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSecondsLeft((s) => {
          if (s <= 1) {
            // Timer hit zero
            clearInterval(timerIntervalRef.current!);
            timerIntervalRef.current = null;
            setTimerExpired(true);
            playAlarmSound();
            // Stop alarm after 5 s
            alarmIntervalRef.current = setTimeout(() => {
              setTimerExpired(false);
            }, 5000) as unknown as ReturnType<typeof setInterval>;
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [activeTimerTodoId, timerExpired]);

  const loadExams = async () => {
    try {
      const data = await getExams();
      setExams(data);
    } catch (err) {
      console.error('Failed to load exams:', err);
    }
  };

  const loadTodos = async () => {
    try {
      setLoading(true);
      const data = await getTodos();
      setTodos(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load todos:', err);
      setError('Failed to load todos');
    } finally {
      setLoading(false);
    }
  };

  const loadMilestones = async () => {
    try {
      const data = await getMilestones();
      setMilestones(data);
    } catch (err) {
      console.error('Failed to load milestones:', err);
    }
  };

  const handleDeleteExam = async (examId: string, examName: string) => {
    if (!confirm(`Delete "${examName}"? This cannot be undone.`)) return;
    try {
      setDeletingId(examId);
      await deleteExam(examId);
      setExams(exams.filter((e) => e.id !== examId));
    } catch (err) {
      console.error('Failed to delete exam:', err);
      setError('Failed to delete study plan');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddTodo = async () => {
    if (!newTodoTitle.trim()) return;
    try {
      const todo = await createTodo(newTodoTitle.trim());
      setTodos([todo, ...todos]);
      setNewTodoTitle('');
      setShowTodoForm(false);
    } catch (err) {
      console.error('Failed to create todo:', err);
      setError('Failed to create todo');
    }
  };

  const handleToggleTodo = useCallback(async (id: string, completed: boolean) => {
    try {
      const updated = await updateTodo(id, { is_completed: !completed });
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
      if (!completed) playCompletionBeep();
    } catch (err) {
      console.error('Failed to update todo:', err);
    }
  }, []);

  const handleDeleteTodo = async (id: string) => {
    if (activeTimerTodoId === id) handleStopTimer();
    if (!confirm('Delete this to-do?')) return;
    try {
      await deleteTodo(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Failed to delete todo:', err);
    }
  };

  // Start countdown with a chosen number of minutes
  const handleStartTimer = useCallback((todoId: string, minutes: number) => {
    const secs = minutes * 60;
    setActiveTimerTodoId(todoId);
    setTimerSecondsLeft(secs);
    setTimerDurationSeconds(secs);
    setTimerExpired(false);
    setShowTimerPicker(null);
    setCustomMinutes('');
  }, []);

  const handleStopTimer = useCallback(async () => {
    if (!activeTimerTodoId) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (alarmIntervalRef.current) {
      clearTimeout(alarmIntervalRef.current as unknown as ReturnType<typeof setTimeout>);
      alarmIntervalRef.current = null;
    }

    const elapsedSecs = timerDurationSeconds - timerSecondsLeft;
    if (elapsedSecs > 0) {
      const todo = todos.find((t) => t.id === activeTimerTodoId);
      if (todo) {
        const newMinutes = (todo.timer_minutes || 0) + Math.floor(elapsedSecs / 60);
        try {
          const updated = await updateTodo(activeTimerTodoId, { timer_minutes: newMinutes });
          setTodos((prev) => prev.map((t) => (t.id === activeTimerTodoId ? updated : t)));
        } catch (err) {
          console.error('Failed to save timer:', err);
        }
      }
    }
    setActiveTimerTodoId(null);
    setTimerSecondsLeft(0);
    setTimerDurationSeconds(0);
    setTimerExpired(false);
  }, [activeTimerTodoId, timerDurationSeconds, timerSecondsLeft, todos]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timerProgressPercent = timerDurationSeconds > 0
    ? ((timerDurationSeconds - timerSecondsLeft) / timerDurationSeconds) * 100
    : 0;

  // Milestone handlers
  const handleAddMilestone = async () => {
    if (!newMilestoneTitle.trim() || !newMilestoneDate) return;
    try {
      const milestone = await createMilestone(newMilestoneTitle.trim(), newMilestoneDate);
      setMilestones((prev) =>
        [...prev, milestone].sort((a, b) => a.target_date.localeCompare(b.target_date))
      );
      setNewMilestoneTitle('');
      setNewMilestoneDate('');
      setShowMilestoneForm(false);
    } catch (err) {
      console.error('Failed to create milestone:', err);
      setError('Failed to create milestone');
    }
  };

  const handleDeleteMilestone = async (id: string) => {
    if (!confirm('Delete this milestone?')) return;
    try {
      await deleteMilestone(id);
      setMilestones((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error('Failed to delete milestone:', err);
    }
  };

  const tabs = [
    { id: 'plans' as const, label: 'Study Plans', icon: BookOpen },
    { id: 'todos' as const, label: 'To-Do List', icon: CheckSquare },
    { id: 'milestones' as const, label: 'Milestones', icon: Flag },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" onClick={() => setShowTimerPicker(null)}>
      <Header />

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    isActive
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* ── Study Plans Tab ── */}
        {activeTab === 'plans' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Your Study Plans</h2>
              <button
                onClick={() => navigate('/new')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition"
              >
                <Plus className="w-5 h-5" />
                New Plan
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              </div>
            ) : exams.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">No study plans yet</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-6">Create your first study plan and start preparing for your exams</p>
                  <button
                    onClick={() => navigate('/new')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition"
                  >
                    <Plus className="w-5 h-5" />
                    Create Study Plan
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {exams.map((exam) => {
                  const daysRemaining = differenceInDays(new Date(exam.exam_date), new Date());
                  const isPast = daysRemaining < 0;
                  return (
                    <div
                      key={exam.id}
                      className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-lg transition cursor-pointer group ${isPast ? 'opacity-60' : ''}`}
                      onClick={() => navigate(`/exam/${exam.id}`)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">{exam.name}</h3>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteExam(exam.id, exam.name); }}
                          disabled={deletingId === exam.id}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                        >
                          {deletingId === exam.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(exam.exam_date), 'MMM d, yyyy')}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-slate-400" />
                          {isPast ? <span className="text-red-500">Past due</span> : daysRemaining === 0 ? <span className="text-amber-500">Today!</span> : <span className="text-slate-500 dark:text-slate-400">{daysRemaining}d left</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── To-Do Tab ── */}
        {activeTab === 'todos' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">To-Do List</h2>
              <button
                onClick={() => setShowTodoForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition"
              >
                <Plus className="w-5 h-5" />
                Add To-Do
              </button>
            </div>

            {/* Active Countdown Banner */}
            {activeTimerTodoId && (
              <div className={`mb-4 p-4 rounded-xl border transition-all ${
                timerExpired
                  ? 'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-600 animate-pulse'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${timerExpired ? 'bg-red-500' : 'bg-blue-500 animate-pulse'}`} />
                    <div>
                      <span className={`font-semibold ${timerExpired ? 'text-red-700 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}`}>
                        {timerExpired ? 'Time\'s up!' : todos.find((t) => t.id === activeTimerTodoId)?.title}
                      </span>
                      {!timerExpired && (
                        <div className="mt-1 h-1.5 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden w-40">
                          <div
                            className="h-full bg-blue-500 transition-all duration-1000"
                            style={{ width: `${timerProgressPercent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {timerExpired ? (
                      <div className="flex items-center gap-2">
                        <AlarmClock className="w-6 h-6 text-red-500 animate-bounce" />
                        <span className="text-xl font-bold text-red-600 dark:text-red-400">00:00</span>
                      </div>
                    ) : (
                      <span className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                        {formatCountdown(timerSecondsLeft)}
                      </span>
                    )}
                    <button
                      onClick={handleStopTimer}
                      className={`p-2 rounded-lg text-white ${timerExpired ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      {timerExpired ? <RotateCcw className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add Todo Form */}
            {showTodoForm && (
              <div className="mb-4 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newTodoTitle}
                    onChange={(e) => setNewTodoTitle(e.target.value)}
                    placeholder="What do you need to do?"
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddTodo(); if (e.key === 'Escape') setShowTodoForm(false); }}
                  />
                  <button onClick={handleAddTodo} className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600">
                    <Check className="w-5 h-5" />
                  </button>
                  <button onClick={() => { setShowTodoForm(false); setNewTodoTitle(''); }} className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Todo List */}
            {todos.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                    <CheckSquare className="w-8 h-8 text-blue-500 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">No to-dos yet</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-6">Add your first to-do and stay organized</p>
                  <button onClick={() => setShowTodoForm(true)} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition">
                    <Plus className="w-5 h-5" />
                    Add To-Do
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {todos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-800 border transition group ${
                      activeTimerTodoId === todo.id
                        ? 'border-blue-400 dark:border-blue-600 shadow-md shadow-blue-100 dark:shadow-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700'
                    } ${todo.is_completed ? 'opacity-60' : ''}`}
                  >
                    {/* Completion toggle */}
                    <button
                      onClick={() => handleToggleTodo(todo.id, todo.is_completed)}
                      className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        todo.is_completed
                          ? 'bg-emerald-500 border-emerald-500 text-white scale-110'
                          : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500 hover:scale-105'
                      }`}
                    >
                      {todo.is_completed && <Check className="w-3.5 h-3.5" />}
                    </button>

                    {/* Title and time logged */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${todo.is_completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
                        {todo.title}
                      </p>
                      {todo.timer_minutes != null && todo.timer_minutes > 0 && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {todo.timer_minutes >= 60
                            ? `${Math.floor(todo.timer_minutes / 60)}h ${todo.timer_minutes % 60}m logged`
                            : `${todo.timer_minutes} min logged`}
                        </p>
                      )}
                    </div>

                    {/* Timer icon or current status */}
                    {!todo.is_completed && activeTimerTodoId !== todo.id && (
                      <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          disabled={activeTimerTodoId !== null}
                          onClick={() => setShowTimerPicker(showTimerPicker === todo.id ? null : todo.id)}
                          className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 opacity-0 group-hover:opacity-100 transition disabled:opacity-30"
                          title="Set timer"
                        >
                          <Timer className="w-5 h-5" />
                        </button>

                        {/* Duration picker dropdown */}
                        {showTimerPicker === todo.id && (
                          <div
                            className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl p-3 w-64"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Choose duration</p>
                            <div className="grid grid-cols-4 gap-1.5 mb-3">
                              {TIMER_PRESETS.map((min) => (
                                <button
                                  key={min}
                                  onClick={() => handleStartTimer(todo.id, min)}
                                  className="py-1.5 rounded-lg text-sm font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
                                >
                                  {min}m
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min={1}
                                max={180}
                                value={customMinutes}
                                onChange={(e) => setCustomMinutes(e.target.value)}
                                placeholder="Custom min"
                                className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                onKeyDown={(e) => { if (e.key === 'Enter' && customMinutes) handleStartTimer(todo.id, parseInt(customMinutes)); }}
                              />
                              <button
                                onClick={() => customMinutes && handleStartTimer(todo.id, parseInt(customMinutes))}
                                className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600 disabled:opacity-50"
                                disabled={!customMinutes}
                              >
                                Go
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="flex-shrink-0 p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Milestones Tab ── */}
        {activeTab === 'milestones' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Milestones</h2>
              <button
                onClick={() => setShowMilestoneForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition"
              >
                <Plus className="w-5 h-5" />
                Add Milestone
              </button>
            </div>

            {showMilestoneForm && (
              <div className="mb-4 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex gap-3 flex-wrap">
                  <input
                    type="text"
                    value={newMilestoneTitle}
                    onChange={(e) => setNewMilestoneTitle(e.target.value)}
                    placeholder="Milestone name"
                    className="flex-1 min-w-48 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddMilestone(); if (e.key === 'Escape') setShowMilestoneForm(false); }}
                  />
                  <input
                    type="date"
                    value={newMilestoneDate}
                    onChange={(e) => setNewMilestoneDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  />
                  <button onClick={handleAddMilestone} className="px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600">
                    <Check className="w-5 h-5" />
                  </button>
                  <button onClick={() => setShowMilestoneForm(false)} className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {milestones.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                    <Flag className="w-8 h-8 text-amber-500 dark:text-amber-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">No milestones yet</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-6">Track important dates and countdowns</p>
                  <button onClick={() => setShowMilestoneForm(true)} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition">
                    <Plus className="w-5 h-5" />
                    Add Milestone
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {milestones.map((milestone) => {
                  const daysLeft = differenceInDays(parseISO(milestone.target_date), new Date());
                  const isPast = daysLeft < 0;
                  const isToday = daysLeft === 0;
                  const isSoon = !isPast && daysLeft <= 7;
                  return (
                    <div
                      key={milestone.id}
                      className={`bg-white dark:bg-slate-800 rounded-xl border p-5 group transition ${
                        isToday ? 'border-amber-400 dark:border-amber-600 shadow-md shadow-amber-100 dark:shadow-amber-900/20'
                        : isSoon ? 'border-orange-300 dark:border-orange-700'
                        : isPast ? 'border-slate-200 dark:border-slate-700 opacity-60'
                        : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">{milestone.title}</h3>
                        <button
                          onClick={() => handleDeleteMilestone(milestone.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-bold tabular-nums ${
                          isPast ? 'text-slate-400 dark:text-slate-500'
                          : isToday ? 'text-amber-500'
                          : isSoon ? 'text-orange-500 dark:text-orange-400'
                          : 'text-blue-600 dark:text-blue-400'
                        }`}>
                          {isPast ? Math.abs(daysLeft) : daysLeft}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {isPast ? 'days ago' : isToday ? '— Today!' : 'days left'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
                        {format(parseISO(milestone.target_date), 'MMMM d, yyyy')}
                      </p>
                      {isSoon && !isPast && !isToday && (
                        <span className="mt-2 inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                          Coming soon
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
