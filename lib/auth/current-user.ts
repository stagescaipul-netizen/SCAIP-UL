import { createClient } from '@/lib/supabase/server';

export type CurrentUser =
  | { role: 'agent'; teacherId: string; nomComplet: string; estAdmin: boolean; estAdminPrincipal: boolean }
  | { role: 'anonyme' };

/**
 * Résout le rôle de l'utilisateur connecté à partir de sa session Supabase.
 *
 * Seuls les agents et administrateurs (table teacher) ont une session —
 * l'étudiant n'en a jamais, il n'y a donc pas de rôle 'etudiant' ici. Voir
 * la note en tête de la migration 0002_auth_and_policies.sql.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { role: 'anonyme' };

  const { data: teacher } = await supabase
    .from('teacher')
    .select('id, nom_complet, est_admin, est_admin_principal, actif')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (teacher && teacher.actif) {
    return {
      role: 'agent',
      teacherId: teacher.id,
      nomComplet: teacher.nom_complet,
      estAdmin: teacher.est_admin,
      estAdminPrincipal: teacher.est_admin_principal,
    };
  }

  return { role: 'anonyme' };
}
