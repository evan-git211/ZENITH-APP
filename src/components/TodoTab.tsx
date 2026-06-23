import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '../lib/toast';
import { useConfirm } from '../hooks/useConfirm';
import { format } from 'date-fns';
import {
  Plus, CheckSquare, Clock, Trash2, Check, X, Timer,
  RotateCcw, AlarmClock, Pause, Play, ChevronRight, Pencil, CalendarClock,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  getTodos, createTodo, updateTodo, deleteTodo, clearCompletedTodos,
  getCategories, createCategory, deleteCategory, updateCategoryName,
  type Todo, type TodoCategory,
} from '../lib/todoService';

// ── Color palette for categories ────────────────────────────────────────────
const CATEGORY_COLORS = [
  '#6b7280', // gray
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#06b6d4', // cyan
];

const TIMER_PRESETS = [1, 2, 5, 10, 15, 20, 25, 30, 45, 60];

const TIMER_KEY = 'zenith_active_timer';
interface TimerRecord { todoId: string; endTime: number; durationMs: number; }

function loadTimerRecord(): TimerRecord | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as TimerRecord;
    if (rec.endTime <= Date.now()) { localStorage.removeItem(TIMER_KEY); return null; }
    return rec;
  } catch { return null; }
}

function playCompletionBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880; osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

function playMarimbaInCtx(ctx: AudioContext) {
  const fundamental = 880;
  const duration = 0.9;
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
    osc.type = 'sine'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now); osc.stop(now + duration);
  });
}

// ── Deadline helpers ─────────────────────────────────────────────────────────

type DeadlineUrgency = 'overdue' | 'today' | 'soon' | 'future';

function deadlineInfo(deadline: string | null): { label: string; urgency: DeadlineUrgency } | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  const now = new Date();
  const isDateOnly = d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;

  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);

  let urgency: DeadlineUrgency;
  if (isDateOnly) {
    if (dDay < today) urgency = 'overdue';
    else if (dDay.getTime() === today.getTime()) urgency = 'today';
    else if (dDay.getTime() === tomorrow.getTime()) urgency = 'soon';
    else urgency = 'future';
  } else {
    if (d < now) urgency = 'overdue';
    else if (dDay.getTime() === today.getTime()) urgency = 'today';
    else if (dDay.getTime() === tomorrow.getTime()) urgency = 'soon';
    else urgency = 'future';
  }

  let label: string;
  if (isDateOnly) {
    if (urgency === 'overdue') label = `Overdue · ${format(d, 'MMM d')}`;
    else if (urgency === 'today') label = 'Due today';
    else if (urgency === 'soon') label = 'Due tomorrow';
    else {
      const daysLeft = Math.ceil((dDay.getTime() - today.getTime()) / 86400000);
      label = daysLeft <= 6 ? `Due ${format(d, 'EEE')}` : `Due ${format(d, 'MMM d')}`;
    }
  } else {
    const timeStr = format(d, 'h:mm a');
    if (urgency === 'overdue') label = `Overdue · ${format(d, 'MMM d')} ${timeStr}`;
    else if (urgency === 'today') label = `Today at ${timeStr}`;
    else if (urgency === 'soon') label = `Tomorrow at ${timeStr}`;
    else label = `${format(d, 'MMM d')} at ${timeStr}`;
  }

  return { label, urgency };
}

