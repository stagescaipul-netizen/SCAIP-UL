import { createBrowserClient } from '@supabase/ssr';

/**
 * Client Supabase pour les Client Components (navigateur).
 * Utilise la clé anonyme publique — les politiques RLS (migration 0002)
 * restent la seule ligne de défense réelle sur les données.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
