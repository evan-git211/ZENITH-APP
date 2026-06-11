import { supabase } from './supabase';

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  is_completed: boolean;
  timer_minutes: number | null;
  created_at: string;
}

export async function getTodos(): Promise<Todo[]> {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createTodo(title: string, timerMinutes?: number): Promise<Todo> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('todos')
    .insert({
      user_id: user.id,
      title,
      timer_minutes: timerMinutes ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTodo(id: string, updates: Partial<Pick<Todo, 'title' | 'is_completed' | 'timer_minutes'>>): Promise<Todo> {
  const updateData: Record<string, unknown> = updates;

  if (updates.is_completed) {
    updateData.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('todos')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase.from('todos').delete().eq('id', id);
  if (error) throw error;
}
