import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase avec la clé de service — contourne RLS entièrement.
 *
 * Usage strictement limité au code serveur qui agit pour le compte du
 * système lui-même (écriture dans ActivityLog avec acteur_type='systeme',
 * opérations de stockage sur les justificatifs). Ne jamais importer ce
 * fichier dans un Client Component ni exposer cette clé au navigateur.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
