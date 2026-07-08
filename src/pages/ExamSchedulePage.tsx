import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { toast } from '../lib/toast';
import { useConfirm } from '../hooks/useConfirm';
import {
  getExamWithDetails,
  updateTopicAssignment,
  updateAssignmentCompletion,
  updateTopicCompletion,
  batchUpdateAssignmentCompletion,
  batchUpdateTopicCompletion,
  updateTopic as updateTopicService,
  deleteTopic as deleteTopicService,
  createTopic as createTopicService,
  deleteAssignmentsOnDate,
  recalculateSchedule,
  resetSchedule,
  deleteExam,
} from '../lib/examService';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  MoreVertical,
  RotateCcw,
  RefreshCw,
  Trash2,
  Edit3,
  Undo2,
  Check,
  X,
  Calendar,
  Move,
  Clock,
  Target,
  BarChart3,
  Download,
  Plus,
} from 'lucide-react';
import { format, parseISO, differenceInDays, isBefore, startOfDay, addDays } from 'date-fns';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import type { Exam, Topic, DayWeight, ScheduledAssignment } from '../types/database';
import { TopicEditModal } from '../components/TopicEditModal';
import { ProgressRing } from '../components/ProgressRing';
import { StatusBadge, StatusDescription, type StatusType } from '../components/StatusBadge';
import { BurnDownChart } from '../components/BurnDownChart';
import { PhaseBreakdown } from '../components/PhaseBreakdown';
import { TodayPanel } from '../components/TodayPanel';
import { StreakBadge } from '../components/StreakBadge';
import { recordStudyActivity, getStreakData } from '../lib/streakService';
import { exportToICal } from '../lib/icalExport';
import { SkeletonCard, SkeletonDayCard } from '../components/Skeleton';

interface ExamWithDetails {
  exam: Exam;
  topics: Topic[];
  dayWeights: DayWeight[];
  assignments: ScheduledAssignment[];
}

const EFFORT_COLORS: Record<number, string> = {
  1: 'bg-emerald-500',
  2: 'bg-blue-500',
  3: 'bg-amber-500',
  4: 'bg-orange-500',
  5: 'bg-red-500',
};

const EFFORT_LABELS: Record<number, string> = {
  1: 'Minimal',
  2: 'Light',
  3: 'Medium',
  4: 'Heavy',
  5: 'Very Heavy',
};

// ─── Module-level components (stable references, no re-mount on parent re-render) ───

interface TopicCardProps {
  assignment: ScheduledAssignment;
  topic: Topic;
  updating: string | null;
  isBulkMode: boolean;
  isSelected: boolean;
  isHovered: boolean;
  onToggle: (assignmentId: string, isCompleted: boolean) => void;
  onContextMenu: (e: React.MouseEvent, assignmentId: string) => void;
  onMouseEnter: (assignmentId: string) => void;
  onMouseLeave: () => void;
  onSelect: (assignmentId: string) => void;
  draggableIndex: number;
}

