'use server';

import { createServiceRoleClient } from '@/lib/supabase/service';
import { getCurrentUser } from '@/lib/auth/current-user';
import { revalidatePath } from 'next/cache';

export type AjouterAgentState = { error?: string; success?: boolean };

/**
 * Ajoute un nouvel agent — réservé à l'admin principal (est_admin_principal),
 * cohérent avec la politique RLS teacher_manage_principal_only (migration
 * 0002). Ce contrôle applicatif est redondant avec RLS par sécurité, pas un
 * remplacement : le client service-role contourne RLS, donc c'est ce
 * contrôle-ci qui protège réellement l'action.
 */
export async function ajouterAgent(_prev: AjouterAgentState, formData: FormData): Promise<AjouterAgentState> {
  const user = await getCurrentUser();
  if (user.role !== 'agent' || !user.estAdminPrincipal) {
    return { error: "Seul l'administrateur principal peut ajouter un agent." };
  }

  const nomComplet = formData.get('nom_complet') as string;
  const email = formData.get('email_professionnel') as string;
  const estAdmin = formData.get('est_admin') === 'on';
  const motDePasseTemporaire = formData.get('mot_de_passe') as string;

  if (!nomComplet || !email || !motDePasseTemporaire) {
    return { error: 'Veuillez renseigner tous les champs.' };
  }

  const service = createServiceRoleClient();

  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email,
    password: motDePasseTemporaire,
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    return { error: authError?.message ?? 'Impossible de créer le compte.' };
  }

  const { error: teacherError } = await service.from('teacher').insert({
    nom_complet: nomComplet,
    email_professionnel: email,
    auth_user_id: authUser.user.id,
    est_admin: estAdmin,
  });

  if (teacherError) {
    return { error: "Impossible d'enregistrer l'agent (email peut-être déjà utilisé)." };
  }

  revalidatePath('/agent/agents');
  return { success: true };
}

/**
 * Accorde le statut d'admin principal à un second agent, sans retirer le
 * premier — jusqu'à deux à la fois (migration 0016). Permet une vraie
 * redondance en cas d'indisponibilité de l'un des deux (accident,
 * mutation, incapacité), sans dépendre d'une action de la personne
 * devenue injoignable.
 */
export async function ajouterAdminPrincipal(agentId: string): Promise<AjouterAgentState> {
  const user = await getCurrentUser();
  if (user.role !== 'agent' || !user.estAdminPrincipal) {
    return { error: "Seul l'administrateur principal peut accorder ce statut." };
  }

  const service = createServiceRoleClient();
  const { error } = await service.rpc('ajouter_admin_principal', { p_agent_id: agentId });

  if (error) {
    return { error: error.message.includes('deux') ? error.message : "Impossible d'accorder ce statut." };
  }

  revalidatePath('/agent/agents');
  return { success: true };
}

/**
 * Retire le statut d'admin principal d'un agent — refusé si ça ferait
 * tomber le nombre total à zéro (migration 0016).
 */
export async function retirerAdminPrincipal(agentId: string): Promise<AjouterAgentState> {
  const user = await getCurrentUser();
  if (user.role !== 'agent' || !user.estAdminPrincipal) {
    return { error: "Seul l'administrateur principal peut retirer ce statut." };
  }

  const service = createServiceRoleClient();
  const { error } = await service.rpc('retirer_admin_principal', { p_agent_id: agentId });

  if (error) {
    return { error: error.message.includes('dernier') ? error.message : 'Impossible de retirer ce statut.' };
  }

  revalidatePath('/agent/agents');
  return { success: true };
}

/**
 * Active ou désactive un agent — un agent désactivé ne peut plus se
 * connecter (voir lib/auth/current-user.ts), sans supprimer aucune
 * donnée. C'est l'alternative sûre à la suppression quand un agent a
 * déjà des demandes ou des documents à son nom : le supprimer casserait
 * cet historique, le désactiver le préserve tout en lui coupant l'accès.
 */
export async function basculerActifAgent(agentId: string, actif: boolean): Promise<AjouterAgentState> {
  const user = await getCurrentUser();
  if (user.role !== 'agent' || !user.estAdminPrincipal) {
    return { error: "Seul l'administrateur principal peut modifier ce statut." };
  }

  const service = createServiceRoleClient();
  const { data: cible } = await service.from('teacher').select('est_admin_principal').eq('id', agentId).single();

  if (!actif && cible?.est_admin_principal) {
    return { error: "Impossible de désactiver un compte qui détient encore le statut d'admin principal — retirez-le d'abord." };
  }

  const { error } = await service.from('teacher').update({ actif }).eq('id', agentId);
  if (error) {
    return { error: 'Impossible de modifier ce statut.' };
  }

  revalidatePath('/agent/agents');
  return { success: true };
}

/**
 * Supprime définitivement le compte d'un agent — action irréversible,
 * réservée à l'admin principal. Refusée pour un agent qui détient
 * encore le statut d'admin principal : il faut d'abord le lui retirer.
 *
 * Si l'agent est référencé par des demandes existantes
 * (agent_assigne_id / agent_validateur_id), ces références sont
 * réaffectées à l'admin principal qui effectue la suppression, avant de
 * supprimer réellement le compte — aucune demande ni aucun document
 * n'est supprimé au passage, seule l'attribution change. Adapté à des
 * comptes de test qu'on veut réellement faire disparaître ; sur un
 * compte ayant un historique qu'on tient à conserver tel quel, la
 * désactivation reste préférable à la suppression.
 */
export async function supprimerCompteAgent(agentId: string): Promise<AjouterAgentState> {
  const user = await getCurrentUser();
  if (user.role !== 'agent' || !user.estAdminPrincipal) {
    return { error: "Seul l'administrateur principal peut supprimer un compte." };
  }

  const service = createServiceRoleClient();
  const { data: cible } = await service
    .from('teacher')
    .select('est_admin_principal, auth_user_id')
    .eq('id', agentId)
    .single();

  if (cible?.est_admin_principal) {
    return { error: "Impossible de supprimer un compte qui détient encore le statut d'admin principal — retirez-le d'abord." };
  }

  // Réaffectation avant suppression — jamais l'inverse, pour ne jamais
  // laisser une demande sans agent assigné même un instant.
  await service.from('internship_request').update({ agent_assigne_id: user.teacherId }).eq('agent_assigne_id', agentId);
  await service.from('internship_request').update({ agent_validateur_id: user.teacherId }).eq('agent_validateur_id', agentId);

  const { error: teacherError } = await service.from('teacher').delete().eq('id', agentId);
  if (teacherError) {
    if (teacherError.code === '23503' || teacherError.message.includes('foreign key')) {
      return {
        error:
          "Impossible de supprimer ce compte : une référence n'a pas pu être réaffectée. Désactivez-le plutôt — ça lui coupe l'accès sans casser l'historique.",
      };
    }
    return { error: 'Impossible de supprimer ce compte.' };
  }

  if (cible?.auth_user_id) {
    await service.auth.admin.deleteUser(cible.auth_user_id);
  }

  revalidatePath('/agent/agents');
  return { success: true };
}
