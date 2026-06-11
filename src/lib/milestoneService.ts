import { supabase } from './supabase';

export interface Milestone {
  id: string;
  user_id: string;
  title: string;
  target_date: string;
  created_at: string;
}

export async function getMilestones(): Promise<Milestone[]> {
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .order('target_date', { ascending: true });

  if (error) throw error;
  return data;
}

export async function createMilestone(title: string, targetDate: string): Promise<Milestone> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('milestones')
    .insert({
      user_id: user.id,
      title,
      target_date: targetDate,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMilestone(id: string, updates: Partial<Pick<Milestone, 'title' | 'target_date'>>): Promise<Milestone> {
  const { data, error } = await supabase
    .from('milestones')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMilestone(id: string): Promise<void> {
  const { error } = await supabase.from('milestones').delete().eq('id', id);
  if (error) throw error;
}
