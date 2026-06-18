import { supabase } from './supabase';

export interface TodoCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  is_completed: boolean;
  timer_minutes: number | null;
  category_id: string | null;
  deadline: string | null;
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

export async function updateTodo(id: string, updates: Partial<Pick<Todo, 'title' | 'is_completed' | 'timer_minutes' | 'category_id' | 'deadline'>>): Promise<Todo> {
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

export async function clearCompletedTodos(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('todos').delete().in('id', ids);
  if (error) throw error;
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<TodoCategory[]> {
  const { data, error } = await supabase
    .from('todo_categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createCategory(name: string, color: string): Promise<TodoCategory> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: existing } = await supabase
    .from('todo_categories')
    .select('sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextOrder = existing ? existing.sort_order + 1 : 0;

  const { data, error } = await supabase
    .from('todo_categories')
    .insert({ user_id: user.id, name: name.trim(), color, sort_order: nextOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  // ON DELETE SET NULL moves the category's todos to uncategorized automatically
  const { error } = await supabase.from('todo_categories').delete().eq('id', id);
  if (error) throw error;
}

export async function updateCategoryName(id: string, name: string): Promise<TodoCategory> {
  const { data, error } = await supabase
    .from('todo_categories')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
