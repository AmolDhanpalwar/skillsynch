import { supabase } from './db';

// Resolve the correct base URL based on the active DB provider.
// - Supabase: edge functions live at <SUPABASE_URL>/functions/v1/<slug>
// - MySQL:    equivalent routes live at <MYSQL_API_URL>/functions/v1/<slug>
const _provider = import.meta.env.VITE_DB_PROVIDER ?? 'supabase';
const BASE_URL = _provider === 'mysql'
  ? (import.meta.env.VITE_MYSQL_API_URL as string)
  : (import.meta.env.VITE_SUPABASE_URL as string);

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function callEdgeFn<T = unknown>(
  slug: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const authHeader = await getAuthHeader();
    const res = await fetch(`${BASE_URL}/functions/v1/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: (json as { error?: string }).error ?? `Request failed (${res.status})` };
    }
    return { data: json as T, error: null };
  } catch (err) {
    return { data: null, error: (err as Error).message };
  }
}
