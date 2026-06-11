import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar, BookOpen, Clock, RotateCcw, Loader2 } from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { createExam } from '../lib/examService';

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

const EFFORT_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Minimal', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  2: { label: 'Light', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  3: { label: 'Medium', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  4: { label: 'Heavy', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  5: { label: 'Very Heavy', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export function ExamSetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1: Exam details
  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState('');

  // Step 2: Topics
  const [topics, setTopics] = useState<TopicInput[]>([
    { id: crypto.randomUUID(), title: '', estimatedEffort: 3 },
  ]);

  // Step 3: Day weights
  const [dayWeights, setDayWeights] = useState<DayWeightInput[]>(DAYS_OF_WEEK);

  // Step 4: Revision days
  const [revisionDays, setRevisionDays] = useState(7);

  // Form state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNumber === 1) {
      if (!examName.trim()) {
        newErrors.examName = 'Exam name is required';
      }
      if (!examDate) {
        newErrors.examDate = 'Exam date is required';
      } else {
        const selectedDate = new Date(examDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate <= today) {
          newErrors.examDate = 'Exam date must be in the future';
        }
      }
    }

    if (stepNumber === 2) {
      const validTopics = topics.filter((t) => t.title.trim());
      if (validTopics.length === 0) {
        newErrors.topics = 'At least one topic is required';
      }
    }

    if (stepNumber === 3) {
      const hasStudyDay = dayWeights.some((d) => d.weight > 0);
      if (!hasStudyDay) {
        newErrors.dayWeights = 'At least one day must have weight > 0';
      }
    }

    if (stepNumber === 4) {
      const totalDays = differenceInDays(new Date(examDate), new Date());
      if (revisionDays >= totalDays) {
        newErrors.revisionDays = 'Revision days must be less than total available days';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(4, s + 1));
    }
  };

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1));
  };

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

      navigate('/');
    } catch (error) {
      console.error('Failed to create exam:', error);
      setErrors({ submit: 'Failed to create study plan. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTopic = () => {
    setTopics([
      ...topics,
      { id: crypto.randomUUID(), title: '', estimatedEffort: 3 },
    ]);
  };

  const removeTopic = (id: string) => {
    if (topics.length > 1) {
      setTopics(topics.filter((t) => t.id !== id));
    }
  };

  const updateTopic = (id: string, field: 'title' | 'estimatedEffort', value: string | number) => {
    setTopics(
      topics.map((t) =>
        t.id === id ? { ...t, [field]: value } : t
      )
    );
  };

  const updateDayWeight = (dayOfWeek: number, weight: number) => {
    setDayWeights(
      dayWeights.map((d) =>
        d.dayOfWeek === dayOfWeek ? { ...d, weight } : d
      )
    );
  };

  const totalDays = examDate ? differenceInDays(new Date(examDate), new Date()) : 0;
  const totalEffort = topics
    .filter((t) => t.title.trim())
    .reduce((sum, t) => sum + t.estimatedEffort, 0);

  // Step 1: Exam Details
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          What are you preparing for?
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Tell us about your exam and when it is scheduled
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Exam Name *
          </label>
          <input
            type="text"
            value={examName}
            onChange={(e) => setExamName(e.target.value)}
            className={`w-full px-4 py-3 rounded-lg border ${
              errors.examName
                ? 'border-red-300 dark:border-red-700'
                : 'border-slate-300 dark:border-slate-600'
            } bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition`}
            placeholder="e.g., Final Exam - Calculus II"
          />
          {errors.examName && (
            <p className="text-sm text-red-500 mt-1">{errors.examName}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Exam Date *
          </label>
          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
            className={`w-full px-4 py-3 rounded-lg border ${
              errors.examDate
                ? 'border-red-300 dark:border-red-700'
                : 'border-slate-300 dark:border-slate-600'
            } bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition`}
          />
          {errors.examDate && (
            <p className="text-sm text-red-500 mt-1">{errors.examDate}</p>
          )}
        </div>
      </div>
    </div>
  );

  // Step 2: Topics Entry
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8 text-blue-500 dark:text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          What topics do you need to study?
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Add each topic and rate its difficulty (1 = easy review, 5 = intensive study)
        </p>
      </div>

      <div className="space-y-3">
        {topics.map((topic, index) => (
          <div key={topic.id} className="flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={topic.title}
                onChange={(e) => updateTopic(topic.id, 'title', e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                placeholder={`Topic ${index + 1}`}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Effort:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      onClick={() => updateTopic(topic.id, 'estimatedEffort', level)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                        topic.estimatedEffort === level
                          ? EFFORT_LABELS[level].color
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
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
              className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        {errors.topics && (
          <p className="text-sm text-red-500">{errors.topics}</p>
        )}

        <button
          onClick={addTopic}
          className="w-full py-3 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Topic
        </button>

        {totalEffort > 0 && (
          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            Total effort: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{totalEffort}</span>
          </div>
        )}
      </div>
    </div>
  );

  // Step 3: Day Weights
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-amber-500 dark:text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Which days do you study?
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Set study intensity for each day (0 = rest day, 3 = intensive)
        </p>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {dayWeights.map((day) => (
          <div key={day.dayOfWeek} className="text-center">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
              {day.label}
            </div>
            <div className="flex flex-col gap-1">
              {[0, 1, 2, 3].map((weight) => (
                <button
                  key={weight}
                  onClick={() => updateDayWeight(day.dayOfWeek, weight)}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition ${
                    day.weight === weight
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
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
        <p className="text-sm text-red-500 text-center">{errors.dayWeights}</p>
      )}

      <div className="text-center text-sm text-slate-500 dark:text-slate-400">
        Tip: Set weekend days to 'Off' or lower values if you study less on those days
      </div>
    </div>
  );

  // Step 4: Revision Config
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-4">
          <RotateCcw className="w-8 h-8 text-purple-500 dark:text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Set your revision phase
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          How many days before the exam do you want to reserve for revision?
        </p>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6">
        <div className="text-center mb-6">
          <span className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
            {revisionDays}
          </span>
          <span className="text-lg text-slate-500 dark:text-slate-400 ml-2">days</span>
        </div>

        <input
          type="range"
          min={0}
          max={Math.max(1, totalDays - 1)}
          value={revisionDays}
          onChange={(e) => setRevisionDays(parseInt(e.target.value))}
          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
        />

        {totalDays > 0 && (
          <div className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4">
            {revisionDays} days for revision ({Math.round((revisionDays / totalDays) * 100)}% of timeline)
          </div>
        )}

        {errors.revisionDays && (
          <p className="text-sm text-red-500 text-center mt-2">{errors.revisionDays}</p>
        )}
      </div>

      {/* Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">
          Study Plan Summary
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Exam:</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">{examName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Date:</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {examDate ? format(new Date(examDate), 'MMM d, yyyy') : '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Topics:</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {topics.filter((t) => t.title.trim()).length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Total days:</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">{totalDays}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Learning phase:</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">{totalDays - revisionDays} days</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Revision phase:</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">{revisionDays} days</span>
          </div>
        </div>
      </div>

      {errors.submit && (
        <p className="text-sm text-red-500 text-center">{errors.submit}</p>
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((s, i) => (
            <div key={s.number} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition ${
                  step >= s.number
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
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
                    step > s.number
                      ? 'bg-emerald-600'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>

            {step < 4 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition disabled:opacity-50"
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
