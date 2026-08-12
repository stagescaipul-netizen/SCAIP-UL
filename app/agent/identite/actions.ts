'use server';

import { createServiceRoleClient } from '@/lib/supabase/service';
import { getCurrentUser } from '@/lib/auth/current-user';
import { revalidatePath } from 'next/cache';

export type IdentiteState = { error?: string; success?: boolean };
type Mode = 'separate' | 'combined';

async function uploadImage(
  service: ReturnType<typeof createServiceRoleClient>,
  file: File,
  prefix: string,
) {
  const ext = file.type === 'image/jpeg' ? 'jpg' : 'png';
  const path = `identite/${prefix}-${Date.now()}.${ext}`;
  const { error } = await service.storage.from('documents').upload(path, file, {
    contentType: file.type || 'image/png',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function mettreAJourIdentite(_prev: IdentiteState, formData: FormData): Promise<IdentiteState> {
  const user = await getCurrentUser();
  if (user.role !== 'agent' || !user.estAdmin) return { error: 'Action réservée aux administrateurs.' };

  const service = createServiceRoleClient();
  const { data: current, error: currentError } = await service
    .from('identite_institutionnelle')
    .select('id, signature_image_path, cachet_image_path, combined_image_path, authentication_mode')
    .single();

  if (currentError || !current) {
    return { error: "La migration 0024 doit être appliquée dans Supabase avant d'enregistrer l'authentification des documents." };
  }

  const mode = String(formData.get('authentication_mode') || current.authentication_mode || 'separate') as Mode;
  if (!['separate', 'combined'].includes(mode)) return { error: "Mode d'authentification invalide." };

  let signaturePath = current.signature_image_path as string | null;
  let cachetPath = current.cachet_image_path as string | null;
  let combinedPath = current.combined_image_path as string | null;

  const oldToRemove: string[] = [];

  const processImage = async (
    formName: string,
    deleteName: string,
    currentPath: string | null,
    prefix: string,
  ) => {
    let path = currentPath;
    const remove = formData.get(deleteName) === 'on';
    const file = formData.get(formName) as File | null;

    if (remove && path) {
      oldToRemove.push(path);
      path = null;
    }

    if (file && file.size > 0) {
      if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('FORMAT_IMAGE');
      if (file.size > 5 * 1024 * 1024) throw new Error('IMAGE_TROP_LOURDE');
      const newPath = await uploadImage(service, file, prefix);
      if (path && path !== newPath) oldToRemove.push(path);
      path = newPath;
    }
    return path;
  };

  try {
    signaturePath = await processImage('signature_image', 'supprimer_signature', signaturePath, 'signature');
    cachetPath = await processImage('cachet_image', 'supprimer_cachet', cachetPath, 'cachet');
    combinedPath = await processImage('combined_image', 'supprimer_combined', combinedPath, 'signature-cachet');
  } catch (e) {
    if (e instanceof Error && e.message === 'FORMAT_IMAGE') return { error: 'Seuls les fichiers PNG et JPEG sont acceptés.' };
    if (e instanceof Error && e.message === 'IMAGE_TROP_LOURDE') return { error: 'Chaque image doit peser au maximum 5 Mo.' };
    return { error: "Impossible de téléverser l'une des images." };
  }

  const { error } = await service
    .from('identite_institutionnelle')
    .update({
      etablissement: formData.get('etablissement'),
      service: formData.get('service'),
      signataire: formData.get('signataire'),
      fonction: formData.get('fonction'),
      email_professionnel: formData.get('email_professionnel'),
      telephone: formData.get('telephone'),
      authentication_mode: mode,
      signature_image_path: signaturePath,
      cachet_image_path: cachetPath,
      combined_image_path: combinedPath,
    })
    .eq('id', current.id);

  if (error) return { error: 'Impossible de mettre à jour ces informations.' };

  const uniqueOld = [...new Set(oldToRemove)].filter(
    (p) => p !== signaturePath && p !== cachetPath && p !== combinedPath,
  );
  if (uniqueOld.length) await service.storage.from('documents').remove(uniqueOld);

  revalidatePath('/agent/identite');
  return { success: true };
}
