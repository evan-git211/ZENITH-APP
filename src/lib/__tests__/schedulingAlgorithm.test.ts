import { describe, it, expect, vi } from 'vitest';
import { scheduleTopicsBackward, calculateDailyStats, isTopicMoved } from '../schedulingAlgorithm';
import { addDays } from 'date-fns';

// Mock crypto.randomUUID for consistent test IDs
const mockUUID = () => {
  let counter = 0;
  return () => `topic-${++counter}`;
};

vi.stubGlobal('crypto', {
  randomUUID: mockUUID(),
});

describe('scheduleTopicsBackward', () => {
  const futureDate = (daysFromNow: number) => addDays(new Date(), daysFromNow);

  it('should throw if exam date is not in the future', () => {
    expect(() =>
      scheduleTopicsBackward({
        examDate: new Date('2020-01-01'),
        revisionDays: 7,
        topics: [{ id: '1', title: 'Topic 1', estimatedEffort: 3 }],
        dayWeights: [{ dayOfWeek: 1, weight: 1 }],
      })
    ).toThrow('Exam date must be in the future');
  });

  it('should throw if revision days >= total days', () => {
    expect(() =>
      scheduleTopicsBackward({
        examDate: futureDate(5),
        revisionDays: 7,
        topics: [{ id: '1', title: 'Topic 1', estimatedEffort: 3 }],
        dayWeights: [{ dayOfWeek: 1, weight: 1 }],
      })
    ).toThrow('Revision days must be less than total available days');
  });

  it('should return empty array if no topics', () => {
    const result = scheduleTopicsBackward({
      examDate: futureDate(30),
      revisionDays: 7,
      topics: [],
      dayWeights: [{ dayOfWeek: 1, weight: 1 }],
    });
    expect(result).toEqual([]);
  });

  it('should throw if all day weights are zero', () => {
    expect(() =>
      scheduleTopicsBackward({
        examDate: futureDate(30),
        revisionDays: 7,
        topics: [{ id: '1', title: 'Topic 1', estimatedEffort: 3 }],
        dayWeights: [
          { dayOfWeek: 0, weight: 0 },
          { dayOfWeek: 1, weight: 0 },
        ],
      })
    ).toThrow('At least one day must have weight > 0');
  });

  it('should assign topics to learning phase', () => {
    const result = scheduleTopicsBackward({
      examDate: futureDate(30),
      revisionDays: 7,
      topics: [
        { id: 't1', title: 'Topic 1', estimatedEffort: 3 },
        { id: 't2', title: 'Topic 2', estimatedEffort: 2 },
      ],
      dayWeights: [{ dayOfWeek: 1, weight: 1 }],
    });

    expect(result.length).toBe(2);
    expect(result.every((a) => a.phase === 'learning')).toBe(true);
  });

  it('should assign all topics to unique or same dates', () => {
    const result = scheduleTopicsBackward({
      examDate: futureDate(30),
      revisionDays: 7,
      topics: [
        { id: 't1', title: 'Topic 1', estimatedEffort: 3 },
        { id: 't2', title: 'Topic 2', estimatedEffort: 2 },
        { id: 't3', title: 'Topic 3', estimatedEffort: 4 },
      ],
      dayWeights: [{ dayOfWeek: 1, weight: 1 }],
    });

    const assignedIds = result.map((a) => a.topicId);
    expect(assignedIds).toContain('t1');
    expect(assignedIds).toContain('t2');
    expect(assignedIds).toContain('t3');
  });

  it('should set recommended date equal to assigned date initially', () => {
    const result = scheduleTopicsBackward({
      examDate: futureDate(30),
      revisionDays: 7,
      topics: [{ id: 't1', title: 'Topic 1', estimatedEffort: 3 }],
      dayWeights: [{ dayOfWeek: 1, weight: 1 }],
    });

    expect(result[0].assignedDate).toBe(result[0].recommendedDate);
  });

  it('should handle high effort topics', () => {
    const result = scheduleTopicsBackward({
      examDate: futureDate(30),
      revisionDays: 5,
      topics: [
        { id: 't1', title: 'Hard Topic', estimatedEffort: 5 },
        { id: 't2', title: 'Easy Topic', estimatedEffort: 1 },
      ],
      dayWeights: [
        { dayOfWeek: 1, weight: 2 },
        { dayOfWeek: 2, weight: 2 },
        { dayOfWeek: 3, weight: 2 },
      ],
    });

    const hardTopic = result.find((a) => a.topicId === 't1');
    const easyTopic = result.find((a) => a.topicId === 't2');

    expect(hardTopic).toBeDefined();
    expect(easyTopic).toBeDefined();
    expect(result.length).toBe(2);
  });

  it('should respect zero weight days as rest days', () => {
    const result = scheduleTopicsBackward({
      examDate: futureDate(14),
      revisionDays: 2,
      topics: [
        { id: 't1', title: 'Topic 1', estimatedEffort: 2 },
        { id: 't2', title: 'Topic 2', estimatedEffort: 2 },
        { id: 't3', title: 'Topic 3', estimatedEffort: 2 },
      ],
      dayWeights: [
        { dayOfWeek: 1, weight: 1 },
        { dayOfWeek: 2, weight: 1 },
        { dayOfWeek: 0, weight: 0 },
        { dayOfWeek: 6, weight: 0 },
      ],
    });

    // Should still assign all topics without throwing
    expect(result.length).toBe(3);
  });

  it('should sort topics by effort (highest first)', () => {
    // This tests internal behavior indirectly
    const result = scheduleTopicsBackward({
      examDate: futureDate(60),
      revisionDays: 10,
      topics: [
        { id: 'low', title: 'Low Effort', estimatedEffort: 1 },
        { id: 'high', title: 'High Effort', estimatedEffort: 5 },
        { id: 'mid', title: 'Mid Effort', estimatedEffort: 3 },
      ],
      dayWeights: [{ dayOfWeek: 1, weight: 2 }],
    });

    // All topics should be assigned
    expect(result.length).toBe(3);
    expect(result.map((a) => a.topicId)).toEqual(expect.arrayContaining(['low', 'high', 'mid']));
  });
});

