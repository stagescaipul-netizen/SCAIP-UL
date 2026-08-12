import { createServiceRoleClient } from '@/lib/supabase/service';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

export default async function VerificationPage({
  params,
}: {
  params: Promise<{ reference: string[] }>;
}) {
  const { reference } = await params;
  const referenceComplete = reference.join('/');

  const service = createServiceRoleClient();
  const { data: doc } = await service
    .from('document')
    .select(
      `type, reference, date_emission, date_expiration, statut,
       internship_request:internship_request_id ( student:student_id ( nom_complet ) )`,
    )
    .eq('reference', referenceComplete)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const req = doc?.internship_request as any;

  const aujourdHui = new Date().toISOString().slice(0, 10);
  const expireLe = doc?.date_expiration as string | undefined;
  const statutEffectif = !doc
    ? null
    : doc.statut === 'invalide_manuellement'
      ? 'invalide_manuellement'
      : expireLe && expireLe < aujourdHui
        ? 'expire'
        : 'valide';

  const style =
    statutEffectif === 'valide'
      ? { bg: 'bg-emerald-600', label: '✓ Document valide' }
      : statutEffectif === 'expire'
        ? { bg: 'bg-slate-500', label: '✕ Document expiré' }
        : statutEffectif === 'invalide_manuellement'
          ? { bg: 'bg-red-600', label: '✕ Document invalidé' }
          : { bg: 'bg-slate-500', label: '✕ Référence inconnue' };

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Image
        src="/logo/universite-labe.png"
        alt="Université de Labé"
        width={489}
        height={129}
        className="mb-4 h-9 w-auto"
        priority
      />

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className={`${style.bg} px-5 py-4 text-center text-sm font-semibold text-white`}>
          {style.label}
        </div>

        <div className="bg-white p-5 text-sm">
          {doc ? (
            <div className="space-y-3">
              <Row label="Référence" value={doc.reference} />
              <Row label="Type de document" value={doc.type === 'autorisation' ? 'Autorisation de stage' : 'Lettre de recommandation'} />
              <Row label="Étudiant(e)" value={req?.student?.nom_complet ?? 'Non renseigné'} />
              <Row label="Émis le" value={doc.date_emission} />
              <Row label="Valable jusqu'au" value={doc.date_expiration} />
              <Row label="Émis par" value="Dr Amara KEITA / SCAIP-UL" />
            </div>
          ) : (
            <p className="text-slate-500">
              Aucun document ne correspond à cette référence. Si vous pensez qu&apos;il s&apos;agit
              d&apos;une erreur, contactez le SCAIP-UL directement.
            </p>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-center text-[11px] text-slate-500">
          Document certifié par le Service Conseil et Aide à l&apos;Insertion Professionnelle, Université de
          Labé.
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
