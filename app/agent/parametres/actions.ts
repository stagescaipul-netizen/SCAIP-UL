'use server';

import { createServiceRoleClient } from '@/lib/supabase/service';
import { getCurrentUser } from '@/lib/auth/current-user';
import { revalidatePath } from 'next/cache';

export type ParametresState = { error?: string; success?: boolean };

export async function mettreAJourParametres(_prev: ParametresState, formData: FormData): Promise<ParametresState> {
  const user = await getCurrentUser();
  if (user.role !== 'agent' || !user.estAdmin) {
    return { error: 'Action réservée aux administrateurs.' };
  }

  const dureeValidite = Number(formData.get('duree_validite_document_mois'));
  const dureeConservation = Number(formData.get('duree_conservation_dossier_mois'));
  const delivranceSuspendue = formData.get('delivrance_suspendue') === 'on';
  const modeGeneration = formData.get('mode_generation') as string;
  const delaiSaisi = formData.get('generation_differee_delai_minutes');

  if (!dureeValidite || !dureeConservation) {
    return { error: 'Veuillez renseigner des valeurs valides.' };
  }
  if (!['confirmation_obligatoire', 'differe', 'automatique'].includes(modeGeneration)) {
    return { error: 'Mode de génération invalide.' };
  }

  const service = createServiceRoleClient();
  const { data: current } = await service
    .from('settings')
    .select('id, generation_differee_delai_minutes')
    .single();

  if (!current) {
    return { error: 'Aucun enregistrement de paramètres trouvé.' };
  }

  // Le champ Délai est désactivé côté client tant que le mode "Différé"
  // n'est pas choisi — un champ désactivé n'est jamais envoyé dans le
  // formulaire. On n'exige donc une valeur que si ce mode est
  // effectivement sélectionné ; sinon on conserve la valeur déjà en base.
  let delaiMinutes = current.generation_differee_delai_minutes;
  if (modeGeneration === 'differe') {
    const valeur = Number(delaiSaisi);
    if (!valeur) {
      return { error: 'Veuillez renseigner un délai valide pour le mode différé.' };
    }
    delaiMinutes = valeur;
  }

  const { error } = await service
    .from('settings')
    .update({
      duree_validite_document_mois: dureeValidite,
      duree_conservation_dossier_mois: dureeConservation,
      delivrance_suspendue: delivranceSuspendue,
      mode_generation: modeGeneration,
      generation_differee_delai_minutes: delaiMinutes,
    })
    .eq('id', current.id);

  if (error) {
    return { error: 'Impossible de mettre à jour les paramètres.' };
  }

  revalidatePath('/agent/parametres');
  return { success: true };
}

export type AnneeState = { error?: string; success?: boolean };

export async function ajouterAnnee(_prev: AnneeState, formData: FormData): Promise<AnneeState> {
  const user = await getCurrentUser();
  if (user.role !== 'agent' || !user.estAdmin) {
    return { error: 'Action réservée aux administrateurs.' };
  }

  const libelle = (formData.get('libelle') as string)?.trim();
  const dateDebut = formData.get('date_debut') as string;
  const dateFin = formData.get('date_fin') as string;

  if (!libelle || !dateDebut || !dateFin) {
    return { error: 'Veuillez renseigner tous les champs.' };
  }
  if (dateFin <= dateDebut) {
    return { error: 'La date de fin doit être postérieure à la date de début.' };
  }

  const service = createServiceRoleClient();
  const { error } = await service.from('academic_year').insert({
    libelle,
    date_debut: dateDebut,
    date_fin: dateFin,
  });

  if (error) {
    return { error: error.message.includes('duplicate') ? 'Cette année existe déjà.' : "Impossible d'ajouter cette année." };
  }

  revalidatePath('/agent/parametres');
  return { success: true };
}
