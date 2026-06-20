import { supabase } from './supabase';
import { format, subDays } from 'date-fns';
import type { StudyStreak } from '../types/database';

export async function recordStudyActivity(topicsCompleted: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const today = format(new Date(), 'yyyy-MM-dd');

  if (topicsCompleted <= 0) {
    // Remove the record so today doesn't falsely count toward streak
    await supabase
      .from('study_streaks')
      .delete()
      .eq('user_id', user.id)
      .eq('study_date', today);
    return;
  }

  await supabase.from('study_streaks').upsert(
    { user_id: user.id, study_date: today, topics_completed: topicsCompleted },
    { onConflict: 'user_id,study_date' }
  );
}

export async function getStreakData(): Promise<{ streaks: StudyStreak[]; currentStreak: number; longestStreak: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { streaks: [], currentStreak: 0, longestStreak: 0 };

  const { data, error } = await supabase
    .from('study_streaks')
    .select('*')
    .eq('user_id', user.id)
    .order('study_date', { ascending: false })
    .limit(90);

  if (error || !data) return { streaks: [], currentStreak: 0, longestStreak: 0 };

  // Calculate current streak (consecutive days from today)
  let currentStreak = 0;
  const today = format(new Date(), 'yyyy-MM-dd');
  const studiedDates = new Set(data.filter((d) => d.topics_completed > 0).map((d) => d.study_date));

  // Check if studied today or yesterday (grace period)
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const startDay = studiedDates.has(today) ? today : studiedDates.has(yesterday) ? yesterday : null;

  if (startDay) {
    let checkDate = new Date(startDay);
    while (studiedDates.has(format(checkDate, 'yyyy-MM-dd'))) {
      currentStreak++;
      checkDate = subDays(checkDate, 1);
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  const sortedDates = [...studiedDates].sort();

  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
  }

  return { streaks: data, currentStreak, longestStreak };
}
