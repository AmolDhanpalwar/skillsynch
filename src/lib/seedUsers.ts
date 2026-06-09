import { supabase } from './db';

export async function seedUsersIfEmpty(): Promise<void> {
  try {
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (count && count > 0) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    await fetch(`${supabaseUrl}/functions/v1/seed-users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    // Seed is best-effort; don't block the app
  }
}
