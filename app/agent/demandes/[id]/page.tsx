import { getCurrentUser } from '@/lib/auth/current-user';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import RequestActions from './request-actions';
import InvalidateButton from './invalidate-button';
import TrashButton from './trash-button';

export const dynamic = 'force-dynamic';

const STATUT_LABEL: Record<string, string> = {
  en_attente: 'À vérifier',
  validee: 'Document généré',
  refusee: 'Refusée',
  annulee: 'Annulée',
};

const STATUT_STYLE: Record<string, string> = {
  en_attente: 'bg-amber-50 text-amber-700',
  validee: 'bg-emerald-50 text-emerald-700',
  refusee: 'bg-red-50 text-red-700',
  annulee: 'bg-slate-100 text-slate-500',
};

export default async function DemandeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (user.role !== 'agent') {
    redirect('/connexion');
  }

  const service = createServiceRoleClient();
  const { data: req } = await service
    .from('internship_request')
    .select(
      `id, statut, motif_refus, date_soumission, date_traitement, responsable_declare, verification_responsable, departement_verification_pose,
       student:student_id ( nom_complet, numero_ine, telephone, email_personnel, justificatif_inscription_fichier ),
       academic_assignment:academic_assignment_id (
         program:program_id ( nom, departement ),
         level:level_id ( libelle )
       )`,
    )
    .eq('id', id)
    .single();

  if (!req) {
    return <p className="text-sm text-slate-500">Demande introuvable.</p>;
  }

  const { data: docs } = await service
    .from('document')
    .select('type, reference, statut, fichier_pdf')
    .eq('internship_request_id', id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const student = req.student as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignment = req.academic_assignment as any;

  // Le stockage est privé — une URL signée temporaire est nécessaire
  // pour que l'agent puisse réellement ouvrir un fichier, justificatif
  // ou document déjà généré.
  let justificatifUrl: string | null = null;
  if (student?.justificatif_inscription_fichier) {
    const { data } = await service.storage
      .from('justificatifs')
      .createSignedUrl(student.justificatif_inscription_fichier, 3600);
    justificatifUrl = data?.signedUrl ?? null;
  }

  const docsAvecUrl = (docs ?? []).map((d) => ({ ...d, url: null as string | null }));

  let documentsStageUrl: string | null = null;
  if (docsAvecUrl.length > 0) {
    const { data } = await service.storage
      .from('documents')
      .createSignedUrl(`${id}/documents-stage.pdf`, 3600);
    documentsStageUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="max-w-2xl">
      <Link href="/agent/demandes" className="text-sm text-slate-500 hover:text-slate-700">
        ← Retour
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Demande de {student?.nom_complet}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUT_STYLE[req.statut] ?? ''}`}>
          {STATUT_LABEL[req.statut] ?? req.statut}
        </span>
      </div>

      {req.responsable_declare && (
        <div
          className={`mt-4 rounded-md p-3 text-sm ${
            req.verification_responsable === 'correspond'
              ? 'bg-emerald-50 text-emerald-700'
              : req.verification_responsable === 'ne_correspond_pas'
                ? 'bg-red-50 text-red-700'
                : 'bg-amber-50 text-amber-700'
          }`}
        >
          Question posée sur le département <strong>{req.departement_verification_pose}</strong> — responsable déclaré : <strong>{req.responsable_declare}</strong>
          {' — '}
          {req.verification_responsable === 'correspond' && 'correspond à la liste officielle.'}
          {req.verification_responsable === 'ne_correspond_pas' && 'ne correspond pas à la liste officielle — à vérifier.'}
          {req.verification_responsable === 'departement_inconnu' && 'département absent de la liste officielle — à vérifier manuellement.'}
        </div>
      )}

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div><span className="text-slate-500">Numéro INE</span><p className="font-medium text-slate-900">{student?.numero_ine}</p></div>
          <div><span className="text-slate-500">Téléphone</span><p className="font-medium text-slate-900">{student?.telephone}</p></div>
          <div><span className="text-slate-500">Département</span><p className="font-medium text-slate-900">{assignment?.program?.departement}</p></div>
          <div><span className="text-slate-500">Niveau</span><p className="font-medium text-slate-900">{assignment?.level?.libelle}</p></div>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <span className="text-slate-500">Justificatif d&apos;inscription</span>
          {justificatifUrl ? (
            <a
              href={justificatifUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex w-fit items-center gap-1.5 rounded-md bg-[#E9EEF1] px-3 py-2 text-sm font-semibold text-[#1F3B4D]"
            >
              Ouvrir le fichier
            </a>
          ) : (
            <p className="mt-1 text-sm text-slate-400">Aucun fichier déposé.</p>
          )}
        </div>
      </div>

      {req.statut === 'en_attente' && <RequestActions requestId={req.id} />}

      {req.statut === 'refusee' && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">Motif du refus : {req.motif_refus}</p>
      )}

      {docsAvecUrl.length > 0 && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Documents générés</h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {docsAvecUrl.map((d) => (
              <li key={d.reference} className="flex items-center justify-between py-2">
                <span className="text-slate-700">{d.type} — {d.reference}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      d.statut === 'invalide_manuellement'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {d.statut}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {documentsStageUrl && (
            <a
              href={documentsStageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex rounded-md bg-[#1F3B4D] px-3 py-2 text-sm font-semibold text-white"
            >
              Télécharger les 2 documents (PDF 2 pages)
            </a>
          )}
          <div className="mt-3 flex gap-2">
            {user.role === 'agent' && user.estAdmin && docsAvecUrl.every((d) => d.statut !== 'invalide_manuellement') && (
              <InvalidateButton requestId={req.id} />
            )}
            {user.role === 'agent' && user.estAdmin && <TrashButton requestId={req.id} />}
          </div>
        </div>
      )}

      {docsAvecUrl.length === 0 && user.role === 'agent' && user.estAdmin && (
        <div className="mt-4">
          <TrashButton requestId={req.id} />
        </div>
      )}
    </div>
  );
}
