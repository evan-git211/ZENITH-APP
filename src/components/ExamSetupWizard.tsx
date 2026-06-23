import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Calendar, BookOpen, Clock, RotateCcw,
  Loader2, GripVertical, Save, X,
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { createExam } from '../lib/examService';
import { loadDefaultDayWeights } from './SettingsModal';
import { usePreferences } from '../contexts/PreferencesContext';
import { EFFORT_META } from '../lib/effortColors';

// ── Draft persistence ─────────────────────────────────────────────────────
const DRAFT_KEY = 'zenith_wizard_draft';

interface DraftState {
  step: number;
  examName: string;
  examDate: string;
  topics: TopicInput[];
  dayWeights: DayWeightInput[];
  revisionDays: number;
}

function saveDraft(state: DraftState) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(state)); } catch {}
}

function loadDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

// ── Types ─────────────────────────────────────────────────────────────────
interface TopicInput {
  id: string;
  title: string;
  estimatedEffort: number;
}

interface DayWeightInput {
  dayOfWeek: number;
  weight: number;
  label: string;
}

export function ExamSetupWizard() {
  const navigate = useNavigate();
  const { defaultRevisionDays } = usePreferences();

  const draft = loadDraft();

  const [step, setStep] = useState(draft?.step ?? 1);
  const [examName, setExamName] = useState(draft?.examName ?? '');
  const [examDate, setExamDate] = useState(draft?.examDate ?? '');
  const [topics, setTopics] = useState<TopicInput[]>(
    draft?.topics ?? [{ id: crypto.randomUUID(), title: '', estimatedEffort: 3 }]
  );
  const [dayWeights, setDayWeights] = useState<DayWeightInput[]>(
    draft?.dayWeights ?? loadDefaultDayWeights()
  );
  const [revisionDays, setRevisionDays] = useState(
    draft?.revisionDays ?? defaultRevisionDays
  );
  const [hasDraft, setHasDraft] = useState(!!draft);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-save draft whenever state changes
  useEffect(() => {
    saveDraft({ step, examName, examDate, topics, dayWeights, revisionDays });
  }, [step, examName, examDate, topics, dayWeights, revisionDays]);

  const discardDraft = () => {
    clearDraft();
    setHasDraft(false);
    setStep(1);
    setExamName('');
    setExamDate('');
    setTopics([{ id: crypto.randomUUID(), title: '', estimatedEffort: 3 }]);
    setDayWeights(loadDefaultDayWeights());
    setRevisionDays(defaultRevisionDays);
  };

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (stepNumber === 1) {
      if (!examName.trim()) newErrors.examName = 'Exam name is required';
      if (!examDate) {
        newErrors.examDate = 'Exam date is required';
      } else {
        const selected = new Date(examDate);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (selected <= today) newErrors.examDate = 'Exam date must be in the future';
      }
    }
    if (stepNumber === 2) {
      if (!topics.some(t => t.title.trim())) newErrors.topics = 'At least one topic is required';
    }
    if (stepNumber === 3) {
      if (!dayWeights.some(d => d.weight > 0)) newErrors.dayWeights = 'At least one study day needed';
    }
    if (stepNumber === 4) {
      const totalDays = differenceInDays(new Date(examDate), new Date());
      if (revisionDays >= totalDays) newErrors.revisionDays = 'Revision days must be less than total available days';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => { if (validateStep(step)) setStep(s => Math.min(4, s + 1)); };
  const handleBack = () => setStep(s => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (!validateStep(4)) return;
    setIsSubmitting(true);
    try {
      const validTopics = topics.filter(t => t.title.trim());
      await createExam({
        name: examName,
        examDate: new Date(examDate),
        revisionDays,
        topics: validTopics.map(t => ({ title: t.title, estimatedEffort: t.estimatedEffort })),
        dayWeights: dayWeights.map(d => ({ dayOfWeek: d.dayOfWeek, weight: d.weight })),
      });
      clearDraft();
      navigate('/');
    } catch (error) {
      console.error('Failed to create exam:', error);
      setErrors({ submit: 'Failed to create study plan. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTopic = () => {
    setTopics([...topics, { id: crypto.randomUUID(), title: '', estimatedEffort: 3 }]);
  };
  const removeTopic = (id: string) => {
    if (topics.length > 1) setTopics(topics.filter(t => t.id !== id));
  };
  const updateTopic = (id: string, field: 'title' | 'estimatedEffort', value: string | number) => {
    setTopics(topics.map(t => t.id === id ? { ...t, [field]: value } : t));
  };
  const updateDayWeight = (dayOfWeek: number, weight: number) => {
    setDayWeights(dayWeights.map(d => d.dayOfWeek === dayOfWeek ? { ...d, weight } : d));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const reordered = Array.from(topics);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    setTopics(reordered);
  };

  const totalDays = examDate ? differenceInDays(new Date(examDate), new Date()) : 0;
  const totalEffort = topics.filter(t => t.title.trim()).reduce((s, t) => s + t.estimatedEffort, 0);

  // ── Step 1 ──────────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-100">What are you preparing for?</h2>
        <p className="text-neutral-500 mt-2">Tell us about your exam and when it's scheduled</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">Exam Name *</label>
          <input
            type="text" value={examName} onChange={e => setExamName(e.target.value)} autoFocus
            className={`w-full px-4 py-3 rounded-xl border bg-neutral-950 text-neutral-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition ${errors.examName ? 'border-red-600' : 'border-neutral-700'}`}
            placeholder="e.g., Final Exam — Calculus II"
          />
          {errors.examName && <p className="text-sm text-red-400 mt-1">{errors.examName}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">Exam Date *</label>
          <input
            type="date" value={examDate} onChange={e => setExamDate(e.target.value)}
            min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
            className={`w-full px-4 py-3 rounded-xl border bg-neutral-950 text-neutral-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition ${errors.examDate ? 'border-red-600' : 'border-neutral-700'}`}
          />
          {errors.examDate && <p className="text-sm text-red-400 mt-1">{errors.examDate}</p>}
        </div>
      </div>
    </div>
  );

  // ── Step 2 ──────────────────────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-100">What topics do you need to study?</h2>
        <p className="text-neutral-500 mt-2">Drag to reorder. Rate effort 1–5 for each topic.</p>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="topics">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
              {topics.map((topic, index) => (
                <Draggable key={topic.id} draggableId={topic.id} index={index}>
                  {(prov, snapshot) => (
                    <div
                      ref={prov.innerRef}
                      {...prov.draggableProps}
                      className={`flex items-start gap-2 rounded-xl p-3 border transition ${
                        snapshot.isDragging
                          ? 'bg-amber-500/10 border-amber-500/30 shadow-lg'
                          : 'bg-neutral-800/50 border-neutral-700/50'
                      }`}
                    >
                      <div {...prov.dragHandleProps} className="mt-3 cursor-grab text-neutral-600 hover:text-neutral-400 flex-shrink-0">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text" value={topic.title}
                          onChange={e => updateTopic(topic.id, 'title', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-neutral-700 bg-neutral-950 text-neutral-100 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                          placeholder={`Topic ${index + 1}`}
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-neutral-500">Effort:</span>
                          {[1, 2, 3, 4, 5].map(level => {
                            const meta = EFFORT_META[level];
                            return (
                              <button
                                key={level}
                                onClick={() => updateTopic(topic.id, 'estimatedEffort', level)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                                  topic.estimatedEffort === level ? meta.badge : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700'
                                }`}
                              >
                                {meta.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <button
                        onClick={() => removeTopic(topic.id)}
                        disabled={topics.length === 1}
                        className="mt-2 p-1.5 text-neutral-600 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {errors.topics && <p className="text-sm text-red-400">{errors.topics}</p>}

      <button
        onClick={addTopic}
        className="w-full py-3 rounded-xl border-2 border-dashed border-neutral-700 text-neutral-500 hover:border-amber-500 hover:text-amber-400 transition flex items-center justify-center gap-2 text-sm"
      >
        + Add Topic
      </button>

      {totalEffort > 0 && (
        <p className="text-center text-sm text-neutral-500">
          Total effort: <span className="font-semibold text-amber-400">{totalEffort}</span>
        </p>
      )}
    </div>
  );

  // ── Step 3 ──────────────────────────────────────────────────────────────
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-100">Which days do you study?</h2>
        <p className="text-neutral-500 mt-2">Set intensity for each day (0 = rest, 3 = intensive)</p>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {dayWeights.map(day => (
          <div key={day.dayOfWeek} className="text-center">
            <div className="text-xs font-medium text-neutral-500 mb-2">{day.label}</div>
            <div className="flex flex-col gap-1">
              {[0, 1, 2, 3].map(w => (
                <button
                  key={w} onClick={() => updateDayWeight(day.dayOfWeek, w)}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition ${
                    day.weight === w ? 'bg-amber-500 text-neutral-900' : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700'
                  }`}
                >
                  {w === 0 ? 'Off' : w}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {errors.dayWeights && <p className="text-sm text-red-400 text-center">{errors.dayWeights}</p>}
      <p className="text-center text-xs text-neutral-600">
        Tip: Set weekend days to Off or lower values if you study less on those days.
      </p>
      <button
        onClick={() => {
          const defaults = loadDefaultDayWeights();
          setDayWeights(dayWeights.map(d => {
            const def = defaults.find((x: DayWeightInput) => x.dayOfWeek === d.dayOfWeek);
            return def ? { ...d, weight: def.weight } : d;
          }));
        }}
        className="text-xs text-neutral-500 hover:text-amber-400 transition mx-auto block"
      >
        Reset to saved defaults
      </button>
    </div>
  );

  // ── Step 4 ──────────────────────────────────────────────────────────────
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
          <RotateCcw className="w-8 h-8 text-violet-400" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-100">Set your revision phase</h2>
        <p className="text-neutral-500 mt-2">How many days before the exam to reserve for revision?</p>
      </div>

      <div className="bg-neutral-800/50 rounded-2xl p-6 border border-neutral-700">
        <div className="text-center mb-6">
          <span className="text-5xl font-bold text-amber-400 tabular-nums">{revisionDays}</span>
          <span className="text-lg text-neutral-500 ml-2">days</span>
        </div>
        <input
          type="range" min={0} max={Math.max(1, totalDays - 1)} value={revisionDays}
          onChange={e => setRevisionDays(parseInt(e.target.value))}
          className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />
        {totalDays > 0 && (
          <p className="text-center text-sm text-neutral-500 mt-3">
            {revisionDays} revision · {totalDays - revisionDays} learning ({Math.round((revisionDays / totalDays) * 100)}% of timeline)
          </p>
        )}
        {errors.revisionDays && <p className="text-sm text-red-400 text-center mt-2">{errors.revisionDays}</p>}
      </div>

      {/* Summary */}
      <div className="bg-neutral-800/50 rounded-2xl border border-neutral-700 p-5">
        <h3 className="font-semibold text-neutral-200 mb-4">Study Plan Summary</h3>
        <div className="space-y-2 text-sm">
          {[
            ['Exam', examName],
            ['Date', examDate ? format(new Date(examDate), 'MMM d, yyyy') : '—'],
            ['Topics', String(topics.filter(t => t.title.trim()).length)],
            ['Total days', String(totalDays)],
            ['Learning phase', `${totalDays - revisionDays} days`],
            ['Revision phase', `${revisionDays} days`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="text-neutral-500">{label}</span>
              <span className="font-medium text-neutral-200">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {errors.submit && <p className="text-sm text-red-400 text-center">{errors.submit}</p>}
    </div>
  );

  const steps = [
    { number: 1, title: 'Details' },
    { number: 2, title: 'Topics' },
    { number: 3, title: 'Schedule' },
    { number: 4, title: 'Revision' },
  ];

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Draft banner */}
        {hasDraft && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
            <Save className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-amber-300 flex-1">Draft restored — continuing where you left off.</span>
            <button onClick={discardDraft} className="text-neutral-500 hover:text-red-400 transition">
              Discard
            </button>
          </div>
        )}

        {/* Progress steps */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((s, i) => (
            <div key={s.number} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition ${
                step >= s.number ? 'bg-amber-500 text-neutral-900' : 'bg-neutral-800 text-neutral-500'
              }`}>
                {step > s.number ? '✓' : s.number}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-12 h-1 mx-2 rounded-full ${step > s.number ? 'bg-amber-500' : 'bg-neutral-800'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Form card */}
        <div className="bg-neutral-900 rounded-2xl shadow-xl border border-neutral-800 p-8">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-neutral-800">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className="flex items-center gap-2 px-4 py-2 text-neutral-500 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>

            {step < 4 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold transition"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold transition disabled:opacity-50"
              >
                {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" />Creating…</> : <>✓ Create Study Plan</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
