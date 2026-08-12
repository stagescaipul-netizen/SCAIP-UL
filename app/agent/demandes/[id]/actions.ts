'use server';

import { createServiceRoleClient } from '@/lib/supabase/service';
import { getCurrentUser } from '@/lib/auth/current-user';
import { finaliserDemande } from '@/lib/documents/finalize';
import { envoyerEmailRefus } from '@/lib/email/send';
import { revalidatePath } from 'next/cache';

export type ActionState = { error?: string; success?: boolean; warning?: string };

/**
 * Valide une demande — réservé à un agent connecté (session Supabase Auth
 * réelle), jamais à l'étudiant, qui n'a pas de session. Voir migration
 * 0002. La logique de génération elle-même est partagée avec le mode
 * automatique (lib/documents/finalize.ts), pour ne jamais la dupliquer.
 */
export async function validerDemande(requestId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (user.role !== 'agent') {
    return { error: 'Action réservée à un agent connecté.' };
  }

  // La validation manuelle utilise toujours le pipeline complet (PDF + stockage + email),
  // quel que soit le mode configuré : manuel, automatique ou différé.
  const result = await finaliserDemande(requestId, user.teacherId);
  if (result.success) {
    revalidatePath(`/agent/demandes/${requestId}`);
  }
  return result;
}

/**
 * Invalide manuellement les documents d'un dossier — toujours les deux
 * ensemble, jamais un seul. Ils sont générés ensemble, ils doivent être
 * retirés de la circulation ensemble (décision explicite du client).
 */
export async function invaliderDocuments(requestId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (user.role !== 'agent' || !user.estAdmin) {
    return { error: 'Action réservée aux administrateurs.' };
  }

  const service = createServiceRoleClient();
  const { error } = await service
    .from('document')
    .update({ statut: 'invalide_manuellement' })
    .eq('internship_request_id', requestId);

  if (error) {
    return { error: "Impossible d'invalider les documents." };
  }

  // Renseigné ici directement, pas par un déclencheur — c'est le seul
  // endroit qui connaît l'identité de l'agent au moment de l'action.
  await service
    .from('journal_demandes')
    .update({ invalide_par: user.nomComplet })
    .eq('request_id', requestId);

  await service.from('activity_log').insert({
    type_evenement: 'document_invalide_manuellement',
    acteur_type: 'teacher',
    acteur_id: user.teacherId,
    entite_concernee_type: 'internship_request',
    entite_concernee_id: requestId,
  });

  revalidatePath(`/agent/demandes/${requestId}`);
  return { success: true };
}

/**
 * Refuse une demande. Le motif est obligatoire — contrainte déjà testée
 * au niveau base (migration 0001).
 */
export async function refuserDemande(requestId: string, motif: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (user.role !== 'agent') {
    return { error: 'Action réservée à un agent connecté.' };
  }
  if (!motif || motif.trim().length === 0) {
    return { error: 'Le motif de refus est obligatoire.' };
  }

  const service = createServiceRoleClient();

  const { data: reqBefore } = await service
    .from('internship_request')
    .select('student:student_id ( email_personnel )')
    .eq('id', requestId)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const destinataire = (reqBefore?.student as any)?.email_personnel as string | undefined;

  const { error } = await service
    .from('internship_request')
    .update({ statut: 'refusee', motif_refus: motif, date_traitement: new Date().toISOString(), agent_validateur_id: user.teacherId })
    .eq('id', requestId)
    .eq('statut', 'en_attente');

  if (error) {
    return { error: 'Impossible de refuser cette demande.' };
  }

  await service.from('activity_log').insert({
    type_evenement: 'demande_refusee',
    acteur_type: 'teacher',
    acteur_id: user.teacherId,
    entite_concernee_type: 'internship_request',
    entite_concernee_id: requestId,
    details: motif,
  });

  if (destinataire) {
    try {
      await envoyerEmailRefus({ destinataire, motif });
    } catch {
      // Non bloquant — le refus reste enregistré même si l'email échoue.
    }
  }

  revalidatePath(`/agent/demandes/${requestId}`);
  return { success: true };
}

/**
 * Met une demande à la corbeille — réservé aux administrateurs. Ne
 * touche jamais au statut métier (validee / refusee / etc.), pour
 * pouvoir restaurer exactement l'état d'origine. Lève automatiquement
 * les contraintes "une demande en attente" / "un document valide à la
 * fois" pour cet étudiant (migration 0013).
 */
export async function mettreALaCorbeille(requestId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (user.role !== 'agent' || !user.estAdmin) {
    return { error: 'Action réservée aux administrateurs.' };
  }

  const service = createServiceRoleClient();
  const { error } = await service
    .from('internship_request')
    .update({ supprime_le: new Date().toISOString() })
    .eq('id', requestId);

  if (error) {
    return { error: 'Impossible de mettre cette demande à la corbeille.' };
  }

  await service.from('activity_log').insert({
    type_evenement: 'demande_mise_a_la_corbeille',
    acteur_type: 'teacher',
    acteur_id: user.teacherId,
    entite_concernee_type: 'internship_request',
    entite_concernee_id: requestId,
  });

  revalidatePath('/agent/demandes');
  revalidatePath('/agent/corbeille');
  revalidatePath(`/agent/demandes/${requestId}`);
  return { success: true };
}

/**
 * Restaure une demande depuis la corbeille — réservé aux administrateurs.
 */
export async function restaurerDemande(requestId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (user.role !== 'agent' || !user.estAdmin) {
    return { error: 'Action réservée aux administrateurs.' };
  }

  const service = createServiceRoleClient();
  const { error } = await service
    .from('internship_request')
    .update({ supprime_le: null })
    .eq('id', requestId);

  if (error) {
    return { error: 'Impossible de restaurer cette demande.' };
  }

  await service.from('activity_log').insert({
    type_evenement: 'demande_restauree',
    acteur_type: 'teacher',
    acteur_id: user.teacherId,
    entite_concernee_type: 'internship_request',
    entite_concernee_id: requestId,
  });

  revalidatePath('/agent/demandes');
  revalidatePath('/agent/corbeille');
  return { success: true };
}

/**
 * Supprime définitivement une demande et ses documents — réservé à
 * l'admin principal uniquement, jamais aux autres administrateurs.
 * Irréversible : contrairement à la mise à la corbeille, aucune
 * restauration possible après cette action.
 */
export async function supprimerDefinitivement(requestId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (user.role !== 'agent' || !user.estAdminPrincipal) {
    return { error: "Action réservée à l'administrateur principal." };
  }

  const service = createServiceRoleClient();

  const { error: docError } = await service.from('document').delete().eq('internship_request_id', requestId);
  if (docError) {
    return { error: 'Impossible de supprimer les documents associés.' };
  }

  const { error } = await service.from('internship_request').delete().eq('id', requestId);
  if (error) {
    return { error: 'Impossible de supprimer définitivement cette demande.' };
  }

  revalidatePath('/agent/corbeille');
  return { success: true };
}
