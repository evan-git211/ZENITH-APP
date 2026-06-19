import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { TodoTab } from '../components/TodoTab';
import {
  Plus, Calendar, CheckSquare, Flag, BookOpen, Clock,
  Trash2, Loader2, Check, X, Pencil,
} from 'lucide-react';
import { getExamsWithProgress, deleteExam, renameExam, type ExamProgress } from '../lib/examService';
import { getMilestones, createMilestone, deleteMilestone, type Milestone } from '../lib/milestoneService';
import { getTodayTopicsCompleted } from '../lib/streakService';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(displayName: string | undefined, email: string | undefined): string {
  if (displayName?.trim()) return displayName.trim().split(/\s+/)[0];
  const prefix = email?.split('@')[0] ?? '';
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

type Tab = 'plans' | 'todos' | 'milestones';

export function HomePage() {
  const { user } = useAuth();
  const { dailyGoal, fmtDate } = usePreferences();
  const [activeTab, setActiveTab] = useState<Tab>('plans');
  const [exams, setExams] = useState<ExamProgress[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [todayCompleted, setTodayCompleted] = useState(0);
  const navigate = useNavigate();

  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);

  useEffect(() => {
    loadExams();
    loadMilestones();
    getTodayTopicsCompleted().then(setTodayCompleted).catch(() => {});
  }, []);

  const loadExams = async () => {
    try {
      setLoading(true);
      const data = await getExamsWithProgress();
      setExams(data);
    } catch (err) {
      console.error('Failed to load exams:', err);
      setError('Failed to load study plans.');
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

  const startRename = (e: React.MouseEvent, examId: string, currentName: string) => {
    e.stopPropagation();
    setRenamingId(examId);
    setRenameValue(currentName);
  };

  const commitRename = async (examId: string) => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== exams.find(e => e.exam.id === examId)?.exam.name) {
      try {
        await renameExam(examId, trimmed);
        setExams(prev =>
          prev.map(e => e.exam.id === examId ? { ...e, exam: { ...e.exam, name: trimmed } } : e)
        );
      } catch {
        setError('Failed to rename study plan.');
      }
    }
    setRenamingId(null);
  };

  const handleDeleteExam = async (examId: string, examName: string) => {
    if (!confirm(`Delete "${examName}"? This cannot be undone.`)) return;
    try {
      setDeletingId(examId);
      await deleteExam(examId);
      setExams((prev) => prev.filter((e) => e.exam.id !== examId));
    } catch (err) {
      console.error('Failed to delete exam:', err);
      setError('Failed to delete study plan');
    } finally {
      setDeletingId(null);
    }
  };

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

  const firstName = getFirstName(
    user?.user_metadata?.display_name as string | undefined,
    user?.email
  );

  const upcomingExams = exams
    .filter(({ exam }) => differenceInCalendarDays(new Date(exam.exam_date), new Date()) >= 0)
    .sort((a, b) =>
      differenceInCalendarDays(new Date(a.exam.exam_date), new Date()) -
      differenceInCalendarDays(new Date(b.exam.exam_date), new Date())
    );

  const closestExam = upcomingExams[0];
  const daysToClosest = closestExam
    ? differenceInCalendarDays(new Date(closestExam.exam.exam_date), new Date())
    : null;

  let contextLine: string;
  if (loading) {
    contextLine = '';
  } else if (upcomingExams.length === 0) {
    contextLine = "No upcoming exams — ready to create your first study plan?";
  } else if (daysToClosest === 0) {
    contextLine = `Today is exam day for ${closestExam.exam.name}. Good luck!`;
  } else {
    const plural = upcomingExams.length === 1 ? '1 upcoming exam' : `${upcomingExams.length} upcoming exams`;
    contextLine = `You have ${plural}. Your closest is ${closestExam.exam.name} in ${daysToClosest}d.`;
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <Header />

      {/* Greeting banner */}
      <div className="bg-neutral-950 border-b border-neutral-800/60 px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-lg font-semibold text-white">
            {getGreeting()}, {firstName}!
          </p>
          {contextLine && (
            <p className="text-sm text-neutral-400 mt-0.5">{contextLine}</p>
          )}
          {dailyGoal > 0 && (
            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1 max-w-xs h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (todayCompleted / dailyGoal) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-neutral-500">
                <span className={todayCompleted >= dailyGoal ? 'text-amber-400 font-semibold' : 'text-neutral-300'}>
                  {todayCompleted}
                </span>
                /{dailyGoal} topics today
                {todayCompleted >= dailyGoal && ' ✓'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-neutral-900 border-b border-neutral-800">
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
                      ? 'border-amber-500 text-amber-500'
                      : 'border-transparent text-neutral-400 hover:text-neutral-200'
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-900/20 border border-red-800">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* ── Study Plans Tab ── */}
        {activeTab === 'plans' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Your Study Plans</h2>
              <button
                onClick={() => navigate('/new')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold transition"
              >
                <Plus className="w-5 h-5" />
                New Plan
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              </div>
            ) : exams.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-12 max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-amber-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">No study plans yet</h3>
                  <p className="text-neutral-400 mb-6">Create your first study plan and start preparing for your exams</p>
                  <button
                    onClick={() => navigate('/new')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold transition"
                  >
                    <Plus className="w-5 h-5" />
                    Create Study Plan
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {exams.map(({ exam, totalAssignments, completedAssignments, currentPhase, progressPercent, revisionTotal, revisionCompleted, revisionPercent }) => {
                  const daysRemaining = differenceInCalendarDays(new Date(exam.exam_date), new Date());
                  const isPast = daysRemaining < 0;
                  const remaining = totalAssignments - completedAssignments;

                  const totalDays = differenceInCalendarDays(new Date(exam.exam_date), new Date(exam.created_at));
                  const daysElapsed = differenceInCalendarDays(new Date(), new Date(exam.created_at));
                  const expectedPercent = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
                  const diff = progressPercent - expectedPercent;
                  const statusColor = isPast || currentPhase === 'complete'
                    ? 'text-neutral-500'
                    : diff >= -5 ? 'text-emerald-400'
                    : diff >= -15 ? 'text-amber-400'
                    : 'text-red-400';
                  const statusLabel = currentPhase === 'complete'
                    ? 'Complete'
                    : isPast ? 'Past due'
                    : diff >= -5 ? 'On track'
                    : diff >= -15 ? 'Slightly behind'
                    : 'Behind';

                  return (
                    <div
                      key={exam.id}
                      className={`bg-neutral-900 rounded-xl border border-neutral-800 hover:shadow-lg hover:shadow-black/40 transition cursor-pointer group flex flex-col ${isPast && currentPhase !== 'complete' ? 'opacity-60' : ''}`}
                      onClick={() => navigate(`/exam/${exam.id}`)}
                    >
                      <div className="p-5 flex-1">
                        <div className="flex items-start justify-between mb-3 gap-2">
                          {renamingId === exam.id ? (
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onBlur={() => commitRename(exam.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') commitRename(exam.id);
                                if (e.key === 'Escape') setRenamingId(null);
                              }}
                              onClick={e => e.stopPropagation()}
                              className="flex-1 text-sm font-semibold bg-neutral-800 text-white rounded-md px-2 py-1 border border-amber-500 outline-none focus:ring-1 focus:ring-amber-500 min-w-0"
                            />
                          ) : (
                            <h3 className="font-semibold text-white line-clamp-2 leading-snug">{exam.name}</h3>
                          )}
                          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={(e) => startRename(e, exam.id, exam.name)}
                              className="p-1.5 rounded-lg text-neutral-500 hover:text-amber-400 hover:bg-amber-500/10 transition"
                              title="Rename"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteExam(exam.id, exam.name); }}
                              disabled={deletingId === exam.id}
                              className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-900/20 transition disabled:opacity-50"
                            >
                              {deletingId === exam.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-sm mb-4 flex-wrap">
                          <div className="flex items-center gap-1.5 text-neutral-400">
                            <Calendar className="w-3.5 h-3.5" />
                            {fmtDate(exam.exam_date)}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-neutral-500" />
                            {isPast
                              ? <span className="text-red-400">Past due</span>
                              : daysRemaining === 0
                              ? <span className="text-amber-500">Today!</span>
                              : <span className="text-neutral-400">{daysRemaining}d left</span>}
                          </div>
                        </div>

                        <div className="flex items-end justify-between mb-3">
                          <div>
                            <span className="text-2xl font-bold text-white tabular-nums">{progressPercent}%</span>
                            <span className="text-xs text-neutral-500 ml-1.5">
                              {completedAssignments}/{totalAssignments} learned
                            </span>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
                            {currentPhase !== 'complete' && remaining > 0 && (
                              <p className="text-xs text-neutral-600">{remaining} remaining</p>
                            )}
                          </div>
                        </div>

                        {/* Learning phase bar */}
                        <div className="mb-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-neutral-500">Learning</span>
                            <span className="text-xs text-neutral-500">{completedAssignments}/{totalAssignments}</span>
                          </div>
                          <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${currentPhase === 'complete' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Revision phase bar — only if revision assignments exist */}
                        {revisionTotal > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-neutral-500">Revision</span>
                              <span className="text-xs text-neutral-500">{revisionCompleted}/{revisionTotal}</span>
                            </div>
                            <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all bg-blue-500"
                                style={{ width: `${revisionPercent}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="px-5 py-2.5 border-t border-neutral-800 flex items-center justify-between">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          currentPhase === 'complete' ? 'bg-emerald-500/10 text-emerald-400'
                          : currentPhase === 'revision' ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-orange-900/30 text-orange-400'
                        }`}>
                          {currentPhase === 'complete' ? 'Complete' : currentPhase === 'revision' ? 'Revision phase' : 'Learning phase'}
                        </span>
                        <BookOpen className="w-3.5 h-3.5 text-neutral-600" />
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
              <h2 className="text-xl font-semibold text-white">Milestones</h2>
              <button
                onClick={() => setShowMilestoneForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold transition"
              >
                <Plus className="w-5 h-5" />
                Add Milestone
              </button>
            </div>

            {showMilestoneForm && (
              <div className="mb-4 p-4 rounded-xl bg-neutral-900 border border-neutral-800">
                <div className="flex gap-3 flex-wrap">
                  <input
                    type="text"
                    value={newMilestoneTitle}
                    onChange={(e) => setNewMilestoneTitle(e.target.value)}
                    placeholder="Milestone name"
                    className="flex-1 min-w-48 px-4 py-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-neutral-600"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddMilestone(); if (e.key === 'Escape') setShowMilestoneForm(false); }}
                  />
                  <input
                    type="date"
                    value={newMilestoneDate}
                    onChange={(e) => setNewMilestoneDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="px-4 py-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white"
                  />
                  <button onClick={handleAddMilestone} className="px-4 py-2 rounded-lg bg-amber-500 text-neutral-900 font-semibold hover:bg-amber-400 transition">
                    <Check className="w-5 h-5" />
                  </button>
                  <button onClick={() => setShowMilestoneForm(false)} className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {milestones.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-12 max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                    <Flag className="w-8 h-8 text-amber-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">No milestones yet</h3>
                  <p className="text-neutral-400 mb-6">Track important dates and countdowns</p>
                  <button onClick={() => setShowMilestoneForm(true)} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold transition">
                    <Plus className="w-5 h-5" />
                    Add Milestone
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {milestones.map((milestone) => {
                  const daysLeft = differenceInCalendarDays(parseISO(milestone.target_date), new Date());
                  const isPast = daysLeft < 0;
                  const isToday = daysLeft === 0;
                  const isSoon = !isPast && daysLeft <= 7;
                  return (
                    <div
                      key={milestone.id}
                      className={`bg-neutral-900 rounded-xl border p-5 group transition ${
                        isToday ? 'border-amber-500/50 shadow-md shadow-amber-900/20'
                        : isSoon ? 'border-orange-800'
                        : isPast ? 'border-neutral-800 opacity-60'
                        : 'border-neutral-800'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-white line-clamp-1">{milestone.title}</h3>
                        <button
                          onClick={() => handleDeleteMilestone(milestone.id)}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-bold tabular-nums ${
                          isPast ? 'text-neutral-500'
                          : isToday ? 'text-amber-500'
                          : isSoon ? 'text-orange-400'
                          : 'text-blue-400'
                        }`}>
                          {isPast ? Math.abs(daysLeft) : daysLeft}
                        </span>
                        <span className="text-sm text-neutral-400">
                          {isPast ? 'days ago' : isToday ? '— Today!' : 'days left'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-500">
                        {format(parseISO(milestone.target_date), 'MMMM d, yyyy')}
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
