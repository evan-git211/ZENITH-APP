import { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { toast } from '../lib/toast';
import { useConfirm } from '../hooks/useConfirm';
import { SkeletonExamCard } from '../components/Skeleton';
import {
  Plus, Calendar, CheckSquare, Flag, BookOpen, Clock, Trash2,
  Loader2, Check, X, Pencil,
  Trophy, Target,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getExamsWithProgress, deleteExam, renameExam, type ExamProgress } from '../lib/examService';
import { getMilestones, createMilestone, deleteMilestone, type Milestone } from '../lib/milestoneService';
import { TodoTab } from '../components/TodoTab';
import { getStreakData, getTodayTopicsCompleted } from '../lib/streakService';
import { format, differenceInDays, parseISO } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';

type Tab = 'plans' | 'todos' | 'milestones';

// ── Greeting helpers ──────────────────────────────────────────────────────
function getFirstName(displayName: string, email: string): string {
  const name = (displayName ?? '').trim();
  if (name) return name.split(/\s+/)[0];
  return email?.split('@')[0] ?? 'there';
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Status helpers ────────────────────────────────────────────────────────
function statusLabel(progress: ExamProgress) {
  const days = differenceInDays(new Date(progress.exam.exam_date), new Date());
  if (days < 0) return 'Past due';
  if (days === 0) return 'Exam today!';
  if (progress.currentPhase === 'complete') return 'Complete';
  if (progress.currentPhase === 'revision') return 'Revision';
  return `${days}d left`;
}

function statusColor(progress: ExamProgress) {
  const days = differenceInDays(new Date(progress.exam.exam_date), new Date());
  if (days < 0) return 'text-neutral-500';
  if (days === 0) return 'text-amber-400';
  if (progress.currentPhase === 'complete') return 'text-emerald-400';
  if (days <= 7) return 'text-orange-400';
  return 'text-neutral-400';
}

export function HomePage() {
  const { user } = useAuth();
  const { fmtDate, dailyGoal } = usePreferences();
  const navigate = useNavigate();
  const { confirm, ConfirmNode } = useConfirm();

  const [activeTab, setActiveTab] = useState<Tab>('plans');
  const [exams, setExams] = useState<ExamProgress[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [todayCompleted, setTodayCompleted] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Milestone form
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [examData, milestoneData, streakData, todayCount] = await Promise.all([
        getExamsWithProgress(),
        getMilestones(),
        getStreakData(),
        getTodayTopicsCompleted(),
      ]);
      setExams(examData);
      setMilestones(milestoneData);
      setCurrentStreak(streakData.currentStreak);
      setTodayCompleted(todayCount);
      setError(null);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load your data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExam = async (examId: string, examName: string) => {
    const ok = await confirm({ message: `Delete "${examName}"? This cannot be undone.`, confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      setDeletingId(examId);
      await deleteExam(examId);
      setExams(exams.filter(e => e.exam.id !== examId));
      toast.success('Study plan deleted');
    } catch {
      setError('Failed to delete study plan');
      toast.error('Failed to delete study plan');
    } finally {
      setDeletingId(null);
    }
  };

  const startRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const commitRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenamingId(null); return; }
    try {
      await renameExam(id, trimmed);
      setExams(prev => prev.map(p =>
        p.exam.id === id ? { ...p, exam: { ...p.exam, name: trimmed } } : p
      ));
      toast.success('Renamed');
    } catch { setError('Failed to rename'); toast.error('Failed to rename'); }
    setRenamingId(null);
  };

  const handleAddMilestone = async () => {
    if (!newMilestoneTitle.trim() || !newMilestoneDate) return;
    try {
      const m = await createMilestone(newMilestoneTitle.trim(), newMilestoneDate);
      setMilestones(prev => [...prev, m].sort((a, b) => a.target_date.localeCompare(b.target_date)));
      setNewMilestoneTitle(''); setNewMilestoneDate(''); setShowMilestoneForm(false);
      toast.success('Milestone created');
    } catch { setError('Failed to create milestone'); toast.error('Failed to create milestone'); }
  };

  const handleDeleteMilestone = async (id: string) => {
    const ok = await confirm({ message: 'Delete this milestone?', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteMilestone(id);
      setMilestones(prev => prev.filter(m => m.id !== id));
      toast.success('Milestone deleted');
    } catch {
      console.error('Failed to delete milestone');
      toast.error('Failed to delete milestone');
    }
  };

  const tabs = [
    { id: 'plans'      as const, label: 'Study Plans', icon: BookOpen    },
    { id: 'todos'      as const, label: 'To-Do List',  icon: CheckSquare },
    { id: 'milestones' as const, label: 'Milestones',  icon: Flag        },
  ];

  const firstName = getFirstName(user?.user_metadata?.display_name as string ?? '', user?.email ?? '');

  return (
    <div className="min-h-screen page-enter">
      {ConfirmNode}
      <Header />

      {/* ── Greeting banner ── */}
      <div className="glass-banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-neutral-100">
                {getGreeting()}, <span className="text-amber-400">{firstName}</span> 👋
              </h1>
              <p className="text-sm text-neutral-400 mt-0.5">
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
                {currentStreak > 0 && (
                  <span className="ml-2 text-amber-400 font-medium">🔥 {currentStreak}-day streak</span>
                )}
              </p>
            </div>
            {dailyGoal > 0 && (
              <div className="sm:text-right min-w-[180px]">
                <div className="flex items-center gap-2 justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs text-neutral-400 font-medium">Daily goal</span>
                  </div>
                  <span className="text-xs text-amber-400 font-bold tabular-nums">
                    {Math.min(todayCompleted, dailyGoal)} / {dailyGoal}
                  </span>
                </div>
                <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (todayCompleted / dailyGoal) * 100)}%` }}
                  />
                </div>
                {todayCompleted >= dailyGoal && (
                  <p className="text-xs text-amber-400 mt-1 font-medium">
                    <Trophy className="w-3 h-3 inline mr-1" />Goal reached!
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="glass-banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap border ${
                  activeTab === id
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'border-transparent text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-900/20 border border-red-800">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* ── Study Plans ── */}
        {activeTab === 'plans' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-neutral-100">Your Study Plans</h2>
              <button
                onClick={() => navigate('/new')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold text-sm transition"
              >
                <Plus className="w-4 h-4" />
                New Plan
              </button>
            </div>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => <SkeletonExamCard key={i} />)}
              </div>
            ) : exams.length === 0 ? (
              <div className="text-center py-16">
                <div className="glass-surface rounded-2xl p-12 max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-100 mb-2">No study plans yet</h3>
                  <p className="text-neutral-400 mb-6">Create your first study plan and start preparing.</p>
                  <button
                    onClick={() => navigate('/new')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold transition"
                  >
                    <Plus className="w-5 h-5" />
                    Create Study Plan
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {exams.map((ep) => {
                  const { exam } = ep;
                  const daysLeft = differenceInDays(new Date(exam.exam_date), new Date());
                  const isPast = daysLeft < 0;
                  return (
                    <div
                      key={exam.id}
                      className={`glass-surface rounded-2xl p-5 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group ${isPast ? 'opacity-50' : ''}`}
                      onClick={() => !renamingId && navigate(`/exam/${exam.id}`)}
                    >
                      {/* Title + actions */}
                      <div className="flex items-start justify-between mb-3 gap-2">
                        {renamingId === exam.id ? (
                          <input
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitRename(exam.id);
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            onBlur={() => commitRename(exam.id)}
                            autoFocus
                            onClick={e => e.stopPropagation()}
                            className="flex-1 px-2 py-1 rounded-lg bg-neutral-800 border border-amber-500 text-neutral-100 text-sm focus:outline-none"
                          />
                        ) : (
                          <h3 className="font-semibold text-neutral-100 line-clamp-1 flex-1">{exam.name}</h3>
                        )}
                        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={e => startRename(exam.id, exam.name, e)}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-amber-400 hover:bg-amber-500/10 transition"
                            title="Rename"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteExam(exam.id, exam.name); }}
                            disabled={deletingId === exam.id}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-900/20 transition disabled:opacity-50"
                          >
                            {deletingId === exam.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Exam date */}
                      <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-3">
                        <Calendar className="w-3.5 h-3.5" />
                        {fmtDate(exam.exam_date)}
                      </div>

                      {/* Learning progress bar */}
                      {ep.totalAssignments > 0 && (
                        <div className="mb-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-neutral-400">Learning</span>
                            <span className="text-xs font-medium text-neutral-400 tabular-nums">{ep.progressPercent}%</span>
                          </div>
                          <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${ep.progressPercent}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Revision progress bar — only when there are revision assignments */}
                      {ep.revisionTotal > 0 && (
                        <div className="mb-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-neutral-400">Revision</span>
                            <span className="text-xs font-medium text-neutral-400 tabular-nums">{ep.revisionPercent}%</span>
                          </div>
                          <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${ep.revisionPercent}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Status row */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-neutral-600" />
                          <span className={`text-xs font-medium ${statusColor(ep)}`}>{statusLabel(ep)}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          ep.currentPhase === 'complete'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : ep.currentPhase === 'revision'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-orange-900/30 text-orange-400'
                        }`}>
                          {ep.currentPhase === 'complete' ? '✓ Complete' : ep.currentPhase === 'revision' ? 'Revision' : 'Learning'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── To-Do Tab ── */}
        {activeTab === 'todos' && <TodoTab />}

        {/* ── Milestones Tab ── */}
        {activeTab === 'milestones' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-neutral-100">Milestones</h2>
              <button
                onClick={() => setShowMilestoneForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold text-sm transition"
              >
                <Plus className="w-4 h-4" />
                Add Milestone
              </button>
            </div>

            {showMilestoneForm && (
              <div className="mb-4 p-4 rounded-xl bg-slate-800 border border-neutral-800">
                <div className="flex gap-3 flex-wrap">
                  <input
                    type="text" value={newMilestoneTitle} onChange={e => setNewMilestoneTitle(e.target.value)}
                    placeholder="Milestone name"
                    className="flex-1 min-w-48 px-4 py-2 rounded-xl border border-neutral-700 bg-neutral-950 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-neutral-600"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleAddMilestone(); if (e.key === 'Escape') setShowMilestoneForm(false); }}
                  />
                  <input
                    type="date" value={newMilestoneDate} onChange={e => setNewMilestoneDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="px-4 py-2 rounded-xl border border-neutral-700 bg-neutral-950 text-neutral-100 focus:outline-none"
                  />
                  <button onClick={handleAddMilestone} className="px-4 py-2 rounded-xl bg-amber-500 text-neutral-900 hover:bg-amber-400 font-semibold transition">
                    <Check className="w-5 h-5" />
                  </button>
                  <button onClick={() => setShowMilestoneForm(false)} className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {milestones.length === 0 ? (
              <div className="text-center py-16">
                <div className="glass-surface rounded-2xl p-12 max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                    <Flag className="w-8 h-8 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-100 mb-2">No milestones yet</h3>
                  <p className="text-neutral-500 mb-6">Track important dates and countdowns.</p>
                  <button onClick={() => setShowMilestoneForm(true)} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold transition">
                    <Plus className="w-5 h-5" />
                    Add Milestone
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {milestones.map(milestone => {
                  const daysLeft = differenceInDays(parseISO(milestone.target_date), new Date());
                  const isPast = daysLeft < 0;
                  const isToday = daysLeft === 0;
                  const isSoon = !isPast && daysLeft <= 7;
                  return (
                    <div
                      key={milestone.id}
                      className={`bg-slate-800 rounded-2xl border p-5 group transition ${
                        isToday ? 'border-amber-500/50 shadow-amber-500/10 shadow-md'
                        : isSoon ? 'border-orange-700/50'
                        : isPast ? 'border-neutral-800 opacity-50'
                        : 'border-neutral-800'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-neutral-100 line-clamp-1">{milestone.title}</h3>
                        <button
                          onClick={() => handleDeleteMilestone(milestone.id)}
                          className="p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-bold tabular-nums ${
                          isPast ? 'text-neutral-600'
                          : isToday ? 'text-amber-400'
                          : isSoon ? 'text-orange-400'
                          : 'text-blue-400'
                        }`}>
                          {isPast ? Math.abs(daysLeft) : daysLeft}
                        </span>
                        <span className="text-sm text-neutral-500">
                          {isPast ? 'days ago' : isToday ? '— Today!' : 'days left'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-500">
                        {fmtDate(parseISO(milestone.target_date))}
                      </p>
                      {isSoon && !isPast && !isToday && (
                        <span className="mt-2 inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-orange-900/30 text-orange-400">
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