function TopicCard({
  assignment, topic, updating, isBulkMode,
  isSelected, isHovered, onToggle, onContextMenu,
  onMouseEnter, onMouseLeave, onSelect, draggableIndex,
}: TopicCardProps) {
  const wasMoved = assignment.assigned_date !== assignment.recommended_date;
  const isUpdating = updating === assignment.id;

  return (
    <Draggable draggableId={`assignment-${assignment.id}`} index={draggableIndex}>
      {(provided, snapshot) => {
        const card = (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onContextMenu={(e) => onContextMenu(e, assignment.id)}
          onMouseEnter={() => onMouseEnter(assignment.id)}
          onMouseLeave={onMouseLeave}
          onClick={() => { if (isBulkMode) onSelect(assignment.id); }}
          className={`group relative flex items-start gap-2 p-2 rounded-lg transition cursor-pointer
            ${snapshot.isDragging ? 'shadow-lg bg-slate-700 scale-105' : ''}
            ${assignment.is_completed ? 'bg-slate-900/50' : 'hover:bg-slate-700/50'}
            ${isSelected ? 'ring-2 ring-amber-500 bg-amber-500/10' : ''}
          `}
        >
          {isBulkMode && (
            <div className="absolute -left-1 top-1/2 -translate-y-1/2">
              {isSelected ? (
                <CheckCircle className="w-5 h-5 text-amber-500" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
              )}
            </div>
          )}

          <div className="pt-0.5" onClick={(e) => { e.stopPropagation(); if (!isBulkMode) onToggle(assignment.id, assignment.is_completed); }}>
            {isUpdating ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : assignment.is_completed ? (
              <CheckCircle className="w-5 h-5 text-amber-500" />
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-slate-600 hover:border-amber-500 transition" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1">
              <span className={`text-sm font-medium leading-tight ${
                assignment.is_completed ? 'text-slate-500 line-through' : 'text-slate-100'
              }`}>
                {topic.title}
              </span>
              {topic.notes && (
                <span title={topic.notes} className="flex-shrink-0 mt-0.5">
                  <Edit3 className="w-3 h-3 text-blue-400 dark:text-blue-500" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <div className={`w-2 h-2 rounded-full ${EFFORT_COLORS[topic.estimated_effort]}`} />
              <span className="text-xs text-slate-400">{EFFORT_LABELS[topic.estimated_effort]}</span>
              {wasMoved && (
                <span className="flex items-center gap-1 text-xs text-amber-500 dark:text-amber-400">
                  <Move className="w-3 h-3" />
                  moved
                </span>
              )}
            </div>
          </div>

          {isHovered && wasMoved && (
            <div className="absolute left-0 right-0 -bottom-10 bg-slate-800 dark:bg-slate-900 text-white text-xs py-1.5 px-2 rounded shadow-lg z-10">
              Originally: {format(parseISO(assignment.recommended_date), 'EEE, MMM d')}
            </div>
          )}
        </div>
        );
        return snapshot.isDragging ? createPortal(card, document.body) : card;
      }}
    </Draggable>
  );
}

interface DayCardProps {
  date: string;
  assignments: ScheduledAssignment[];
  isRevision: boolean;
  topics: Topic[];
  updating: string | null;
  isBulkMode: boolean;
  selectedAssignments: Set<string>;
  hoveredAssignment: string | null;
  onToggle: (assignmentId: string, isCompleted: boolean) => void;
  onContextMenu: (e: React.MouseEvent, assignmentId: string) => void;
  onMouseEnter: (assignmentId: string) => void;
  onMouseLeave: () => void;
  onSelect: (assignmentId: string) => void;
  onDeleteTile: (date: string, phase: 'learning' | 'revision') => void;
}

function DayCard({
  date, assignments, isRevision, topics, updating, isBulkMode,
  selectedAssignments, hoveredAssignment, onToggle, onContextMenu,
  onMouseEnter, onMouseLeave, onSelect, onDeleteTile,
}: DayCardProps) {
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const completedCount = assignments.filter((a) => a.is_completed).length;
  const dateObj = parseISO(date);
  const isToday = format(new Date(), 'yyyy-MM-dd') === date;
  const isPast = isBefore(dateObj, startOfDay(new Date()));
  const phase = isRevision ? 'revision' : 'learning';

  return (
    <Droppable droppableId={`${phase}-${date}`}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`glass-surface rounded-xl ${
            isToday ? '!border-amber-500 ring-2 ring-amber-500/20'
            : snapshot.isDraggingOver ? '!border-blue-400 ring-2 ring-blue-400/30'
            : ''
          } ${isPast ? 'opacity-60' : ''} p-4 transition-all hover:-translate-y-0.5 ${snapshot.isDraggingOver ? 'shadow-lg' : ''}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium text-slate-100">
                {format(dateObj, 'EEE, MMM d')}
              </div>
              {isToday && <span className="text-xs text-amber-400 font-medium">Today</span>}
              {isPast && !isToday && <span className="text-xs text-red-500 font-medium">Past</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                isRevision
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-blue-500/10 text-blue-400'
              }`}>
                {isRevision ? 'Revision' : 'Learning'}
              </span>
              <button
                onClick={() => onDeleteTile(date, phase)}
                title="Delete this date tile"
                className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-2 min-h-[40px]">
            {assignments.map((assignment, idx) => {
              const topic = topicMap.get(assignment.topic_id);
              if (!topic) return null;
              return (
                <TopicCard
                  key={assignment.id}
                  assignment={assignment}
                  topic={topic}
                  updating={updating}
                  isBulkMode={isBulkMode}
                  isSelected={selectedAssignments.has(assignment.id)}
                  isHovered={hoveredAssignment === assignment.id}
                  onToggle={onToggle}
                  onContextMenu={onContextMenu}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  onSelect={onSelect}
                  draggableIndex={idx}
                />
              );
            })}
            {assignments.length === 0 && (
              <div className="text-xs text-slate-500 italic py-2 text-center">
                No topics assigned
              </div>
            )}
            {provided.placeholder}
          </div>

          {assignments.length > 0 && (
            <div className="mt-3 pt-2 border-t border-white/[0.08]">
              <div className="text-xs text-slate-400">
                {completedCount} / {assignments.length} completed
              </div>
              <div className="mt-1.5 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${assignments.length > 0 ? (completedCount / assignments.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </Droppable>
  );
}

export function ExamSchedulePage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { confirm, ConfirmNode } = useConfirm();
  const [data, setData] = useState<ExamWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    assignmentId: string;
    x: number;
    y: number;
  } | null>(null);
  const [hoveredAssignment, setHoveredAssignment] = useState<string | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  // Tracks which date tiles are visible per phase; persists even when assignments are dragged away
  const [activeSlots, setActiveSlots] = useState<{ learning: Set<string>; revision: Set<string> }>({
    learning: new Set(),
    revision: new Set(),
  });
  const [scheduleBehind, setScheduleBehind] = useState(false);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [addTopicTitle, setAddTopicTitle] = useState('');
  const [addTopicEffort, setAddTopicEffort] = useState(3);
  const [addingTopic, setAddingTopic] = useState(false);

  useEffect(() => {
    if (examId) {
      loadExam(examId);
    }
    loadStreaks();
  }, [examId]);

  // Whenever assignments change, add any new dates to activeSlots (never removes, only adds)
  useEffect(() => {
    if (!data) return;
    setActiveSlots((prev) => {
      const learning = new Set(prev.learning);
      const revision = new Set(prev.revision);
      data.assignments.forEach((a) => {
        if (a.phase === 'learning') learning.add(a.assigned_date);
        else revision.add(a.assigned_date);
      });
      return { learning, revision };
    });
  }, [data]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const loadExam = async (id: string) => {
    try {
      setLoading(true);
      let result = await getExamWithDetails(id);

      // Auto-recalculate only when incomplete topics have no assignment yet
      // Stale past assignments show an orange banner instead — preserving user intent
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const completedTopicIds = new Set(result.topics.filter((t) => t.is_completed).map((t) => t.id));
      const assignedTopicIds = new Set(result.assignments.map((a) => a.topic_id));
      const incompleteTopicIds = result.topics.filter((t) => !t.is_completed).map((t) => t.id);
      const hasStalePastAssignment = result.assignments.some(
        (a) => a.assigned_date < todayStr && !completedTopicIds.has(a.topic_id)
      );
      const hasUnassignedIncomplete = incompleteTopicIds.some((id) => !assignedTopicIds.has(id));
      if (hasUnassignedIncomplete) {
        await recalculateSchedule(id);
        result = await getExamWithDetails(id);
      }
      setScheduleBehind(hasStalePastAssignment && !hasUnassignedIncomplete);

      setData(result);
      setError(null);
    } catch (err) {
      console.error('Failed to load exam:', err);
      setError('Failed to load study plan');
    } finally {
      setLoading(false);
    }
  };

  const loadStreaks = async () => {
    try {
      const streakData = await getStreakData();
      setCurrentStreak(streakData.currentStreak);
      setLongestStreak(streakData.longestStreak);
    } catch (err) {
      console.error('Failed to load streaks:', err);
    }
  };

  const handleToggleComplete = async (assignmentId: string, currentStatus: boolean) => {
    if (!data) return;
    setUpdating(assignmentId);
    try {
      const newStatus = !currentStatus;
      const updatedAssignment = await updateAssignmentCompletion(assignmentId, newStatus);
      const updatedAssignments = data.assignments.map((a) =>
        a.id === assignmentId ? updatedAssignment : a
      );

      // For learning assignments, keep topic.is_completed in sync so confetti fires
      // and scheduling correctly treats the topic as done
      let updatedTopics = data.topics;
      const toggled = data.assignments.find((a) => a.id === assignmentId);
      if (toggled?.phase === 'learning') {
        const updatedTopic = await updateTopicCompletion(toggled.topic_id, newStatus);
        updatedTopics = data.topics.map((t) => t.id === toggled.topic_id ? updatedTopic : t);
      }

      setData({ ...data, assignments: updatedAssignments, topics: updatedTopics });

      // Sync today's completed count for streak tracking
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const completedToday = updatedAssignments.filter(
        (a) => a.is_completed && a.completed_at &&
          format(parseISO(a.completed_at), 'yyyy-MM-dd') === todayStr
      ).length;
      await recordStudyActivity(completedToday);
      await loadStreaks();
    } catch (err) {
      console.error('Failed to update assignment:', err);
    } finally {
      setUpdating(null);
    }
  };

  // Drag and drop handler
  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!data || !result.destination) return;

      const { draggableId, source, destination } = result;
      const assignmentId = draggableId.replace('assignment-', '');

      // droppableId: "learning-2026-06-11" — split on first "-" only to preserve date
      const parseDroppable = (id: string) => {
        const idx = id.indexOf('-');
        return { phase: id.slice(0, idx), date: id.slice(idx + 1) };
      };
      const src = parseDroppable(source.droppableId);
      const dest = parseDroppable(destination.droppableId);

      // Silently block cross-phase drops
      if (src.phase !== dest.phase) return;

      // Silently block drops onto past dates
      if (isBefore(parseISO(dest.date), startOfDay(new Date()))) return;

      // Find assignment
      const assignment = data.assignments.find((a) => a.id === assignmentId);
      if (!assignment || assignment.assigned_date === dest.date) return;

      setUpdating(assignmentId);
      try {
        await updateTopicAssignment(assignment.id, dest.date);

        // Ensure dest date has a tile slot
        setActiveSlots((prev) => {
          const phaseKey = dest.phase as 'learning' | 'revision';
          const updated = new Set(prev[phaseKey]);
          updated.add(dest.date);
          return { ...prev, [phaseKey]: updated };
        });

        setData({
          ...data,
          assignments: data.assignments.map((a) =>
            a.id === assignmentId
              ? { ...a, assigned_date: dest.date, updated_at: new Date().toISOString() }
              : a
          ),
        });
      } catch (err) {
        console.error('Failed to move topic:', err);
      } finally {
        setUpdating(null);
      }
    },
    [data]
  );

  const handleDeleteTile = async (date: string, phase: 'learning' | 'revision') => {
    if (!examId || !data) return;
    const ok = await confirm({ message: `Delete the ${date} ${phase} tile? Topics on it will be unscheduled.`, confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteAssignmentsOnDate(examId, date, phase);
      setActiveSlots((prev) => {
        const updated = new Set(prev[phase]);
        updated.delete(date);
        return { ...prev, [phase]: updated };
      });
      setData({
        ...data,
        assignments: data.assignments.filter(
          (a) => !(a.assigned_date === date && a.phase === phase)
        ),
      });
      toast.success('Tile deleted');
    } catch (err) {
      console.error('Failed to delete tile:', err);
      toast.error('Failed to delete tile');
    }
  };

  const handleRestoreTopic = async (assignmentId: string) => {
    const assignment = data?.assignments.find((a) => a.id === assignmentId);
    if (!assignment || assignment.assigned_date === assignment.recommended_date) return;

    setUpdating(assignmentId);
    try {
      await updateTopicAssignment(assignment.id, assignment.recommended_date);
      setData({
        ...data!,
        assignments: data!.assignments.map((a) =>
          a.id === assignmentId
            ? { ...a, assigned_date: assignment.recommended_date }
            : a
        ),
      });
    } catch (err) {
      console.error('Failed to restore topic:', err);
    } finally {
      setUpdating(null);
    }
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, assignmentId: string) => {
    e.preventDefault();
    setContextMenu({ assignmentId, x: e.clientX, y: e.clientY });
  };

  const handleRecalculate = async () => {
    if (!examId) return;
    const ok = await confirm({ message: 'Recalculate schedule? This will redistribute all incomplete topics.', confirmLabel: 'Recalculate', danger: false });
    if (!ok) return;
    try {
      setLoading(true);
      await recalculateSchedule(examId);
      await loadExam(examId);
      toast.success('Schedule recalculated');
    } catch (err) {
      console.error('Failed to recalculate:', err);
      toast.error('Failed to recalculate schedule');
      setError('Failed to recalculate schedule');
    }
  };

  const handleReset = async () => {
    if (!examId) return;
    const ok = await confirm({ message: 'Reset all progress? All topics will be marked incomplete and the schedule will be rebuilt.', confirmLabel: 'Reset' });
    if (!ok) return;
    try {
      setLoading(true);
      await resetSchedule(examId);
      await loadExam(examId);
      toast.success('Progress reset');
    } catch (err) {
      console.error('Failed to reset:', err);
      toast.error('Failed to reset schedule');
      setError('Failed to reset schedule');
    }
  };

  const handleDelete = async () => {
    if (!examId || !data) return;
    const ok = await confirm({ message: `Delete "${data.exam.name}"? This cannot be undone.`, confirmLabel: 'Delete Plan' });
    if (!ok) return;
    try {
      await deleteExam(examId);
      toast.success('Study plan deleted');
      navigate('/');
    } catch (err) {
      console.error('Failed to delete:', err);
      toast.error('Failed to delete study plan');
      setError('Failed to delete study plan');
    }
  };

  const handleTopicUpdate = async (topicId: string, updates: { title: string; estimatedEffort: number; notes: string }) => {
    if (!data) return;
    try {
      const updated = await updateTopicService(topicId, updates);
      setData({
        ...data,
        topics: data.topics.map((t) => (t.id === topicId ? updated : t)),
      });
      toast.success('Topic updated');
    } catch (err) {
      console.error('Failed to update topic:', err);
      toast.error('Failed to update topic');
    }
    setEditingTopic(null);
  };

  const handleTopicDelete = async (topicId: string) => {
    if (!data) return;
    const ok = await confirm({ message: 'Delete this topic? All its assignments will also be removed.', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteTopicService(topicId);
      setData({
        ...data,
        topics: data.topics.filter((t) => t.id !== topicId),
        assignments: data.assignments.filter((a) => a.topic_id !== topicId),
      });
      toast.success('Topic deleted');
    } catch (err) {
      console.error('Failed to delete topic:', err);
      toast.error('Failed to delete topic');
    }
    setEditingTopic(null);
  };

  const handleAddTopic = async () => {
    if (!examId || !addTopicTitle.trim()) return;
    setAddingTopic(true);
    try {
      await createTopicService(examId, addTopicTitle.trim(), addTopicEffort);
      await recalculateSchedule(examId);
      await loadExam(examId);
      setAddTopicTitle('');
      setAddTopicEffort(3);
      setShowAddTopic(false);
      toast.success('Topic added and schedule updated');
    } catch (err) {
      console.error('Failed to add topic:', err);
      toast.error('Failed to add topic');
    } finally {
      setAddingTopic(false);
    }
  };

  const toggleAssignmentSelection = (assignmentId: string) => {
    const newSelected = new Set(selectedAssignments);
    if (newSelected.has(assignmentId)) {
      newSelected.delete(assignmentId);
    } else {
      newSelected.add(assignmentId);
    }
    setSelectedAssignments(newSelected);
  };

  const handleBulkComplete = async (complete: boolean) => {
    if (!data || selectedAssignments.size === 0) return;
    try {
      const ids = Array.from(selectedAssignments);
      await batchUpdateAssignmentCompletion(ids, complete);

      // Also sync topic.is_completed for any selected learning assignments
      const selectedLearningTopicIds = data.assignments
        .filter((a) => ids.includes(a.id) && a.phase === 'learning')
        .map((a) => a.topic_id);
      if (selectedLearningTopicIds.length > 0) {
        await batchUpdateTopicCompletion(selectedLearningTopicIds, complete);
      }

      const now = new Date().toISOString();
      const updatedTopicIds = new Set(selectedLearningTopicIds);
      setData({
        ...data,
        assignments: data.assignments.map((a) =>
          selectedAssignments.has(a.id)
            ? { ...a, is_completed: complete, completed_at: complete ? now : null }
            : a
        ),
        topics: data.topics.map((t) =>
          updatedTopicIds.has(t.id)
            ? { ...t, is_completed: complete, completed_at: complete ? now : null }
            : t
        ),
      });
      setSelectedAssignments(new Set());
      setIsBulkMode(false);
    } catch (err) {
      console.error('Failed to bulk update:', err);
    }
  };

  // Group assignments by (phase, date); use activeSlots so empty tiles persist after drags
  const dayCards = useMemo(() => {
    if (!data) return { learning: [] as { date: string; assignments: ScheduledAssignment[] }[], revision: [] as { date: string; assignments: ScheduledAssignment[] }[] };

    // Index assignments by phase+date key
    const byPhaseDate = new Map<string, ScheduledAssignment[]>();
    data.assignments.forEach((a) => {
      const key = `${a.phase}::${a.assigned_date}`;
      if (!byPhaseDate.has(key)) byPhaseDate.set(key, []);
      byPhaseDate.get(key)!.push(a);
    });

    const buildPhase = (phase: 'learning' | 'revision', slots: Set<string>) =>
      Array.from(slots)
        .sort()
        .map((date) => ({
          date,
          assignments: (byPhaseDate.get(`${phase}::${date}`) ?? []).sort(
            (a, b) => a.order_in_day - b.order_in_day
          ),
        }));

    return {
      learning: buildPhase('learning', activeSlots.learning),
      revision: buildPhase('revision', activeSlots.revision),
    };
  }, [data, activeSlots]);

  // These MUST be before any early returns to obey Rules of Hooks
  const assignmentCompletions = useMemo(() => {
    if (!data) return [];
    const completionsByDate = new Map<string, number>();
    data.assignments.forEach((a) => {
      if (a.is_completed && a.completed_at) {
        const date = format(parseISO(a.completed_at), 'yyyy-MM-dd');
        completionsByDate.set(date, (completionsByDate.get(date) || 0) + 1);
      }
    });
    return Array.from(completionsByDate.entries()).map(([date, count]) => ({ date, count }));
  }, [data]);

  const studyDaysLeft = useMemo(() => {
    if (!data) return 0;
    const weightMap = new Map<number, number>();
    data.dayWeights.forEach((w) => {
      if (w.weight > 0) weightMap.set(w.day_of_week, w.weight);
    });
    const today = startOfDay(new Date());
    const exam = startOfDay(new Date(data.exam.exam_date));
    let studyDays = 0;
    for (let d = new Date(today); isBefore(d, exam); d = addDays(d, 1)) {
      if (weightMap.has(d.getDay())) studyDays++;
    }
    return studyDays;
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="h-16 bg-slate-800 border-b border-slate-700" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => <SkeletonDayCard key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-400">{error || 'Study plan not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const learningOnly = data.assignments.filter((a) => a.phase === 'learning');
  const completedAssignments = data.assignments.filter((a) => a.is_completed).length;
  const totalAssignments = data.assignments.length;
  const progressPercentage = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;
  const daysRemaining = differenceInDays(new Date(data.exam.exam_date), new Date());
  const totalTopics = data.topics.length;

  // Calculate today's completed assignments
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const completedToday = data.assignments.filter(
    (a) => a.is_completed && a.completed_at && format(parseISO(a.completed_at), 'yyyy-MM-dd') === todayStr
  ).length;

  // Calculate phase stats (learningOnly already computed above)
  const revisionAssignments = data.assignments.filter((a) => a.phase === 'revision');

  const learningCompleted = learningOnly.filter((a) => a.is_completed).length;
  const learningTotal = learningOnly.length;
  const revisionCompleted = revisionAssignments.filter((a) => a.is_completed).length;
  const revisionTotal = revisionAssignments.length;

  // Calculate daily pace needed
  const assignmentsRemaining = totalAssignments - completedAssignments;
  const dailyPace = studyDaysLeft > 0 && assignmentsRemaining > 0
    ? Math.ceil(assignmentsRemaining / studyDaysLeft)
    : 0;

  // Schedule-based status: compare completed vs what was assigned by today
  const scheduledByToday = data.assignments.filter((a) => a.assigned_date <= todayStr).length;
  const scheduleDiff = completedAssignments - scheduledByToday;
  const status: StatusType = scheduleDiff >= 2 ? 'ahead' : scheduleDiff >= -1 ? 'on-track' : 'behind';



  return (
    <div className="min-h-screen page-enter">
      {ConfirmNode}

      {/* Add Topic Modal */}
      {showAddTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAddTopic(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md glass-surface rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-slate-100">Add Topic</h3>
              <button onClick={() => setShowAddTopic(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Topic title</label>
                <input
                  autoFocus
                  type="text"
                  value={addTopicTitle}
                  onChange={(e) => setAddTopicTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddTopic(); if (e.key === 'Escape') setShowAddTopic(false); }}
                  placeholder="e.g. Chapter 5 — Cell Biology"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-600 bg-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                  Effort — <span className="text-amber-400">{EFFORT_LABELS[addTopicEffort]}</span>
                </label>
                <div className="flex gap-2">
                  {([1, 2, 3, 4, 5] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => setAddTopicEffort(n)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition border ${
                        addTopicEffort === n
                          ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                          : 'border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between mt-1 px-0.5">
                  <span className="text-xs text-slate-500">Easy</span>
                  <span className="text-xs text-slate-500">Hard</span>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleAddTopic}
                  disabled={!addTopicTitle.trim() || addingTopic}
                  className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {addingTopic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Topic
                </button>
                <button
                  onClick={() => setShowAddTopic(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-700 text-slate-400 text-sm hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Header examName={data.exam.name} />

      {/* Context Menu */}
      {contextMenu && (() => {
        const assignment = data.assignments.find((a) => a.id === contextMenu.assignmentId);
        const topic = assignment ? data.topics.find((t) => t.id === assignment.topic_id) : null;
        const canRestore = assignment && assignment.assigned_date !== assignment.recommended_date;
        return (
          <div
            className="fixed z-50 glass-surface rounded-lg shadow-xl py-1 min-w-48"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { if (topic) setEditingTopic(topic); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition"
            >
              <Edit3 className="w-4 h-4" />
              Edit Topic
            </button>
            {canRestore && (
              <button
                onClick={() => handleRestoreTopic(contextMenu.assignmentId)}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition"
              >
                <Undo2 className="w-4 h-4" />
                Restore to {format(parseISO(assignment!.recommended_date), 'MMM d')}
              </button>
            )}
            <hr className="my-1 border-slate-700" />
            <button
              onClick={() => { if (topic) handleTopicDelete(topic.id); }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 transition"
            >
              <Trash2 className="w-4 h-4" />
              Delete Topic
            </button>
          </div>
        );
      })()}

      {/* Topic Edit Modal */}
      {editingTopic && (
        <TopicEditModal
          topic={editingTopic}
          assignment={data.assignments.find((a) => a.topic_id === editingTopic.id)!}
          onSave={handleTopicUpdate}
          onDelete={handleTopicDelete}
          onClose={() => setEditingTopic(null)}
        />
      )}

      {/* Sub-header with actions */}
      <div className="glass-banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-14 py-2 flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm">Back</span>
              </button>

              {/* Bulk mode toggle */}
              <button
                onClick={() => {
                  setIsBulkMode(!isBulkMode);
                  setSelectedAssignments(new Set());
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  isBulkMode
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Check className="w-4 h-4" />
                Bulk Select
              </button>

              {/* Add Topic */}
              <button
                onClick={() => setShowAddTopic(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-700 transition"
              >
                <Plus className="w-4 h-4" />
                Add Topic
              </button>

              {/* Bulk actions */}
              {isBulkMode && selectedAssignments.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-300">{selectedAssignments.size} selected</span>
                  <button
                    onClick={() => handleBulkComplete(true)}
                    className="px-3 py-1 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                  >
                    Mark Complete
                  </button>
                  <button
                    onClick={() => handleBulkComplete(false)}
                    className="px-3 py-1 text-sm bg-slate-600 text-white rounded-lg hover:bg-slate-700"
                  >
                    Mark Incomplete
                  </button>
                  <button
                    onClick={() => setSelectedAssignments(new Set())}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 mt-2 w-48 glass-surface rounded-lg shadow-lg z-20 py-1">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        exportToICal(data.exam, data.topics, data.assignments);
                        toast.success('Calendar exported');
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition"
                    >
                      <Download className="w-4 h-4" />
                      Export to iCal
                    </button>
                    <hr className="my-1 border-slate-700" />
                    <button
                      onClick={() => { setShowMenu(false); handleRecalculate(); }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Recalculate
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); handleReset(); }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset Progress
                    </button>
                    <hr className="my-1 border-slate-700" />
                    <button
                      onClick={() => { setShowMenu(false); handleDelete(); }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Plan
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Behind Banner */}
      {scheduleBehind && (
        <div className="bg-orange-900/20 border-b border-orange-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <p className="text-sm text-orange-300 font-medium">
                Your schedule has fallen behind — some topics are still assigned to past dates.
              </p>
            </div>
            <button
              onClick={() => {
                setScheduleBehind(false);
                handleRecalculate();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex-shrink-0 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Recalculate
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Today's Plan */}
        <div className="mb-8">
          <TodayPanel
            topics={data.topics}
            assignments={data.assignments}
            updating={updating}
            onToggle={handleToggleComplete}
          />
        </div>

        {/* Calendar Section */}
        <section className="mb-8">

        {/* Drag and Drop Calendar */}
        <DragDropContext onDragEnd={handleDragEnd}>
          {/* Learning Phase */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <h2 className="text-lg font-semibold text-slate-100">Learning Phase</h2>
              <span className="text-sm text-slate-400">({dayCards.learning.length} days)</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {dayCards.learning.map(({ date, assignments }) => (
                <DayCard
                  key={date}
                  date={date}
                  assignments={assignments}
                  isRevision={false}
                  topics={data.topics}
                  updating={updating}
                  isBulkMode={isBulkMode}
                  selectedAssignments={selectedAssignments}
                  hoveredAssignment={hoveredAssignment}
                  onToggle={handleToggleComplete}
                  onContextMenu={handleContextMenu}
                  onMouseEnter={(id) => setHoveredAssignment(id)}
                  onMouseLeave={() => setHoveredAssignment(null)}
                  onSelect={toggleAssignmentSelection}
                  onDeleteTile={handleDeleteTile}
                />
              ))}
            </div>
          </div>

          {/* Phase Divider */}
          {dayCards.revision.length > 0 && (
            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
              <div className="flex items-center gap-2 text-slate-400">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Revision Phase Starts</span>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
            </div>
          )}

          {/* Revision Phase */}
          {dayCards.revision.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <h2 className="text-lg font-semibold text-slate-100">Revision Phase</h2>
                <span className="text-sm text-slate-400">({dayCards.revision.length} days)</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {dayCards.revision.map(({ date, assignments }) => (
                  <DayCard
                    key={date}
                    date={date}
                    assignments={assignments}
                    isRevision={true}
                    topics={data.topics}
                    updating={updating}
                    isBulkMode={isBulkMode}
                    selectedAssignments={selectedAssignments}
                    hoveredAssignment={hoveredAssignment}
                    onToggle={handleToggleComplete}
                    onContextMenu={handleContextMenu}
                    onMouseEnter={(id) => setHoveredAssignment(id)}
                    onMouseLeave={() => setHoveredAssignment(null)}
                    onSelect={toggleAssignmentSelection}
                    onDeleteTile={handleDeleteTile}
                  />
                ))}
              </div>
            </div>
          )}
        </DragDropContext>
        </section>

        {/* Dashboard Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-100">Progress Dashboard</h2>
            </div>
            <StreakBadge currentStreak={currentStreak} longestStreak={longestStreak} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3 mb-6">
            {/* Progress Ring & Status Card */}
            <div className="glass-surface rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <StatusBadge status={status} />
                  <div className="mt-2">
                    <StatusDescription status={status} />
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Target className="w-4 h-4" />
                      <span>{completedAssignments} / {totalAssignments} tasks done</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <Calendar className="w-4 h-4" />
                      <span>{daysRemaining} days left</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <Clock className="w-4 h-4" />
                      <span>~{dailyPace} topics/day needed</span>
                    </div>
                  </div>
                </div>
                <ProgressRing
                  percentage={progressPercentage}
                  size={110}
                  strokeWidth={8}
                />
              </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-2 gap-4 lg:col-span-2">
              <div className="glass-surface rounded-xl p-4">
                <div className="text-sm text-slate-400 font-medium mb-1">Completed Today</div>
                <div className="text-3xl font-bold text-amber-400">{completedToday}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {completedToday > 0 ? 'Great progress!' : 'Start checking off topics!'}
                </div>
              </div>
              <div className="glass-surface rounded-xl p-4">
                <div className="text-sm text-slate-400 font-medium mb-1">Learning Progress</div>
                <div className="text-3xl font-bold text-blue-400">
                  {learningTotal > 0 ? Math.round((learningCompleted / learningTotal) * 100) : 0}%
                </div>
                <div className="text-xs text-slate-400 mt-1">{learningCompleted} / {learningTotal} topics</div>
              </div>
              <div className="glass-surface rounded-xl p-4">
                <div className="text-sm text-slate-400 font-medium mb-1">Study Days Left</div>
                <div className="text-3xl font-bold text-violet-400">{studyDaysLeft}</div>
                <div className="text-xs text-slate-400 mt-1">with your schedule</div>
              </div>
              <div className="glass-surface rounded-xl p-4">
                <div className="text-sm text-slate-400 font-medium mb-1">Revision Progress</div>
                <div className="text-3xl font-bold text-amber-500">
                  {revisionTotal > 0 ? Math.round((revisionCompleted / revisionTotal) * 100) : 0}%
                </div>
                <div className="text-xs text-slate-400 mt-1">{revisionCompleted} / {revisionTotal} topics</div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Burn-Down Chart */}
            <div className="glass-surface rounded-xl p-6">
              <h3 className="text-sm font-semibold text-slate-100 mb-4">
                Progress Over Time
              </h3>
              <BurnDownChart
                examDate={data.exam.exam_date}
                createdAt={data.exam.created_at}
                totalTopics={totalTopics}
                completions={assignmentCompletions}
              />
            </div>

            {/* Phase Breakdown */}
            <div className="glass-surface rounded-xl p-6">
              <h3 className="text-sm font-semibold text-slate-100 mb-4">
                Phase Breakdown
              </h3>
              <PhaseBreakdown
                learningCompleted={learningCompleted}
                learningTotal={learningTotal}
                revisionCompleted={revisionCompleted}
                revisionTotal={revisionTotal}
                unassigned={0}
              />
            </div>
          </div>

        </section>

        {/* Empty state hint */}
        {dayCards.learning.length === 0 && dayCards.revision.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No topics scheduled yet</p>
          </div>
        )}
      </main>
    </div>
  );
}