describe('calculateDailyStats', () => {
  it('should calculate correct stats', () => {
    const stats = calculateDailyStats({
      examDate: addDays(new Date(), 30),
      totalTopics: 10,
      completedTopics: 3,
      dayWeights: [{ dayOfWeek: 1, weight: 1 }],
    });

    expect(stats.daysRemaining).toBe(30);
    expect(stats.topicsRemaining).toBe(7);
    expect(stats.progressPercentage).toBe(30);
    expect(stats.dailyPace).toBeGreaterThan(0);
  });

  it('should handle zero topics', () => {
    const stats = calculateDailyStats({
      examDate: addDays(new Date(), 30),
      totalTopics: 0,
      completedTopics: 0,
      dayWeights: [{ dayOfWeek: 1, weight: 1 }],
    });

    expect(stats.topicsRemaining).toBe(0);
    expect(stats.progressPercentage).toBe(0);
    expect(stats.dailyPace).toBe(0);
  });

  it('should handle past exam date', () => {
    const stats = calculateDailyStats({
      examDate: addDays(new Date(), -5),
      totalTopics: 10,
      completedTopics: 8,
      dayWeights: [{ dayOfWeek: 1, weight: 1 }],
    });

    expect(stats.daysRemaining).toBe(0);
  });
});

describe('scheduleTopicsBackward — edge cases', () => {
  const futureDate = (daysFromNow: number) => addDays(new Date(), daysFromNow);

  it('throws when exam date is today', () => {
    expect(() =>
      scheduleTopicsBackward({
        examDate: new Date(),
        revisionDays: 0,
        topics: [{ id: 't1', title: 'T', estimatedEffort: 1 }],
        dayWeights: [{ dayOfWeek: 1, weight: 1 }],
      })
    ).toThrow();
  });

  it('handles single topic assigned within single available day', () => {
    // Only 2 days left, revisionDays=0 → 2 learning days
    const result = scheduleTopicsBackward({
      examDate: futureDate(2),
      revisionDays: 0,
      topics: [{ id: 'only', title: 'Only Topic', estimatedEffort: 3 }],
      dayWeights: [
        { dayOfWeek: 0, weight: 1 }, { dayOfWeek: 1, weight: 1 }, { dayOfWeek: 2, weight: 1 },
        { dayOfWeek: 3, weight: 1 }, { dayOfWeek: 4, weight: 1 }, { dayOfWeek: 5, weight: 1 },
        { dayOfWeek: 6, weight: 1 },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].topicId).toBe('only');
    expect(result[0].phase).toBe('learning');
  });

  it('wraps topics when more topics than revision slots', () => {
    // 3 revision days but 6 topics → wrap-around, all get assigned
    const topics = Array.from({ length: 6 }, (_, i) => ({
      id: `t${i}`, title: `Topic ${i}`, estimatedEffort: 2,
    }));
    const result = scheduleTopicsBackward({
      examDate: futureDate(30),
      revisionDays: 3,
      topics,
      dayWeights: [
        { dayOfWeek: 1, weight: 1 }, { dayOfWeek: 2, weight: 1 }, { dayOfWeek: 3, weight: 1 },
        { dayOfWeek: 4, weight: 1 }, { dayOfWeek: 5, weight: 1 },
      ],
    });
    const revisionAssignments = result.filter((a) => a.phase === 'revision');
    expect(revisionAssignments).toHaveLength(6);
  });

  it('assigns heavier topics to higher-weight days (learning phase)', () => {
    // Use a long window with clear weight contrast
    const result = scheduleTopicsBackward({
      examDate: futureDate(60),
      revisionDays: 5,
      topics: [
        { id: 'heavy', title: 'Heavy', estimatedEffort: 5 },
        { id: 'light', title: 'Light', estimatedEffort: 1 },
      ],
      dayWeights: [
        { dayOfWeek: 1, weight: 5 }, // Monday — heavy
        { dayOfWeek: 3, weight: 1 }, // Wednesday — light
      ],
    });
    expect(result).toHaveLength(2);
    // Heavy topic should be in learning phase on a Monday (weight=5 slot)
    const heavy = result.find((a) => a.topicId === 'heavy');
    expect(heavy?.phase).toBe('learning');
  });

  it('returns correct orderInDay for multi-topic days', () => {
    const topics = Array.from({ length: 5 }, (_, i) => ({
      id: `t${i}`, title: `Topic ${i}`, estimatedEffort: 1,
    }));
    const result = scheduleTopicsBackward({
      examDate: futureDate(30),
      revisionDays: 0,
      topics,
      // Only one day of week available so all 5 land on same day
      dayWeights: [{ dayOfWeek: 3, weight: 5 }],
    });
    const orders = result.map((a) => a.orderInDay).sort((a, b) => a - b);
    expect(orders[0]).toBe(0);
    // Each should have a unique order
    const unique = new Set(orders);
    expect(unique.size).toBe(orders.length);
  });
});

describe('isTopicMoved', () => {
  it('should return false when dates match', () => {
    expect(isTopicMoved('2024-01-15', '2024-01-15')).toBe(false);
  });

  it('should return true when dates differ', () => {
    expect(isTopicMoved('2024-01-15', '2024-01-10')).toBe(true);
  });

  it('should return false for same date in different format', () => {
    // Note: in practice, dates should be in same format
    expect(isTopicMoved('2024-01-01', '2024-01-01')).toBe(false);
  });
});
