import { getCurrentUser } from '@/lib/auth/current-user';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import IdentiteForm from './identite-form';

export const dynamic = 'force-dynamic';

type IdentiteRow = {
  etablissement: string;
  service: string;
  signataire: string;
  fonction: string;
  email_professionnel: string;
  telephone: string;
  signature_image_path: string | null;
  cachet_image_path: string | null;
  combined_image_path: string | null;
  authentication_mode: 'separate' | 'combined';
};

async function imageDataUrl(
  service: ReturnType<typeof createServiceRoleClient>,
  storagePath: string | null,
) {
  if (!storagePath) return null;
  const { data: blob, error } = await service.storage.from('documents').download(storagePath);
  if (error || !blob) return null;
  const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64');
  return `data:${blob.type || 'image/png'};base64,${base64}`;
}

export default async function IdentitePage() {
  const user = await getCurrentUser();
  if (user.role !== 'agent') redirect('/connexion');

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('identite_institutionnelle')
    .select(
      'etablissement, service, signataire, fonction, email_professionnel, telephone, signature_image_path, cachet_image_path, combined_image_path, authentication_mode',
    )
    .single();

  // Repli pour une base qui n'aurait pas encore reçu la migration 0024.
  let identite = data as IdentiteRow | null;
  if (error) {
    const { data: legacy } = await service
      .from('identite_institutionnelle')
      .select('etablissement, service, signataire, fonction, email_professionnel, telephone, signature_image_path')
      .single();
    if (legacy) {
      identite = {
        ...legacy,
        cachet_image_path: null,
        combined_image_path: legacy.signature_image_path,
        authentication_mode: legacy.signature_image_path ? 'combined' : 'separate',
      } as IdentiteRow;
    }
  }

  if (!identite) {
    return <p className="mt-4 text-sm text-red-600">Aucun enregistrement trouvé en base.</p>;
  }

  const [signatureUrl, cachetUrl, combinedUrl] = await Promise.all([
    imageDataUrl(service, identite.signature_image_path),
    imageDataUrl(service, identite.cachet_image_path),
    imageDataUrl(service, identite.combined_image_path),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Identité institutionnelle</h1>
      <p className="mt-1 text-sm text-slate-500">Informations et authentification visuelle reprises sur les nouveaux documents officiels.</p>

      <div className="mt-3 max-w-3xl rounded-md bg-amber-50 p-3 text-xs text-amber-800">
        <strong>Attention</strong> — toute modification affecte uniquement les <strong>nouveaux</strong> documents générés. Les documents déjà émis restent inchangés.
      </div>

      <IdentiteForm
        identite={identite}
        readOnly={!user.estAdmin}
        signatureExistanteUrl={signatureUrl}
        cachetExistantUrl={cachetUrl}
        combinedExistantUrl={combinedUrl}
      />
    </div>
  );
}