// ── Inline add-todo input for a specific category ────────────────────────────
function InlineAddTodo({ categoryId, onAdd }: { categoryId: string | null; onAdd: (title: string, categoryId: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  const submit = () => {
    if (!title.trim()) return;
    onAdd(title.trim(), categoryId);
    setTitle('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-400 transition py-1.5 px-1 w-full"
      >
        <Plus className="w-3.5 h-3.5" />
        Add to-do
      </button>
    );
  }

  return (
    <div className="flex gap-2 mt-1">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') { setOpen(false); setTitle(''); }
        }}
        placeholder="To-do title…"
        className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-neutral-700 bg-neutral-950 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-neutral-600"
      />
      <button onClick={submit} className="px-3 py-1.5 rounded-lg bg-amber-500 text-neutral-900 text-sm font-semibold hover:bg-amber-400 transition">
        <Check className="w-4 h-4" />
      </button>
      <button onClick={() => { setOpen(false); setTitle(''); }} className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Editable category name ───────────────────────────────────────────────────
function CategoryNameEditor({ category, onRename }: { category: TodoCategory; onRename: (id: string, name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(category.name);

  const commit = () => {
    if (draft.trim() && draft.trim() !== category.name) onRename(category.id, draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(category.name); setEditing(false); } }}
        className="bg-transparent border-b border-neutral-600 text-neutral-100 text-sm font-semibold focus:outline-none focus:border-amber-500 px-0.5 min-w-0 w-32"
      />
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 group/name">
      <span className="text-sm font-semibold text-white">{category.name}</span>
      <Pencil className="w-3 h-3 text-neutral-600 opacity-0 group-hover/name:opacity-100 transition" />
    </button>
  );
}

// ── Main TodoTab ─────────────────────────────────────────────────────────────
export function TodoTab() {
  const { confirm, ConfirmNode } = useConfirm();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [categories, setCategories] = useState<TodoCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Global add-todo form (top bar)
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState('');

  // Completed section
  const [showCompleted, setShowCompleted] = useState(false);

  // New category form
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);

  // Timer state — end-time based so it survives navigation (restored from localStorage)
  const [activeTimerTodoId, setActiveTimerTodoId] = useState<string | null>(() => loadTimerRecord()?.todoId ?? null);
  const [timerEndTime, setTimerEndTime] = useState<number>(() => loadTimerRecord()?.endTime ?? 0);
  const [timerDurationMs, setTimerDurationMs] = useState<number>(() => loadTimerRecord()?.durationMs ?? 0);
  const [_timerTick, setTimerTick] = useState(0);
  const [timerExpired, setTimerExpired] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerPausedRemainingMs, setTimerPausedRemainingMs] = useState(0);
  const [showTimerPicker, setShowTimerPicker] = useState<string | null>(null);
  const [customMinutes, setCustomMinutes] = useState('');
  const alarmCtxRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Deadline picker state
  const [showDeadlinePicker, setShowDeadlinePicker] = useState<string | null>(null);
  const [dpDate, setDpDate] = useState('');
  const [dpTime, setDpTime] = useState('');
  const [dpHasTime, setDpHasTime] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current) { clearInterval(alarmIntervalRef.current); alarmIntervalRef.current = null; }
    if (alarmCtxRef.current) { try { alarmCtxRef.current.close(); } catch {} alarmCtxRef.current = null; }
  }, []);

  const startAlarm = useCallback(() => {
    stopAlarm();
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      alarmCtxRef.current = ctx;
      playMarimbaInCtx(ctx);
      alarmIntervalRef.current = setInterval(() => {
        if (alarmCtxRef.current) playMarimbaInCtx(alarmCtxRef.current);
      }, 2000);
      // auto-stop after 5 min
      setTimeout(stopAlarm, 5 * 60 * 1000);
    } catch {}
  }, [stopAlarm]);

  useEffect(() => {
    if (!activeTimerTodoId || !timerEndTime || timerExpired) return;
    const id = setInterval(() => {
      if (timerEndTime - Date.now() <= 0) {
        clearInterval(id);
        localStorage.removeItem(TIMER_KEY);
        setTimerExpired(true);
        startAlarm();
      } else {
        setTimerTick((t) => t + 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [activeTimerTodoId, timerEndTime, timerExpired, startAlarm]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [todosData, catsData] = await Promise.all([getTodos(), getCategories()]);
      setTodos(todosData);
      setCategories(catsData);
      setError(null);
    } catch (err) {
      console.error('Failed to load todos:', err);
      setError('Failed to load to-dos. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // ── Todo CRUD ──────────────────────────────────────────────────────────────

  const handleAddTodo = async (title: string, categoryId: string | null = null) => {
    try {
      const todo = await createTodo(title);
      // Attach category immediately if given
      if (categoryId) {
        const updated = await updateTodo(todo.id, { category_id: categoryId });
        setTodos((prev) => [updated, ...prev]);
      } else {
        setTodos((prev) => [todo, ...prev]);
      }
      setNewTodoTitle('');
      setShowTodoForm(false);
    } catch (err) {
      console.error('Failed to create todo:', err);
      setError('Failed to create to-do.');
    }
  };

  const handleToggleTodo = useCallback(async (id: string, completed: boolean) => {
    try {
      const updated = await updateTodo(id, { is_completed: !completed });
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
      if (!completed) playCompletionBeep();
    } catch (err) {
      console.error('Failed to toggle todo:', err);
    }
  }, []);

  const handleDeleteTodo = async (id: string) => {
    if (activeTimerTodoId === id) handleStopTimer();
    const ok = await confirm({ message: 'Delete this to-do?', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteTodo(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
      toast.success('To-do deleted');
    } catch (err) {
      console.error('Failed to delete todo:', err);
      toast.error('Failed to delete to-do');
    }
  };

  const handleClearCompleted = async () => {
    const completedIds = todos.filter((t) => t.is_completed).map((t) => t.id);
    if (!completedIds.length) return;
    const ok = await confirm({ message: `Delete ${completedIds.length} completed to-do${completedIds.length === 1 ? '' : 's'}?`, confirmLabel: 'Delete All' });
    if (!ok) return;
    try {
      await clearCompletedTodos(completedIds);
      setTodos((prev) => prev.filter((t) => !t.is_completed));
      setShowCompleted(false);
      toast.success('Completed to-dos cleared');
    } catch (err) {
      console.error('Failed to clear completed:', err);
      toast.error('Failed to clear completed to-dos');
    }
  };

  // ── Category CRUD ──────────────────────────────────────────────────────────

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const cat = await createCategory(newCategoryName.trim(), newCategoryColor);
      setCategories((prev) => [...prev, cat]);
      setNewCategoryName('');
      setNewCategoryColor(CATEGORY_COLORS[0]);
      setShowCategoryForm(false);
    } catch (err) {
      console.error('Failed to create category:', err);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    const ok = await confirm({ message: `Delete category "${name}"? Its to-dos will move to uncategorized.`, confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setTodos((prev) => prev.map((t) => t.category_id === id ? { ...t, category_id: null } : t));
      toast.success('Category deleted');
    } catch (err) {
      console.error('Failed to delete category:', err);
      toast.error('Failed to delete category');
    }
  };

  const handleRenameCategory = async (id: string, name: string) => {
    try {
      const updated = await updateCategoryName(id, name);
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err) {
      console.error('Failed to rename category:', err);
    }
  };

  // ── Drag and drop ──────────────────────────────────────────────────────────

  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;

    const newCategoryId = destination.droppableId === 'uncategorized'
      ? null
      : destination.droppableId.replace('cat-', '');

    const todo = todos.find((t) => t.id === draggableId);
    if (!todo || todo.category_id === newCategoryId) return;

    // Optimistic update
    setTodos((prev) => prev.map((t) =>
      t.id === draggableId ? { ...t, category_id: newCategoryId } : t
    ));

    try {
      await updateTodo(draggableId, { category_id: newCategoryId });
    } catch (err) {
      console.error('Failed to move todo:', err);
      // Revert
      setTodos((prev) => prev.map((t) =>
        t.id === draggableId ? { ...t, category_id: todo.category_id } : t
      ));
    }
  }, [todos]);

  // ── Timer handlers ─────────────────────────────────────────────────────────

  const handleStartTimer = useCallback((todoId: string, minutes: number) => {
    const durationMs = minutes * 60 * 1000;
    const endTime = Date.now() + durationMs;
    const rec: TimerRecord = { todoId, endTime, durationMs };
    localStorage.setItem(TIMER_KEY, JSON.stringify(rec));
    setActiveTimerTodoId(todoId);
    setTimerEndTime(endTime);
    setTimerDurationMs(durationMs);
    setTimerExpired(false);
    setTimerTick(0);
    setShowTimerPicker(null);
    setCustomMinutes('');
  }, []);

  const handleStopTimer = useCallback(async () => {
    if (!activeTimerTodoId) return;
    stopAlarm();
    const effectiveEndTime = timerPaused ? Date.now() + timerPausedRemainingMs : timerEndTime;
    const elapsedMs = timerDurationMs - Math.max(0, effectiveEndTime - Date.now());
    if (elapsedMs > 0) {
      const todo = todos.find((t) => t.id === activeTimerTodoId);
      if (todo) {
        const newMinutes = (todo.timer_minutes || 0) + Math.floor(elapsedMs / 60000);
        try {
          const updated = await updateTodo(activeTimerTodoId, { timer_minutes: newMinutes });
          setTodos((prev) => prev.map((t) => (t.id === activeTimerTodoId ? updated : t)));
        } catch {}
      }
    }
    localStorage.removeItem(TIMER_KEY);
    setActiveTimerTodoId(null);
    setTimerEndTime(0);
    setTimerDurationMs(0);
    setTimerExpired(false);
    setTimerPaused(false);
    setTimerPausedRemainingMs(0);
    setTimerTick(0);
  }, [activeTimerTodoId, timerDurationMs, timerEndTime, timerPaused, timerPausedRemainingMs, todos, stopAlarm]);

  const handlePauseTimer = useCallback(() => {
    const remaining = timerEndTime - Date.now();
    setTimerPausedRemainingMs(remaining);
    setTimerEndTime(0);
    setTimerPaused(true);
  }, [timerEndTime]);

  const handleResumeTimer = useCallback(() => {
    setTimerEndTime(Date.now() + timerPausedRemainingMs);
    setTimerPaused(false);
  }, [timerPausedRemainingMs]);

  // ── Deadline handlers ──────────────────────────────────────────────────────

  const openDeadlinePicker = useCallback((todo: Todo) => {
    if (todo.deadline) {
      const d = new Date(todo.deadline);
      const isDateOnly = d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
      setDpDate(format(d, 'yyyy-MM-dd'));
      setDpHasTime(!isDateOnly);
      setDpTime(!isDateOnly ? format(d, 'HH:mm') : '');
    } else {
      setDpDate('');
      setDpHasTime(false);
      setDpTime('');
    }
    setShowTimerPicker(null);
    setShowDeadlinePicker(todo.id);
  }, []);

  const handleSetDeadline = useCallback(async (todoId: string, dateStr: string, timeStr: string, hasTime: boolean) => {
    let deadline: string | null = null;
    if (dateStr) {
      // date-only → midnight local = T00:00:00; with time → use provided time
      const raw = hasTime && timeStr ? `${dateStr}T${timeStr}:00` : `${dateStr}T00:00:00`;
      deadline = new Date(raw).toISOString();
    }
    try {
      const updated = await updateTodo(todoId, { deadline });
      setTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
      setShowDeadlinePicker(null);
    } catch (err) {
      console.error('Failed to set deadline:', err);
    }
  }, []);

  const timerSecondsLeft = activeTimerTodoId
    ? timerPaused
      ? Math.max(0, Math.ceil(timerPausedRemainingMs / 1000))
      : timerEndTime
        ? Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000))
        : 0
    : 0;

  const formatCountdown = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const timerProgressPercent = timerDurationMs > 0
    ? timerPaused
      ? Math.min(100, ((timerDurationMs - timerPausedRemainingMs) / timerDurationMs) * 100)
      : timerEndTime > 0
        ? Math.min(100, ((timerDurationMs - Math.max(0, timerEndTime - Date.now())) / timerDurationMs) * 100)
        : 0
    : 0;

  // ── Derived data ───────────────────────────────────────────────────────────

  const incompleteTodos = todos.filter((t) => !t.is_completed);
  const completedTodos = todos.filter((t) => t.is_completed);

  const todosForCategory = (catId: string | null) =>
    incompleteTodos.filter((t) => t.category_id === catId);

  // ── Todo card (shared render) ──────────────────────────────────────────────
  const renderTodoCard = (todo: Todo, index: number, draggable = true) => {
    const dlInfo = deadlineInfo(todo.deadline ?? null);
    const urgencyClasses: Record<DeadlineUrgency, string> = {
      overdue: 'text-red-400',
      today: 'text-amber-400',
      soon: 'text-orange-400',
      future: 'text-neutral-500',
    };
    const urgencyBtnClasses: Record<DeadlineUrgency, string> = {
      overdue: 'text-red-400 hover:bg-red-900/20',
      today: 'text-amber-400 hover:bg-amber-900/20',
      soon: 'text-orange-400 hover:bg-orange-900/20',
      future: 'text-neutral-400 hover:bg-neutral-800',
    };

    const inner = (
      <div
        className={`flex items-center gap-3 p-3.5 rounded-xl bg-neutral-900 border transition group ${
          activeTimerTodoId === todo.id
            ? 'border-amber-500 shadow-md shadow-amber-500/10'
            : dlInfo?.urgency === 'overdue'
            ? 'border-red-900/50'
            : 'border-neutral-800'
        } ${todo.is_completed ? 'opacity-60' : ''}`}
      >
        <button
          onClick={() => handleToggleTodo(todo.id, todo.is_completed)}
          className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            todo.is_completed
              ? 'bg-amber-500 border-amber-500 text-neutral-900'
              : 'border-neutral-600 hover:border-amber-500'
          }`}
        >
          {todo.is_completed && <Check className="w-3 h-3" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${todo.is_completed ? 'text-neutral-500 line-through' : 'text-neutral-100'}`}>
            {todo.title}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            {dlInfo && (
              <p className={`text-xs flex items-center gap-1 mt-0.5 ${urgencyClasses[dlInfo.urgency]}`}>
                <CalendarClock className="w-3 h-3" />
                {dlInfo.label}
              </p>
            )}
            {todo.timer_minutes != null && todo.timer_minutes > 0 && (
              <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {todo.timer_minutes >= 60
                  ? `${Math.floor(todo.timer_minutes / 60)}h ${todo.timer_minutes % 60}m logged`
                  : `${todo.timer_minutes}m logged`}
              </p>
            )}
          </div>
        </div>

        {/* Deadline button */}
        {!todo.is_completed && (
          <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => showDeadlinePicker === todo.id ? setShowDeadlinePicker(null) : openDeadlinePicker(todo)}
              className={`p-1.5 rounded-lg transition ${
                dlInfo
                  ? urgencyBtnClasses[dlInfo.urgency]
                  : 'text-neutral-600 hover:bg-neutral-800 opacity-0 group-hover:opacity-100'
              }`}
              title="Set deadline"
            >
              <CalendarClock className="w-4 h-4" />
            </button>
            {showDeadlinePicker === todo.id && (
              <div
                className="absolute right-0 top-full mt-1 z-50 bg-neutral-900 rounded-xl border border-neutral-800 shadow-xl p-3 w-72"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wide">Set deadline</p>
                {/* Quick presets */}
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {([
                    { label: 'Today', days: 0 },
                    { label: 'Tomorrow', days: 1 },
                    { label: 'In 3 days', days: 3 },
                    { label: 'Next week', days: 7 },
                  ] as const).map(({ label, days }) => (
                    <button
                      key={label}
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + days);
                        setDpDate(format(d, 'yyyy-MM-dd'));
                        setDpHasTime(false);
                        setDpTime('');
                      }}
                      className="py-1.5 rounded-lg text-xs font-medium bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/* Date input */}
                <input
                  type="date"
                  value={dpDate}
                  onChange={(e) => setDpDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-neutral-700 bg-neutral-950 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500 mb-2"
                />
                {/* Time toggle */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => { setDpHasTime((v) => !v); if (dpHasTime) setDpTime(''); }}
                    className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition ${
                      dpHasTime ? 'bg-amber-500/20 text-amber-300' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {dpHasTime ? 'Remove time' : 'Add specific time'}
                  </button>
                  {dpHasTime && (
                    <input
                      type="time"
                      value={dpTime}
                      onChange={(e) => setDpTime(e.target.value)}
                      className="flex-1 px-3 py-1 text-sm rounded-lg border border-neutral-700 bg-neutral-950 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  )}
                </div>
                {/* Apply / Clear */}
                <div className="flex gap-2">
                  <button
                    onClick={() => dpDate && handleSetDeadline(todo.id, dpDate, dpTime, dpHasTime)}
                    disabled={!dpDate}
                    className="flex-1 py-1.5 rounded-lg bg-amber-500 text-neutral-900 text-sm font-semibold hover:bg-amber-400 disabled:opacity-50 transition"
                  >
                    Apply
                  </button>
                  {todo.deadline && (
                    <button
                      onClick={() => handleSetDeadline(todo.id, '', '', false)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-400 text-sm hover:bg-neutral-700 hover:text-red-400 transition"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Timer button */}
        {!todo.is_completed && activeTimerTodoId !== todo.id && (
          <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              disabled={activeTimerTodoId !== null}
              onClick={() => setShowTimerPicker(showTimerPicker === todo.id ? null : todo.id)}
              className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition disabled:opacity-30"
              title="Set timer"
            >
              <Timer className="w-4 h-4" />
            </button>
            {showTimerPicker === todo.id && (
              <div
                className="absolute right-0 top-full mt-1 z-50 bg-neutral-900 rounded-xl border border-neutral-800 shadow-xl p-3 w-64"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wide">Choose duration</p>
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {TIMER_PRESETS.map((min) => (
                    <button key={min} onClick={() => handleStartTimer(todo.id, min)}
                      className="py-1.5 rounded-lg text-sm font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition">
                      {min}m
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="number" min={1} max={180} value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    placeholder="Custom min"
                    className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-neutral-700 bg-neutral-950 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-neutral-600"
                    onKeyDown={(e) => { if (e.key === 'Enter' && customMinutes) handleStartTimer(todo.id, parseInt(customMinutes)); }}
                  />
                  <button onClick={() => customMinutes && handleStartTimer(todo.id, parseInt(customMinutes))}
                    disabled={!customMinutes}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 text-neutral-900 text-sm hover:bg-amber-400 disabled:opacity-50 transition">
                    Go
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <button onClick={() => handleDeleteTodo(todo.id)}
          className="flex-shrink-0 p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );

    if (!draggable) return <div key={todo.id}>{inner}</div>;

    return (
      <Draggable key={todo.id} draggableId={todo.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={snapshot.isDragging ? 'opacity-80 scale-[1.02]' : ''}
          >
            {inner}
          </div>
        )}
      </Draggable>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div onClick={() => { setShowTimerPicker(null); setShowDeadlinePicker(null); }}>
      {ConfirmNode}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-neutral-100">To-Do List</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCategoryForm((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-400 border border-neutral-700 hover:bg-neutral-800 hover:text-neutral-100 transition"
          >
            <Plus className="w-4 h-4" />
            New Category
          </button>
          <button
            onClick={() => setShowTodoForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-900 font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Add To-Do
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-800 text-sm text-red-400 flex justify-between">
          {error}
          <button onClick={() => { setError(null); loadAll(); }} className="underline ml-2">Retry</button>
        </div>
      )}

      {/* New category form */}
      {showCategoryForm && (
        <div className="mb-4 p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <p className="text-sm font-medium text-neutral-300 mb-3">New Category</p>
          <div className="flex gap-3 items-start flex-wrap">
            <input
              autoFocus
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCategory(); if (e.key === 'Escape') setShowCategoryForm(false); }}
              placeholder="Category name…"
              className="flex-1 min-w-40 px-4 py-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-neutral-600 text-sm"
            />
            <div className="flex gap-1.5 items-center">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewCategoryColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform ${newCategoryColor === c ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-neutral-900' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button onClick={handleCreateCategory} className="px-4 py-2 rounded-lg bg-amber-500 text-neutral-900 font-semibold text-sm hover:bg-amber-400 transition">
              Create
            </button>
            <button onClick={() => { setShowCategoryForm(false); setNewCategoryName(''); }} className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-400 text-sm hover:bg-neutral-700 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Global add-todo form */}
      {showTodoForm && (
        <div className="mb-4 p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="flex gap-3">
            <input autoFocus type="text" value={newTodoTitle}
              onChange={(e) => setNewTodoTitle(e.target.value)}
              placeholder="What do you need to do?"
              className="flex-1 px-4 py-2 rounded-lg border border-neutral-700 bg-neutral-950 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-neutral-600 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTodo(newTodoTitle); if (e.key === 'Escape') { setShowTodoForm(false); setNewTodoTitle(''); } }}
            />
            <button onClick={() => handleAddTodo(newTodoTitle)} className="px-4 py-2 rounded-lg bg-amber-500 text-neutral-900 hover:bg-amber-400 transition">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => { setShowTodoForm(false); setNewTodoTitle(''); }} className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Active timer banner */}
      {activeTimerTodoId && (
        <div className={`mb-4 p-4 rounded-xl border transition-all ${
          timerExpired ? 'bg-red-900/30 border-red-600 animate-pulse' : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${timerExpired ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`} />
              <div>
                <span className={`font-semibold text-sm ${timerExpired ? 'text-red-400' : 'text-neutral-100'}`}>
                  {timerExpired ? "Time's up!" : todos.find((t) => t.id === activeTimerTodoId)?.title}
                </span>
                {!timerExpired && (
                  <div className="mt-1 h-1.5 bg-amber-500/20 rounded-full overflow-hidden w-40">
                    <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${timerProgressPercent}%` }} />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {timerExpired
                ? <><AlarmClock className="w-5 h-5 text-red-400 animate-bounce" /><span className="text-xl font-bold text-red-400">00:00</span></>
                : <span className="text-2xl font-mono font-bold text-amber-400 tabular-nums">{formatCountdown(timerSecondsLeft)}</span>
              }
              {timerExpired ? (
                <button onClick={handleStopTimer} className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white">
                  <RotateCcw className="w-5 h-5" />
                </button>
              ) : timerPaused ? (
                <div className="flex items-center gap-2">
                  <button onClick={handleResumeTimer} className="p-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-900">
                    <Play className="w-5 h-5" />
                  </button>
                  <button onClick={handleStopTimer} className="p-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-300">
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={handlePauseTimer} className="p-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-900">
                    <Pause className="w-5 h-5" />
                  </button>
                  <button onClick={handleStopTimer} className="p-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-300">
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && todos.length === 0 && categories.length === 0 && (
        <div className="text-center py-12">
          <div className="glass-surface rounded-2xl p-12 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckSquare className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-100 mb-2">No to-dos yet</h3>
            <p className="text-neutral-400 mb-6">Add to-dos or create categories to organize your work</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowTodoForm(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-900 font-medium transition text-sm">
                <Plus className="w-4 h-4" /> Add To-Do
              </button>
              <button onClick={() => setShowCategoryForm(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-neutral-300 font-medium transition text-sm">
                <Plus className="w-4 h-4" /> New Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Categorized DnD board ── */}
      {(todos.length > 0 || categories.length > 0) && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-4">
            {/* Category swimlanes */}
            {categories.map((cat) => {
              const catTodos = todosForCategory(cat.id);
              return (
                <div key={cat.id} className="rounded-xl border border-neutral-800">
                  {/* Category header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-neutral-900 border-b border-neutral-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <CategoryNameEditor category={cat} onRename={handleRenameCategory} />
                      <span className="text-xs text-neutral-600 font-medium">{catTodos.length}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(cat.id, cat.name)}
                      className="p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-900/20 transition"
                      title="Delete category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Droppable todo list */}
                  <Droppable droppableId={`cat-${cat.id}`}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`p-3 space-y-2 min-h-[48px] transition-colors ${snapshot.isDraggingOver ? 'bg-neutral-800/40' : 'bg-neutral-950/30'}`}
                      >
                        {catTodos.length === 0 && !snapshot.isDraggingOver && (
                          <p className="text-xs text-neutral-700 italic text-center py-2">Drop to-dos here</p>
                        )}
                        {catTodos.map((todo, idx) => renderTodoCard(todo, idx))}
                        {provided.placeholder}
                        <InlineAddTodo categoryId={cat.id} onAdd={handleAddTodo} />
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}

            {/* Uncategorized section */}
            {(() => {
              const uncatTodos = todosForCategory(null);
              if (uncatTodos.length === 0 && categories.length > 0) return null;
              return (
                <div className={`rounded-xl border border-neutral-800 ${categories.length === 0 ? '' : ''}`}>
                  {categories.length > 0 && (
                    <div className="flex items-center gap-2.5 px-4 py-3 bg-neutral-900 border-b border-neutral-800">
                      <div className="w-3 h-3 rounded-full bg-neutral-600 flex-shrink-0" />
                      <span className="text-sm font-semibold text-neutral-400">Uncategorized</span>
                      <span className="text-xs text-neutral-600">{uncatTodos.length}</span>
                    </div>
                  )}
                  <Droppable droppableId="uncategorized">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`p-3 space-y-2 min-h-[48px] transition-colors ${snapshot.isDraggingOver ? 'bg-neutral-800/40' : categories.length > 0 ? 'bg-neutral-950/30' : ''}`}
                      >
                        {uncatTodos.map((todo, idx) => renderTodoCard(todo, idx))}
                        {provided.placeholder}
                        {categories.length === 0 && (
                          <InlineAddTodo categoryId={null} onAdd={handleAddTodo} />
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })()}
          </div>
        </DragDropContext>
      )}

      {/* Completed section — outside DnD context intentionally */}
      {completedTodos.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between py-2">
            <button
              onClick={() => setShowCompleted((v) => !v)}
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-300 transition"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${showCompleted ? 'rotate-90' : ''}`} />
              Completed ({completedTodos.length})
            </button>
            <button onClick={handleClearCompleted} className="text-xs text-neutral-600 hover:text-red-400 transition">
              Clear all
            </button>
          </div>
          {showCompleted && (
            <div className="space-y-2">
              {completedTodos.map((todo, idx) => renderTodoCard(todo, idx, false))}
            </div>
          )}
        </div>
      )}

      {/* All incomplete done message */}
      {incompleteTodos.length === 0 && completedTodos.length > 0 && (
        <div className="flex items-center gap-2 py-4 text-sm text-neutral-500">
          <Check className="w-4 h-4 text-amber-500" />
          All caught up — nothing left to do!
        </div>
      )}
    </div>
  );
}
