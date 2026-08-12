'use server';

import { createServiceRoleClient } from '@/lib/supabase/service';
import { headers } from 'next/headers';

const LIMITE_TENTATIVES = 8;
const FENETRE_MINUTES = 15;

async function ipAppelante() {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0].trim() ?? h.get('x-real-ip') ?? 'inconnue';
}

async function verifierLimite(service: ReturnType<typeof createServiceRoleClient>, contexte: string) {
  const ip = await ipAppelante();
  const { data: depasse } = await service.rpc('ip_depasse_la_limite', {
    p_ip: ip,
    p_max_tentatives: LIMITE_TENTATIVES,
    p_fenetre_minutes: FENETRE_MINUTES,
    p_contexte: contexte,
  });
  await service.from('submission_attempt').insert({ ip_address: ip, contexte });
  return Boolean(depasse);
}

export type StatutState = {
  error?: string;
  trouve?: boolean;
  nomEtudiant?: string;
  statut?: string;
  motifRefus?: string;
  peutTelecharger?: boolean;
  urlDocuments?: string;
};

/**
 * Accès étudiant sans compte : INE + email personnel saisi lors de la demande.
 * Le code de suivi reste conservé en base pour la traçabilité administrative,
 * mais n'est plus exposé ni utilisé comme moyen d'accès côté étudiant.
 */
export async function rechercherParIdentite(_prev: StatutState, formData: FormData): Promise<StatutState> {
  const service = createServiceRoleClient();

  if (await verifierLimite(service, 'suivi')) {
    return { error: 'Trop de tentatives. Merci de réessayer dans quelques minutes.' };
  }

  const ine = (formData.get('numero_ine') as string)?.trim().toUpperCase();
  const email = (formData.get('email_personnel') as string)?.trim().toLowerCase();

  if (!ine || !/^[A-Z]{4}[0-9]{10}$/.test(ine) || !email) {
    return { error: 'Renseignez un numéro INE valide et votre adresse email.' };
  }

  const { data: student } = await service
    .from('student')
    .select('id, nom_complet, numero_ine, email_personnel')
    .eq('numero_ine', ine)
    .ilike('email_personnel', email)
    .maybeSingle();

  if (!student) {
    return { error: 'Aucune demande ne correspond à ces informations.' };
  }

  const { data: req } = await service
    .from('internship_request')
    .select('id, statut, motif_refus, supprime_le, date_soumission')
    .eq('student_id', student.id)
    .is('supprime_le', null)
    .order('date_soumission', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!req) {
    return { error: 'Aucune demande ne correspond à ces informations.' };
  }

  let statutAffiche = req.statut;
  let peutTelecharger = req.statut === 'validee';

  if (req.statut === 'validee') {
    const { data: docs } = await service
      .from('document')
      .select('statut')
      .eq('internship_request_id', req.id);

    if (!docs || docs.length < 2 || docs.some((d) => d.statut === 'invalide_manuellement')) {
      statutAffiche = 'invalidee';
      peutTelecharger = false;
    }
  }

  let urlDocuments: string | undefined;
  if (peutTelecharger) {
    const pathDocumentsStage = `${req.id}/documents-stage.pdf`;
    const { data: url, error: urlError } = await service.storage
      .from('documents')
      .createSignedUrl(pathDocumentsStage, 300);

    if (!urlError && url?.signedUrl) {
      urlDocuments = url.signedUrl;
    } else {
      peutTelecharger = false;
    }
  }

  return {
    trouve: true,
    nomEtudiant: student.nom_complet,
    statut: statutAffiche,
    motifRefus: req.motif_refus ?? undefined,
    peutTelecharger,
    urlDocuments,
  };
}
