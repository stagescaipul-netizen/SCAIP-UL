'use server';

import { createServiceRoleClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function deconnexion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/connexion');
}

export type ProfilState = { error?: string; success?: boolean };

/**
 * Permet à un agent de modifier son propre nom et, optionnellement, son
 * mot de passe. Ne touche jamais est_admin ni est_admin_principal — la
 * gouvernance des droits reste réservée à l'admin principal, page Agents.
 */
export async function mettreAJourProfil(_prev: ProfilState, formData: FormData): Promise<ProfilState> {
  const user = await getCurrentUser();
  if (user.role !== 'agent') {
    return { error: 'Session expirée, veuillez vous reconnecter.' };
  }

  const nomComplet = formData.get('nom_complet') as string;
  const nouveauMotDePasse = formData.get('nouveau_mot_de_passe') as string;

  if (!nomComplet) {
    return { error: 'Le nom est obligatoire.' };
  }
  if (nouveauMotDePasse && nouveauMotDePasse.length < 8) {
    return { error: 'Le nouveau mot de passe doit comporter au moins 8 caractères.' };
  }

  const service = createServiceRoleClient();

  const { error: teacherError } = await service
    .from('teacher')
    .update({ nom_complet: nomComplet })
    .eq('id', user.teacherId);

  if (teacherError) {
    return { error: 'Impossible de mettre à jour vos informations.' };
  }

  if (nouveauMotDePasse) {
    const supabase = await createClient();
    const { error: passwordError } = await supabase.auth.updateUser({ password: nouveauMotDePasse });
    if (passwordError) {
      return { error: 'Informations enregistrées, mais le mot de passe n\'a pas pu être changé.' };
    }
  }

  revalidatePath('/agent/profil');
  return { success: true };
}
