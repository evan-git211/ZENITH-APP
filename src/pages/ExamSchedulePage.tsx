import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import {
  getExamWithDetails,
  updateTopicAssignment,
  updateAssignmentCompletion,
  updateTopicCompletion,
  batchUpdateAssignmentCompletion,
  batchUpdateTopicCompletion,
  updateTopic as updateTopicService,
  deleteTopic as deleteTopicService,
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
} from 'lucide-react';
import { format, parseISO, differenceInDays, differenceInCalendarDays, isBefore, startOfDay, addDays } from 'date-fns';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import type { Exam, Topic, DayWeight, ScheduledAssignment } from '../types/database';
import { TopicEditModal } from '../components/TopicEditModal';
import { ProgressRing } from '../components/ProgressRing';
import { StatusBadge, calculateStatus, StatusDescription } from '../components/StatusBadge';
import { BurnDownChart } from '../components/BurnDownChart';
import { PhaseBreakdown } from '../components/PhaseBreakdown';
import { TodayPanel } from '../components/TodayPanel';
import { StreakBadge } from '../components/StreakBadge';
import { recordStudyActivity, getStreakData } from '../lib/streakService';
import { EFFORT_META } from '../lib/effortColors';

interface ExamWithDetails {
  exam: Exam;
  topics: Topic[];
  dayWeights: DayWeight[];
  assignments: ScheduledAssignment[];
}

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
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onContextMenu={(e) => onContextMenu(e, assignment.id)}
          onMouseEnter={() => onMouseEnter(assignment.id)}
          onMouseLeave={onMouseLeave}
          onClick={() => { if (isBulkMode) onSelect(assignment.id); }}
          className={`group relative flex items-start gap-2 p-2 rounded-lg transition cursor-pointer
            ${snapshot.isDragging ? 'shadow-lg bg-neutral-700 scale-105' : ''}
            ${assignment.is_completed ? 'bg-neutral-900/50' : 'hover:bg-neutral-800/50'}
            ${isSelected ? 'ring-2 ring-amber-500 bg-amber-500/10' : ''}
          `}
        >
          {isBulkMode && (
            <div className="absolute -left-1 top-1/2 -translate-y-1/2">
              {isSelected ? (
                <CheckCircle className="w-5 h-5 text-amber-500" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-neutral-600" />
              )}
            </div>
          )}

          <div className="pt-0.5" onClick={(e) => { e.stopPropagation(); if (!isBulkMode) onToggle(assignment.id, assignment.is_completed); }}>
            {isUpdating ? (
              <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
            ) : assignment.is_completed ? (
              <CheckCircle className="w-5 h-5 text-amber-500" />
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-neutral-600 hover:border-amber-500 transition" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1">
              <span className={`text-sm font-medium leading-tight ${
                assignment.is_completed ? 'text-neutral-500 line-through' : 'text-white'
              }`}>
                {topic.title}
              </span>
              {topic.notes && (
                <span title={topic.notes} className="flex-shrink-0 mt-0.5">
                  <Edit3 className="w-3 h-3 text-blue-400" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <div className={`w-2 h-2 rounded-full ${EFFORT_META[topic.estimated_effort].dot}`} />
              <span className="text-xs text-neutral-500">{EFFORT_META[topic.estimated_effort].label}</span>
              {wasMoved && (
                <span className="flex items-center gap-1 text-xs text-amber-500">
                  <Move className="w-3 h-3" />
                  moved
                </span>
              )}
            </div>
          </div>

          {isHovered && wasMoved && (
            <div className="absolute left-0 right-0 -bottom-10 bg-neutral-950 text-white text-xs py-1.5 px-2 rounded shadow-lg z-10 border border-neutral-800">
              Originally: {format(parseISO(assignment.recommended_date), 'EEE, MMM d')}
            </div>
          )}
        </div>
      )}
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
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const completedCount = assignments.filter((a) => a.is_completed).length;
  const dateObj = parseISO(date);
  const isToday = format(new Date(), 'yyyy-MM-dd') === date;
  const isPast = isBefore(dateObj, startOfDay(new Date()));
  const phase = isRevision ? 'revision' : 'learning';
  const incompleteCount = assignments.filter((a) => !a.is_completed).length;

  return (
    <Droppable droppableId={`${phase}-${date}`}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`bg-neutral-900 rounded-xl border ${
            isToday ? 'border-amber-500 ring-2 ring-amber-500/20'
            : snapshot.isDraggingOver ? 'border-blue-500 ring-2 ring-blue-500/20'
            : showClearConfirm ? 'border-red-700'
            : 'border-neutral-800'
          } ${isPast ? 'opacity-60' : ''} p-4 transition-shadow ${snapshot.isDraggingOver ? 'shadow-lg' : ''}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium text-white">
                {format(dateObj, 'EEE, MMM d')}
              </div>
              {isToday && <span className="text-xs text-amber-500 font-medium">Today</span>}
              {isPast && !isToday && <span className="text-xs text-red-400 font-medium">Past</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                isRevision
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'bg-orange-900/30 text-orange-400'
              }`}>
                {isRevision ? 'Revision' : 'Learning'}
              </span>
              <button
                onClick={() => setShowClearConfirm(true)}
                title={`Unschedule all topics from ${format(dateObj, 'MMM d')}`}
                className="p-1 rounded text-neutral-600 hover:text-red-400 hover:bg-red-900/20 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Inline unschedule confirmation */}
          {showClearConfirm && (
            <div className="mb-3 rounded-lg bg-red-900/20 border border-red-800 p-3">
              <p className="text-xs text-red-300 font-medium mb-1">
                Unschedule {assignments.length} topic{assignments.length !== 1 ? 's' : ''}?
              </p>
              <p className="text-xs text-neutral-500 mb-3">
                {incompleteCount > 0
                  ? `${incompleteCount} incomplete topic${incompleteCount !== 1 ? 's' : ''} will be returned to the unscheduled pool.`
                  : 'All topics here are already complete.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onDeleteTile(date, phase); setShowClearConfirm(false); }}
                  className="flex-1 py-1 text-xs font-semibold rounded bg-red-700 hover:bg-red-600 text-white transition"
                >
                  Unschedule
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-1 text-xs font-medium rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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
              <div className="text-xs text-neutral-600 italic py-2 text-center">
                No topics assigned
              </div>
            )}
            {provided.placeholder}
          </div>

          {assignments.length > 0 && (
            <div className="mt-3 pt-2 border-t border-neutral-800">
              <div className="text-xs text-neutral-500">
                {completedCount} / {assignments.length} completed
              </div>
              <div className="mt-1.5 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
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
  const [activeSlots, setActiveSlots] = useState<{ learning: Set<string>; revision: Set<string> }>({
    learning: new Set(),
    revision: new Set(),
  });
  const [moveHistory, setMoveHistory] = useState<
    { assignmentId: string; fromDate: string; toDate: string }[]
  >([]);
  const [scheduleBehind, setScheduleBehind] = useState(false);

  useEffect(() => {
    if (examId) {
      loadExam(examId);
    }
    loadStreaks();
  }, [examId]);

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

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const completedTopicIds = new Set(result.topics.filter((t) => t.is_completed).map((t) => t.id));
      const assignedTopicIds = new Set(result.assignments.map((a) => a.topic_id));
      const incompleteTopicIds = result.topics.filter((t) => !t.is_completed).map((t) => t.id);
      const hasStalePastAssignment = result.assignments.some(
        (a) => a.assigned_date < todayStr && !completedTopicIds.has(a.topic_id)
      );
      const hasUnassignedIncomplete = incompleteTopicIds.some((id) => !assignedTopicIds.has(id));

      if (hasUnassignedIncomplete) {
        // Auto-fix truly broken state: a topic exists with no scheduled row at all.
        // This is a data integrity issue, not a user choice, so silently correct it.
        await recalculateSchedule(id);
        result = await getExamWithDetails(id);
        setScheduleBehind(false);
      } else {
        // Stale past assignments are a user concern — inform them and let them decide.
        // Silently recalculating would overwrite any manual date moves they made.
        setScheduleBehind(hasStalePastAssignment);
      }

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
      const { currentStreak: cs, longestStreak: ls } = await getStreakData();
      setCurrentStreak(cs);
      setLongestStreak(ls);
    } catch (err) {
      console.error('Failed to load streaks:', err);
    }
  };

  const handleToggleComplete = async (assignmentId: string, currentStatus: boolean) => {
    if (!data) return;
    setUpdating(assignmentId);
    try {
      const updatedAssignment = await updateAssignmentCompletion(assignmentId, !currentStatus);
      const updatedAssignments = data.assignments.map((a) =>
        a.id === assignmentId ? updatedAssignment : a
      );

      // Sync topic.is_completed so TodayPanel's allTopicsComplete (and confetti) works.
      // Only learning assignments gate topic completion — revision is a review layer.
      let updatedTopics = data.topics;
      const assignment = data.assignments.find((a) => a.id === assignmentId);
      if (assignment?.phase === 'learning') {
        const updatedTopic = await updateTopicCompletion(assignment.topic_id, !currentStatus);
        updatedTopics = data.topics.map((t) => (t.id === assignment.topic_id ? updatedTopic : t));
      }

      setData({ ...data, assignments: updatedAssignments, topics: updatedTopics });

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

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!data || !result.destination) return;

      const { draggableId, source, destination } = result;
      const assignmentId = draggableId.replace('assignment-', '');

      const parseDroppable = (id: string) => {
        const idx = id.indexOf('-');
        return { phase: id.slice(0, idx), date: id.slice(idx + 1) };
      };
      const src = parseDroppable(source.droppableId);
      const dest = parseDroppable(destination.droppableId);

      if (src.phase !== dest.phase) return;
      if (isBefore(parseISO(dest.date), startOfDay(new Date()))) return;

      const assignment = data.assignments.find((a) => a.id === assignmentId);
      if (!assignment || assignment.assigned_date === dest.date) return;

      setUpdating(assignmentId);
      const prevDate = assignment.assigned_date;
      try {
        await updateTopicAssignment(assignment.id, dest.date);

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

        setMoveHistory((h) => [...h.slice(-19), { assignmentId, fromDate: prevDate, toDate: dest.date }]);
      } catch (err) {
        console.error('Failed to move topic:', err);
      } finally {
        setUpdating(null);
      }
    },
    [data]
  );

  const handleUndo = useCallback(async () => {
    if (!data || moveHistory.length === 0) return;
    const last = moveHistory[moveHistory.length - 1];
    const assignment = data.assignments.find((a) => a.id === last.assignmentId);
    if (!assignment) return;
    setUpdating(last.assignmentId);
    try {
      await updateTopicAssignment(last.assignmentId, last.fromDate);
      setData({
        ...data,
        assignments: data.assignments.map((a) =>
          a.id === last.assignmentId
            ? { ...a, assigned_date: last.fromDate, updated_at: new Date().toISOString() }
            : a
        ),
      });
      setMoveHistory((h) => h.slice(0, -1));
    } catch (err) {
      console.error('Failed to undo move:', err);
    } finally {
      setUpdating(null);
    }
  }, [data, moveHistory]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleUndo]);

  const handleDeleteTile = async (date: string, phase: 'learning' | 'revision') => {
    if (!examId || !data) return;
    if (!confirm(`Delete the ${date} ${phase} tile? Any topics on it will be unscheduled.`)) return;
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
    } catch (err) {
      console.error('Failed to delete tile:', err);
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

  const executeRecalculate = async () => {
    if (!examId) return;
    try {
      setLoading(true);
      await recalculateSchedule(examId);
      await loadExam(examId);
    } catch (err) {
      console.error('Failed to recalculate:', err);
      setError('Failed to recalculate schedule');
    }
  };

  const handleRecalculate = async () => {
    if (!confirm('Recalculate schedule? This will redistribute incomplete topics.')) return;
    await executeRecalculate();
  };

  const handleReset = async () => {
    if (!examId || !confirm('Reset all progress? This will mark all topics incomplete and recalculate.')) return;
    try {
      setLoading(true);
      await resetSchedule(examId);
      await loadExam(examId);
    } catch (err) {
      console.error('Failed to reset:', err);
      setError('Failed to reset schedule');
    }
  };

  const handleDelete = async () => {
    if (!examId || !data || !confirm(`Delete "${data.exam.name}"? This cannot be undone.`)) return;
    try {
      await deleteExam(examId);
      navigate('/');
    } catch (err) {
      console.error('Failed to delete:', err);
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
    } catch (err) {
      console.error('Failed to update topic:', err);
    }
    setEditingTopic(null);
  };

  const handleTopicDelete = async (topicId: string) => {
    if (!data || !confirm('Delete this topic?')) return;
    try {
      await deleteTopicService(topicId);
      setData({
        ...data,
        topics: data.topics.filter((t) => t.id !== topicId),
        assignments: data.assignments.filter((a) => a.topic_id !== topicId),
      });
    } catch (err) {
      console.error('Failed to delete topic:', err);
    }
    setEditingTopic(null);
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

      // Sync topic.is_completed for all selected learning assignments (one batch call)
      const learningTopicIds = data.assignments
        .filter((a) => ids.includes(a.id) && a.phase === 'learning')
        .map((a) => a.topic_id);

      let updatedTopics = data.topics;
      if (learningTopicIds.length > 0) {
        await batchUpdateTopicCompletion(learningTopicIds, complete);
        updatedTopics = data.topics.map((t) =>
          learningTopicIds.includes(t.id)
            ? { ...t, is_completed: complete, completed_at: complete ? new Date().toISOString() : null }
            : t
        );
      }

      setData({
        ...data,
        assignments: data.assignments.map((a) =>
          ids.includes(a.id)
            ? { ...a, is_completed: complete, completed_at: complete ? new Date().toISOString() : null }
            : a
        ),
        topics: updatedTopics,
      });
      setSelectedAssignments(new Set());
      setIsBulkMode(false);
    } catch (err) {
      console.error('Failed to bulk update:', err);
    }
  };

  const dayCards = useMemo(() => {
    if (!data) return { learning: [] as { date: string; assignments: ScheduledAssignment[] }[], revision: [] as { date: string; assignments: ScheduledAssignment[] }[] };

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
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-neutral-400">{error || 'Study plan not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-amber-500 text-neutral-900 font-semibold rounded-lg hover:bg-amber-400 transition"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Progress ring tracks learning-phase completion only.
  // Counting both phases inflated the denominator 2× and made 100% unreachable from learning alone.
  const completedAssignments = data.assignments.filter((a) => a.is_completed && a.phase === 'learning').length;
  const totalAssignments = data.assignments.filter((a) => a.phase === 'learning').length;
  const progressPercentage = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;
  const daysRemaining = differenceInDays(new Date(data.exam.exam_date), new Date());
  const totalTopics = data.topics.length;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const completedToday = data.assignments.filter(
    (a) => a.is_completed && a.completed_at && format(parseISO(a.completed_at), 'yyyy-MM-dd') === todayStr
  ).length;

  const learningAssignments = data.assignments.filter((a) => a.phase === 'learning');
  const revisionAssignments = data.assignments.filter((a) => a.phase === 'revision');

  const learningCompleted = learningAssignments.filter((a) => a.is_completed).length;
  const learningTotal = learningAssignments.length;
  const revisionCompleted = revisionAssignments.filter((a) => a.is_completed).length;
  const revisionTotal = revisionAssignments.length;

  const assignmentsRemaining = totalAssignments - completedAssignments;
  const dailyPace = studyDaysLeft > 0 && assignmentsRemaining > 0
    ? Math.ceil(assignmentsRemaining / studyDaysLeft)
    : 0;

  const totalDays = differenceInCalendarDays(new Date(data.exam.exam_date), new Date(data.exam.created_at));
  // Use max(1, ...) so on the very first calendar day expected progress is 1/N, not 0%
  // (avoids showing "Ahead" just because you did today's assigned work)
  const daysElapsed = Math.max(1, differenceInCalendarDays(new Date(), new Date(data.exam.created_at)));
  const status = calculateStatus(progressPercentage, daysElapsed, totalDays);

  const expectedProgress = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
  const progressDiff = progressPercentage - expectedProgress;
  const daysDiff = totalDays > 0 ? Math.round((progressDiff / 100) * totalDays) : 0;

  return (
    <div className="min-h-screen bg-neutral-950">
      <Header examName={data.exam.name} />

      {/* Context Menu */}
      {contextMenu && (() => {
        const assignment = data.assignments.find((a) => a.id === contextMenu.assignmentId);
        const topic = assignment ? data.topics.find((t) => t.id === assignment.topic_id) : null;
        const canRestore = assignment && assignment.assigned_date !== assignment.recommended_date;
        return (
          <div
            className="fixed z-50 bg-neutral-900 rounded-lg shadow-xl border border-neutral-800 py-1 min-w-48"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                if (topic) setEditingTopic(topic);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 transition"
            >
              <Edit3 className="w-4 h-4" />
              Edit Topic
            </button>
            {canRestore && (
              <button
                onClick={() => handleRestoreTopic(contextMenu.assignmentId)}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 transition"
              >
                <Undo2 className="w-4 h-4" />
                Restore to {format(parseISO(assignment!.recommended_date), 'MMM d')}
              </button>
            )}
            <hr className="my-1 border-neutral-800" />
            <button
              onClick={() => {
                if (topic) handleTopicDelete(topic.id);
              }}
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
      <div className="bg-neutral-900 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-neutral-400 hover:text-neutral-200 transition"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm">Back</span>
              </button>

              <button
                onClick={() => {
                  setIsBulkMode(!isBulkMode);
                  setSelectedAssignments(new Set());
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  isBulkMode
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'text-neutral-400 hover:bg-neutral-800'
                }`}
              >
                <Check className="w-4 h-4" />
                Bulk Select
              </button>

              {moveHistory.length > 0 && (
                <button
                  onClick={handleUndo}
                  disabled={!!updating}
                  title="Undo last move (Ctrl+Z)"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-neutral-400 hover:bg-neutral-800 disabled:opacity-50 transition"
                >
                  <Undo2 className="w-4 h-4" />
                  Undo{moveHistory.length > 1 ? ` (${moveHistory.length})` : ''}
                </button>
              )}

              {isBulkMode && selectedAssignments.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-400">
                    {selectedAssignments.size} selected
                  </span>
                  <button
                    onClick={() => handleBulkComplete(true)}
                    className="px-3 py-1 text-sm bg-amber-500 text-neutral-900 font-semibold rounded-lg hover:bg-amber-400 transition"
                  >
                    Mark Complete
                  </button>
                  <button
                    onClick={() => handleBulkComplete(false)}
                    className="px-3 py-1 text-sm bg-neutral-700 text-white rounded-lg hover:bg-neutral-600 transition"
                  >
                    Mark Incomplete
                  </button>
                  <button
                    onClick={() => setSelectedAssignments(new Set())}
                    className="p-1 text-neutral-500 hover:text-neutral-300 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 transition"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-neutral-900 rounded-lg shadow-lg border border-neutral-800 z-20 py-1">
                    <button
                      onClick={() => { setShowMenu(false); handleRecalculate(); }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 transition"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Recalculate
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); handleReset(); }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 transition"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset Progress
                    </button>
                    <hr className="my-1 border-neutral-800" />
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

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {scheduleBehind && (
          <div className="mb-4 p-4 rounded-xl bg-orange-900/20 border border-orange-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-300">Schedule has fallen behind</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Some topics were assigned to past dates and weren't completed. Recalculate to redistribute them from today.
                </p>
              </div>
            </div>
            <button
              onClick={() => { setScheduleBehind(false); executeRecalculate(); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-neutral-900 text-sm font-semibold transition flex-shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              Recalculate
            </button>
          </div>
        )}
        <TodayPanel
          topics={data.topics}
          assignments={data.assignments}
          updating={updating}
          onToggle={handleToggleComplete}
          onRecalculate={handleRecalculate}
        />

        {/* Dashboard Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-neutral-500" />
              <h2 className="text-lg font-semibold text-white">Progress Dashboard</h2>
            </div>
            <StreakBadge currentStreak={currentStreak} longestStreak={longestStreak} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3 mb-6">
            {/* Progress Ring & Status Card */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <StatusBadge status={status} daysDiff={daysDiff} />
                  <div className="mt-2">
                    <StatusDescription status={status} />
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <Target className="w-4 h-4" />
                      <span>{completedAssignments} / {totalAssignments} tasks done</span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-400">
                      <Calendar className="w-4 h-4" />
                      <span>{daysRemaining} days left</span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-400">
                      <Clock className="w-4 h-4" />
                      <span>~{dailyPace} topics/day needed</span>
                    </div>
                  </div>
                </div>
                <ProgressRing
                  percentage={progressPercentage}
                  size={110}
                  strokeWidth={8}
                  color={progressPercentage >= 100 ? 'emerald' : progressPercentage >= 50 ? 'blue' : 'amber'}
                />
              </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-2 gap-4 lg:col-span-2">
              <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
                <div className="text-sm text-neutral-400 font-medium mb-1">Completed Today</div>
                <div className="text-3xl font-bold text-amber-500">
                  {completedToday}
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {completedToday > 0 ? 'Great progress!' : 'Start checking off topics!'}
                </div>
              </div>
              <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
                <div className="text-sm text-neutral-400 font-medium mb-1">Learning Progress</div>
                <div className="text-3xl font-bold text-orange-400">
                  {learningTotal > 0 ? Math.round((learningCompleted / learningTotal) * 100) : 0}%
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {learningCompleted} / {learningTotal} topics
                </div>
              </div>
              <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
                <div className="text-sm text-neutral-400 font-medium mb-1">Study Days Left</div>
                <div className="text-3xl font-bold text-blue-400">
                  {studyDaysLeft}
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  with your schedule
                </div>
              </div>
              <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
                <div className="text-sm text-neutral-400 font-medium mb-1">Revision Progress</div>
                <div className="text-3xl font-bold text-blue-400">
                  {revisionTotal > 0 ? Math.round((revisionCompleted / revisionTotal) * 100) : 0}%
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {revisionCompleted} / {revisionTotal} topics
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Topic Burn-Down</h3>
              <BurnDownChart
                examDate={data.exam.exam_date}
                createdAt={data.exam.created_at}
                totalTopics={totalTopics}
                completions={assignmentCompletions}
              />
            </div>

            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Phase Breakdown</h3>
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

        {/* Calendar Section */}
        <section>
          <DragDropContext onDragEnd={handleDragEnd}>
            {/* Learning Phase */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <h2 className="text-lg font-semibold text-white">Learning Phase</h2>
                <span className="text-sm text-neutral-500">
                  ({dayCards.learning.length} days)
                </span>
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
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />
                <div className="flex items-center gap-2 text-neutral-500">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">Revision Phase Starts</span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />
              </div>
            )}

            {/* Revision Phase */}
            {dayCards.revision.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-blue-400" />
                  <h2 className="text-lg font-semibold text-white">Revision Phase</h2>
                  <span className="text-sm text-neutral-500">({dayCards.revision.length} days)</span>
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

        {dayCards.learning.length === 0 && dayCards.revision.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
            <p className="text-neutral-500">No topics scheduled yet</p>
          </div>
        )}
      </main>
    </div>
  );
}
