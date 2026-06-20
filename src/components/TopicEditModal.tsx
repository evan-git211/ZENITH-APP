import { useState, useEffect } from 'react';
import { X, Trash2, Calendar, Clock, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Topic, ScheduledAssignment } from '../types/database';

interface TopicEditModalProps {
  topic: Topic;
  assignment: ScheduledAssignment;
  onSave: (topicId: string, updates: { title: string; estimatedEffort: number; notes: string }) => void;
  onDelete: (topicId: string) => void;
  onClose: () => void;
}

const EFFORT_OPTIONS = [
  { value: 1, label: 'Minimal', description: 'Quick review' },
  { value: 2, label: 'Light', description: 'Brief study session' },
  { value: 3, label: 'Medium', description: 'Standard study time' },
  { value: 4, label: 'Heavy', description: 'Intensive study needed' },
  { value: 5, label: 'Very Heavy', description: 'Comprehensive review' },
];

export function TopicEditModal({ topic, assignment, onSave, onDelete, onClose }: TopicEditModalProps) {
  const [title, setTitle] = useState(topic.title);
  const [effort, setEffort] = useState(topic.estimated_effort);
  const [notes, setNotes] = useState(topic.notes ?? '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(topic.id, { title: title.trim(), estimatedEffort: effort, notes });
  };

  const isMoved = assignment.assigned_date !== assignment.recommended_date;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70" onClick={onClose} />

      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Edit Topic</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Topic Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              placeholder="Enter topic title"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none text-sm"
              placeholder="Add key points, formulas, or reminders..."
            />
          </div>

          {/* Effort Level */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Effort Level
            </label>
            <div className="space-y-2">
              {EFFORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setEffort(option.value)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition ${
                    effort === option.value
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                      effort === option.value
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {option.value}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-slate-800 dark:text-slate-100 text-sm">{option.label}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{option.description}</div>
                    </div>
                  </div>
                  {effort === option.value && (
                    <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Status Info */}
          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Calendar className="w-4 h-4" />
              <span>
                Scheduled:{' '}
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {format(parseISO(assignment.assigned_date), 'EEE, MMM d')}
                </span>
              </span>
            </div>
            {isMoved && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" />
                <span>
                  Originally:{' '}
                  <span className="font-medium">
                    {format(parseISO(assignment.recommended_date), 'EEE, MMM d')}
                  </span>
                </span>
              </div>
            )}
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Status:{' '}
              {topic.is_completed ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Completed</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-medium">In Progress</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex-shrink-0">
          <div>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">Delete topic?</span>
                <button onClick={() => onDelete(topic.id)} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                  Delete
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
