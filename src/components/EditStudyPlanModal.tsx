import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ChevronLeft, ChevronRight, Calendar, BookOpen, Clock, RotateCcw,
  Loader2, GripVertical, Save,
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { updateExamDetails } from '../lib/examService';
import { loadDefaultDayWeights } from './SettingsModal';
import { EFFORT_META } from '../lib/effortColors';
import type { Exam, Topic, DayWeight } from '../types/database';

interface TopicInput {
  id?: string;
  localId: string;
  title: string;
  estimatedEffort: number;
}

interface DayWeightInput {
  dayOfWeek: number;
  weight: number;
  label: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  exam: Exam;
  topics: Topic[];
  dayWeights: DayWeight[];
  onSave: () => void;
  onClose: () => void;
}

export function EditStudyPlanModal({ exam, topics: initialTopics, dayWeights: initialDayWeights, onSave, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [examName, setExamName] = useState(exam.name);
  const [examDate, setExamDate] = useState(exam.exam_date);
  const [topicList, setTopicList] = useState<TopicInput[]>(
    initialTopics.map(t => ({ id: t.id, localId: t.id, title: t.title, estimatedEffort: t.estimated_effort }))
  );
  const [dayWeightList, setDayWeightList] = useState<DayWeightInput[]>(
    DAY_LABELS.map((label, i) => {
      const existing = initialDayWeights.find(d => d.day_of_week === i);
      return { dayOfWeek: i, weight: existing?.weight ?? 1, label };
    })
  );
  const [revisionDays, setRevisionDays] = useState(exam.revision_days);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const totalDays = examDate ? differenceInDays(new Date(examDate), new Date()) : 0;
  const totalEffort = topicList.filter(t => t.title.trim()).reduce((s, t) => s + t.estimatedEffort, 0);

  const validate = (s: number) => {
    const errs: Record<string, string> = {};
    if (s === 1) {
      if (!examName.trim()) errs.examName = 'Exam name is required';
      if (!examDate) errs.examDate = 'Exam date is required';
      else {
        const sel = new Date(examDate); sel.setHours(0, 0, 0, 0);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (sel <= today) errs.examDate = 'Exam date must be in the future';
      }
    }
    if (s === 2) {
      if (!topicList.some(t => t.title.trim())) errs.topics = 'At least one topic is required';
    }
    if (s === 3) {
      if (!dayWeightList.some(d => d.weight > 0)) errs.dayWeights = 'At least one study day needed';
    }
    if (s === 4) {
      if (revisionDays >= totalDays) errs.revisionDays = 'Revision days must be less than total available days';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => { if (validate(step)) setStep(s => Math.min(4, s + 1)); };
  const back = () => { setErrors({}); setStep(s => Math.max(1, s - 1)); };

  const addTopic = () => {
    setTopicList(prev => [...prev, { localId: crypto.randomUUID(), title: '', estimatedEffort: 3 }]);
  };
  const removeTopic = (localId: string) => {
    if (topicList.length > 1) setTopicList(prev => prev.filter(t => t.localId !== localId));
  };
  const updateTopic = (localId: string, field: 'title' | 'estimatedEffort', value: string | number) => {
    setTopicList(prev => prev.map(t => t.localId === localId ? { ...t, [field]: value } : t));
  };
  const updateWeight = (dayOfWeek: number, weight: number) => {
    setDayWeightList(prev => prev.map(d => d.dayOfWeek === dayOfWeek ? { ...d, weight } : d));
  };
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const reordered = Array.from(topicList);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    setTopicList(reordered);
  };

  const handleSave = async () => {
    if (!validate(4)) return;
    setSaving(true);
    try {
      await updateExamDetails(exam.id, {
        name: examName,
        examDate: new Date(examDate),
        revisionDays,
        topics: topicList
          .filter(t => t.title.trim())
          .map(t => ({ id: t.id, title: t.title, estimatedEffort: t.estimatedEffort })),
        dayWeights: dayWeightList.map(d => ({ dayOfWeek: d.dayOfWeek, weight: d.weight })),
      });
      onSave();
    } catch (err) {
      console.error('updateExamDetails failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrors({ submit: `Save failed: ${msg}` });
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { n: 1, label: 'Details' },
    { n: 2, label: 'Topics' },
    { n: 3, label: 'Schedule' },
    { n: 4, label: 'Revision' },
  ];

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-white">Edit Study Plan</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-700 flex-shrink-0">
          {steps.map(({ n, label }) => (
            <div key={n} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                step === n ? 'bg-amber-500 text-slate-900' : step > n ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'
              }`}>
                {step > n ? '✓' : n}
              </div>
              <span className={`text-xs font-medium ${step === n ? 'text-amber-400' : step > n ? 'text-emerald-400' : 'text-slate-500'}`}>{label}</span>
              {n < 4 && <div className={`w-6 h-px flex-shrink-0 ${step > n ? 'bg-emerald-500' : 'bg-slate-700'}`} />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Step 1 — Details */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-100">Exam Details</p>
                  <p className="text-xs text-slate-500">Name and date of your exam</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Exam Name</label>
                <input
                  type="text" value={examName} onChange={e => setExamName(e.target.value)} autoFocus
                  className={`w-full px-4 py-2.5 rounded-xl border bg-slate-900 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition text-sm ${errors.examName ? 'border-red-600' : 'border-slate-600'}`}
                />
                {errors.examName && <p className="text-xs text-red-400 mt-1">{errors.examName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Exam Date</label>
                <input
                  type="date" value={examDate} onChange={e => setExamDate(e.target.value)}
                  min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                  className={`w-full px-4 py-2.5 rounded-xl border bg-slate-900 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition text-sm ${errors.examDate ? 'border-red-600' : 'border-slate-600'}`}
                />
                {errors.examDate && <p className="text-xs text-red-400 mt-1">{errors.examDate}</p>}
              </div>
            </div>
          )}

          {/* Step 2 — Topics */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-100">Topics</p>
                  <p className="text-xs text-slate-500">Drag to reorder · rate effort 1–5</p>
                </div>
              </div>

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="edit-topics">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      {topicList.map((topic, index) => (
                        <Draggable key={topic.localId} draggableId={topic.localId} index={index}>
                          {(prov, snapshot) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              className={`flex items-start gap-2 rounded-xl p-3 border transition ${
                                snapshot.isDragging
                                  ? 'bg-amber-500/10 border-amber-500/30 shadow-lg'
                                  : 'bg-slate-700/50 border-slate-600/50'
                              }`}
                            >
                              <div {...prov.dragHandleProps} className="mt-3 cursor-grab text-slate-500 hover:text-slate-300 flex-shrink-0">
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <div className="flex-1 space-y-2 min-w-0">
                                <input
                                  type="text" value={topic.title}
                                  onChange={e => updateTopic(topic.localId, 'title', e.target.value)}
                                  className="w-full px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 text-slate-100 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                                  placeholder={`Topic ${index + 1}`}
                                />
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs text-slate-500">Effort:</span>
                                  {[1, 2, 3, 4, 5].map(level => {
                                    const meta = EFFORT_META[level];
                                    return (
                                      <button
                                        key={level}
                                        onClick={() => updateTopic(topic.localId, 'estimatedEffort', level)}
                                        className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                                          topic.estimatedEffort === level ? meta.badge : 'bg-slate-700 text-slate-500 hover:bg-slate-600'
                                        }`}
                                      >
                                        {meta.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <button
                                onClick={() => removeTopic(topic.localId)}
                                disabled={topicList.length === 1}
                                className="mt-2 p-1.5 text-slate-500 hover:text-red-400 disabled:opacity-30 transition flex-shrink-0"
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
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-600 text-slate-500 hover:border-amber-500 hover:text-amber-400 transition flex items-center justify-center gap-2 text-sm"
              >
                + Add Topic
              </button>

              {totalEffort > 0 && (
                <p className="text-center text-sm text-slate-500">
                  Total effort: <span className="font-semibold text-amber-400">{totalEffort}</span>
                </p>
              )}
            </div>
          )}

          {/* Step 3 — Schedule */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-100">Study Days</p>
                  <p className="text-xs text-slate-500">Set intensity per day (0 = rest, 3 = intensive)</p>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {dayWeightList.map(day => (
                  <div key={day.dayOfWeek} className="text-center">
                    <div className="text-xs font-medium text-slate-500 mb-1.5">{day.label}</div>
                    <div className="flex flex-col gap-1">
                      {[0, 1, 2, 3].map(w => (
                        <button
                          key={w} onClick={() => updateWeight(day.dayOfWeek, w)}
                          className={`w-full py-1.5 rounded text-xs font-medium transition ${
                            day.weight === w ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
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
              <button
                onClick={() => {
                  const defaults = loadDefaultDayWeights();
                  setDayWeightList(prev => prev.map(d => {
                    const def = defaults.find((x: { dayOfWeek: number; weight: number }) => x.dayOfWeek === d.dayOfWeek);
                    return def ? { ...d, weight: def.weight } : d;
                  }));
                }}
                className="text-xs text-slate-500 hover:text-amber-400 transition block mx-auto"
              >
                Reset to saved defaults
              </button>
            </div>
          )}

          {/* Step 4 — Revision + Summary */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <RotateCcw className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-100">Revision Phase</p>
                  <p className="text-xs text-slate-500">Days before the exam reserved for revision</p>
                </div>
              </div>

              <div className="bg-slate-700/50 rounded-xl p-5 border border-slate-600">
                <div className="text-center mb-4">
                  <span className="text-4xl font-bold text-amber-400 tabular-nums">{revisionDays}</span>
                  <span className="text-base text-slate-500 ml-2">days</span>
                </div>
                <input
                  type="range" min={0} max={Math.max(1, totalDays - 1)} value={revisionDays}
                  onChange={e => setRevisionDays(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                {totalDays > 0 && (
                  <p className="text-center text-xs text-slate-500 mt-2">
                    {revisionDays} revision · {totalDays - revisionDays} learning ({Math.round((revisionDays / totalDays) * 100)}% of timeline)
                  </p>
                )}
                {errors.revisionDays && <p className="text-xs text-red-400 text-center mt-2">{errors.revisionDays}</p>}
              </div>

              <div className="bg-slate-700/50 rounded-xl border border-slate-600 p-4">
                <h3 className="font-semibold text-slate-200 mb-3 text-sm">Summary</h3>
                <div className="space-y-1.5 text-sm">
                  {[
                    ['Exam', examName],
                    ['Date', examDate ? format(new Date(examDate), 'MMM d, yyyy') : '—'],
                    ['Topics', String(topicList.filter(t => t.title.trim()).length)],
                    ['Learning phase', `${totalDays - revisionDays} days`],
                    ['Revision phase', `${revisionDays} days`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-medium text-slate-200">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {errors.submit && <p className="text-sm text-red-400 text-center">{errors.submit}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 flex-shrink-0">
          <button
            onClick={back}
            disabled={step === 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          {step < 4 ? (
            <button
              onClick={next}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm transition"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm transition disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save & Recalculate'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
