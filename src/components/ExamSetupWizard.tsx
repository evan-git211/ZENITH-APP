import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar, BookOpen, Clock, RotateCcw, Loader2, Save, GripVertical } from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { createExam } from '../lib/examService';
import { EFFORT_META } from '../lib/effortColors';

const DRAFT_KEY = 'zenith_wizard_draft';

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

const DAYS_OF_WEEK: DayWeightInput[] = [
  { dayOfWeek: 0, weight: 1, label: 'Sun' },
  { dayOfWeek: 1, weight: 1, label: 'Mon' },
  { dayOfWeek: 2, weight: 1, label: 'Tue' },
  { dayOfWeek: 3, weight: 1, label: 'Wed' },
  { dayOfWeek: 4, weight: 1, label: 'Thu' },
  { dayOfWeek: 5, weight: 1, label: 'Fri' },
  { dayOfWeek: 6, weight: 1, label: 'Sat' },
];


function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      examName: string;
      examDate: string;
      topics: TopicInput[];
      dayWeights: DayWeightInput[];
      revisionDays: number;
      step: number;
    };
  } catch {
    return null;
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

export function ExamSetupWizard() {
  const navigate = useNavigate();

  const savedDraft = loadDraft();
  const hasMeaningfulDraft =
    savedDraft &&
    (savedDraft.examName.trim() || savedDraft.topics.some((t) => t.title.trim()));

  const [step, setStep] = useState(hasMeaningfulDraft ? savedDraft!.step : 1);
  const [showDraftBanner, setShowDraftBanner] = useState(!!hasMeaningfulDraft);

  const [examName, setExamName] = useState(hasMeaningfulDraft ? savedDraft!.examName : '');
  const [examDate, setExamDate] = useState(hasMeaningfulDraft ? savedDraft!.examDate : '');
  const [topics, setTopics] = useState<TopicInput[]>(
    hasMeaningfulDraft
      ? savedDraft!.topics
      : [{ id: crypto.randomUUID(), title: '', estimatedEffort: 3 }]
  );
  const [dayWeights, setDayWeights] = useState<DayWeightInput[]>(
    hasMeaningfulDraft ? savedDraft!.dayWeights : DAYS_OF_WEEK
  );
  const [revisionDays, setRevisionDays] = useState(
    hasMeaningfulDraft ? savedDraft!.revisionDays : 7
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persist draft on every state change
  useEffect(() => {
    const hasContent = examName.trim() || topics.some((t) => t.title.trim());
    if (!hasContent) return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ examName, examDate, topics, dayWeights, revisionDays, step })
      );
    } catch {}
  }, [examName, examDate, topics, dayWeights, revisionDays, step]);

  // Warn before browser close/refresh if there's draft content
  useEffect(() => {
    const hasContent = examName.trim() || topics.some((t) => t.title.trim());
    if (!hasContent) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [examName, topics]);

  const discardDraft = () => {
    clearDraft();
    setShowDraftBanner(false);
    setStep(1);
    setExamName('');
    setExamDate('');
    setTopics([{ id: crypto.randomUUID(), title: '', estimatedEffort: 3 }]);
    setDayWeights(DAYS_OF_WEEK);
    setRevisionDays(7);
  };

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNumber === 1) {
      if (!examName.trim()) newErrors.examName = 'Exam name is required';
      if (!examDate) {
        newErrors.examDate = 'Exam date is required';
      } else {
        const selectedDate = new Date(examDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate <= today) newErrors.examDate = 'Exam date must be in the future';
      }
    }

    if (stepNumber === 2) {
      const validTopics = topics.filter((t) => t.title.trim());
      if (validTopics.length === 0) newErrors.topics = 'At least one topic is required';
    }

    if (stepNumber === 3) {
      const hasStudyDay = dayWeights.some((d) => d.weight > 0);
      if (!hasStudyDay) newErrors.dayWeights = 'At least one day must have weight > 0';
    }

    if (stepNumber === 4) {
      const totalDays = differenceInDays(new Date(examDate), new Date());
      if (revisionDays >= totalDays) newErrors.revisionDays = 'Revision days must be less than total available days';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) setStep((s) => Math.min(4, s + 1));
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (!validateStep(4)) return;
    setIsSubmitting(true);
    try {
      const validTopics = topics.filter((t) => t.title.trim());
      await createExam({
        name: examName,
        examDate: new Date(examDate),
        revisionDays,
        topics: validTopics.map((t) => ({
          title: t.title,
          estimatedEffort: t.estimatedEffort,
        })),
        dayWeights: dayWeights.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          weight: d.weight,
        })),
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
    if (topics.length > 1) setTopics(topics.filter((t) => t.id !== id));
  };

  const updateTopic = (id: string, field: 'title' | 'estimatedEffort', value: string | number) => {
    setTopics(topics.map((t) => t.id === id ? { ...t, [field]: value } : t));
  };

  const updateDayWeight = (dayOfWeek: number, weight: number) => {
    setDayWeights(dayWeights.map((d) => d.dayOfWeek === dayOfWeek ? { ...d, weight } : d));
  };

  const reorderTopics = (result: DropResult) => {
    if (!result.destination) return;
    const reordered = [...topics];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setTopics(reordered);
  };

  const totalDays = examDate ? differenceInDays(new Date(examDate), new Date()) : 0;
  const totalEffort = topics.filter((t) => t.title.trim()).reduce((sum, t) => sum + t.estimatedEffort, 0);

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold text-white">
          What are you preparing for?
        </h2>
        <p className="text-neutral-400 mt-2">
          Tell us about your exam and when it is scheduled
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">Exam Name *</label>
          <input
            type="text"
            value={examName}
            onChange={(e) => setExamName(e.target.value)}
            className={`w-full px-4 py-3 rounded-lg border ${
              errors.examName ? 'border-red-700' : 'border-neutral-700'
            } bg-neutral-950 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition placeholder:text-neutral-600`}
            placeholder="e.g., Final Exam - Calculus II"
          />
          {errors.examName && <p className="text-sm text-red-400 mt-1">{errors.examName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">Exam Date *</label>
          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
            className={`w-full px-4 py-3 rounded-lg border ${
              errors.examDate ? 'border-red-700' : 'border-neutral-700'
            } bg-neutral-950 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition`}
          />
          {errors.examDate && <p className="text-sm text-red-400 mt-1">{errors.examDate}</p>}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">
          What topics do you need to study?
        </h2>
        <p className="text-neutral-400 mt-2">
          Add each topic and rate its difficulty (1 = easy review, 5 = intensive study)
        </p>
      </div>

      <div className="space-y-3">
      <DragDropContext onDragEnd={reorderTopics}>
        <Droppable droppableId="wizard-topics">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-3"
            >
              {topics.map((topic, index) => (
                <Draggable key={topic.id} draggableId={topic.id} index={index}>
                  {(drag, snapshot) => (
                    <div
                      ref={drag.innerRef}
                      {...drag.draggableProps}
                      className={`flex items-start gap-2 ${snapshot.isDragging ? 'opacity-80' : ''}`}
                    >
                      {/* Drag handle */}
                      <div
                        {...drag.dragHandleProps}
                        className="mt-3.5 p-1 text-neutral-600 hover:text-neutral-400 cursor-grab active:cursor-grabbing transition flex-shrink-0"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>

                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={topic.title}
                          onChange={(e) => updateTopic(topic.id, 'title', e.target.value)}
                          className="w-full px-4 py-3 rounded-lg border border-neutral-700 bg-neutral-950 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition placeholder:text-neutral-600"
                          placeholder={`Topic ${index + 1}`}
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-neutral-400">Effort:</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((level) => (
                              <button
                                key={level}
                                onClick={() => updateTopic(topic.id, 'estimatedEffort', level)}
                                className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                                  topic.estimatedEffort === level
                                    ? EFFORT_META[level].badge
                                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                                }`}
                              >
                                {level}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => removeTopic(topic.id)}
                        disabled={topics.length === 1}
                        className="mt-1 p-2 text-neutral-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
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
          className="w-full py-3 rounded-lg border-2 border-dashed border-neutral-700 text-neutral-400 hover:border-amber-500 hover:text-amber-500 transition flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Topic
        </button>

        {totalEffort > 0 && (
          <div className="text-center text-sm text-neutral-400">
            Total effort: <span className="font-semibold text-amber-500">{totalEffort}</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold text-white">
          Which days do you study?
        </h2>
        <p className="text-neutral-400 mt-2">
          Set study intensity for each day (0 = rest day, 3 = intensive)
        </p>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {dayWeights.map((day) => (
          <div key={day.dayOfWeek} className="text-center">
            <div className="text-sm font-medium text-neutral-400 mb-2">
              {day.label}
            </div>
            <div className="flex flex-col gap-1">
              {[0, 1, 2, 3].map((weight) => (
                <button
                  key={weight}
                  onClick={() => updateDayWeight(day.dayOfWeek, weight)}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition ${
                    day.weight === weight
                      ? 'bg-amber-500 text-neutral-900 font-semibold'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  {weight === 0 ? 'Off' : weight}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {errors.dayWeights && (
        <p className="text-sm text-red-400 text-center">{errors.dayWeights}</p>
      )}

      <div className="text-center text-sm text-neutral-500">
        Tip: Set weekend days to 'Off' or lower values if you study less on those days
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-purple-900/30 flex items-center justify-center mx-auto mb-4">
          <RotateCcw className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">
          Set your revision phase
        </h2>
        <p className="text-neutral-400 mt-2">
          How many days before the exam do you want to reserve for revision?
        </p>
      </div>

      <div className="bg-neutral-950 rounded-xl p-6">
        <div className="text-center mb-6">
          <span className="text-4xl font-bold text-amber-500">
            {revisionDays}
          </span>
          <span className="text-lg text-neutral-400 ml-2">days</span>
        </div>

        <input
          type="range"
          min={0}
          max={Math.max(1, totalDays - 1)}
          value={revisionDays}
          onChange={(e) => setRevisionDays(parseInt(e.target.value))}
          className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />

        {totalDays > 0 && (() => {
          const learningDays = totalDays - revisionDays;
          const validTopicCount = topics.filter((t) => t.title.trim()).length;
          const topicsPerRevDay = revisionDays > 0 && validTopicCount > 0
            ? Math.ceil(validTopicCount / revisionDays)
            : null;

          return (
            <div className="mt-5 space-y-3">
              {/* Phase-split bar */}
              <div className="flex rounded-full overflow-hidden h-3">
                <div
                  className="bg-amber-500 transition-all duration-200"
                  style={{ width: `${(learningDays / totalDays) * 100}%` }}
                />
                <div
                  className="bg-blue-500 transition-all duration-200 flex-1"
                />
              </div>
              <div className="flex justify-between text-xs text-neutral-500">
                <span>
                  <span className="text-amber-400 font-medium">{learningDays}d</span> learning
                </span>
                <span>
                  revision <span className="text-blue-400 font-medium">{revisionDays}d</span>
                </span>
              </div>

              {/* Contextual stats */}
              <div className="flex justify-between text-xs pt-1 border-t border-neutral-800">
                <span className="text-neutral-500">
                  {Math.round((revisionDays / totalDays) * 100)}% of your study period
                </span>
                {topicsPerRevDay !== null && (
                  <span className="text-neutral-500">
                    ~<span className="text-neutral-300 font-medium">{topicsPerRevDay}</span> topic{topicsPerRevDay !== 1 ? 's' : ''}/revision day
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {errors.revisionDays && (
          <p className="text-sm text-red-400 text-center mt-2">{errors.revisionDays}</p>
        )}
      </div>

      {/* Summary */}
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
        <h3 className="font-semibold text-white mb-4">Study Plan Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-400">Exam:</span>
            <span className="font-medium text-white">{examName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Date:</span>
            <span className="font-medium text-white">
              {examDate ? format(new Date(examDate), 'MMM d, yyyy') : '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Topics:</span>
            <span className="font-medium text-white">
              {topics.filter((t) => t.title.trim()).length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Total days:</span>
            <span className="font-medium text-white">{totalDays}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Learning phase:</span>
            <span className="font-medium text-white">{totalDays - revisionDays} days</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Revision phase:</span>
            <span className="font-medium text-amber-500">{revisionDays} days</span>
          </div>
        </div>
      </div>

      {errors.submit && (
        <p className="text-sm text-red-400 text-center">{errors.submit}</p>
      )}
    </div>
  );

  const steps = [
    { number: 1, title: 'Exam Details' },
    { number: 2, title: 'Topics' },
    { number: 3, title: 'Day Weights' },
    { number: 4, title: 'Revision' },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Draft restored banner */}
        {showDraftBanner && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Save className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm flex-1">Draft restored — your progress was saved automatically.</span>
            <button
              onClick={discardDraft}
              className="text-xs text-amber-500/70 hover:text-amber-400 underline underline-offset-2 flex-shrink-0"
            >
              Start fresh
            </button>
          </div>
        )}

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((s, i) => (
            <div key={s.number} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition ${
                  step >= s.number
                    ? 'bg-amber-500 text-neutral-900 font-semibold'
                    : 'bg-neutral-800 text-neutral-500'
                }`}
              >
                {step > s.number ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s.number
                )}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`w-12 h-1 mx-2 rounded ${
                    step > s.number ? 'bg-amber-500' : 'bg-neutral-800'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-neutral-900 rounded-2xl shadow-xl border border-neutral-800 p-8">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-neutral-800">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className="flex items-center gap-2 px-4 py-2 text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>

            {step < 4 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold transition"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Create Study Plan
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
