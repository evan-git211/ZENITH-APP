import { useState, useEffect } from 'react';
import { X, Trash2, Calendar, Clock, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Topic, ScheduledAssignment } from '../types/database';
import { EFFORT_META } from '../lib/effortColors';

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
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative bg-neutral-900 rounded-2xl shadow-xl max-w-md w-full border border-neutral-800 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 flex-shrink-0">
          <h3 className="text-lg font-semibold text-white">Edit Topic</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Topic Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              className="w-full px-4 py-3 rounded-lg border border-neutral-700 bg-neutral-950 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none placeholder:text-neutral-600"
              placeholder="Enter topic title"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-neutral-700 bg-neutral-950 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none resize-none text-sm placeholder:text-neutral-600"
              placeholder="Add key points, formulas, or reminders..."
            />
          </div>

          {/* Effort Level */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Effort Level
            </label>
            <div className="space-y-2">
              {EFFORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setEffort(option.value)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition ${
                    effort === option.value
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                      effort === option.value
                        ? 'bg-amber-500 text-neutral-900'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      {option.value}
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${EFFORT_META[option.value].dot}`} />
                        <span className="font-medium text-white text-sm">{option.label}</span>
                      </div>
                      <div className="text-xs text-neutral-500">{option.description}</div>
                    </div>
                  </div>
                  {effort === option.value && (
                    <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-neutral-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Status Info */}
          <div className="bg-neutral-950 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <Calendar className="w-4 h-4" />
              <span>
                Scheduled:{' '}
                <span className="font-medium text-white">
                  {format(parseISO(assignment.assigned_date), 'EEE, MMM d')}
                </span>
              </span>
            </div>
            {isMoved && (
              <div className="flex items-center gap-2 text-sm text-amber-500">
                <Clock className="w-4 h-4" />
                <span>
                  Originally:{' '}
                  <span className="font-medium">
                    {format(parseISO(assignment.recommended_date), 'EEE, MMM d')}
                  </span>
                </span>
              </div>
            )}
            <div className="text-sm text-neutral-400">
              Status:{' '}
              {topic.is_completed ? (
                <span className="text-amber-500 font-medium">Completed</span>
              ) : (
                <span className="text-amber-500/70 font-medium">In Progress</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-neutral-800 bg-neutral-950 flex-shrink-0">
          <div>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-400">Delete topic?</span>
                <button onClick={() => onDelete(topic.id)} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                  Delete
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 text-sm bg-neutral-800 text-neutral-300 rounded-lg hover:bg-neutral-700 transition">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/20 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800 rounded-lg transition">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="px-4 py-2 text-sm bg-amber-500 text-neutral-900 font-semibold rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
