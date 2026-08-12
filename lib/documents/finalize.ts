import { createServiceRoleClient } from '@/lib/supabase/service';
import { generateDocumentPdfs } from '@/lib/pdf/documents';
import { generateReferences } from '@/lib/pdf/reference';
import { envoyerEmailDocumentsPrets } from '@/lib/email/send';

type FinaliserResult = { error?: string; success?: boolean; warning?: string };

type IdentiteInstitutionnelleRow = {
  etablissement: string | null;
  service: string | null;
  signataire: string | null;
  fonction: string | null;
  email_professionnel: string | null;
  telephone: string | null;
  signature_image_path: string | null;
  cachet_image_path: string | null;
  combined_image_path: string | null;
  authentication_mode: string | null;
};

/**
 * Génère les deux documents d'une demande, les dépose dans le stockage,
 * fait passer la demande à 'validee', envoie l'email. Utilisée par un
 * agent (validerDemande, agentId renseigné) ou par la génération
 * automatique à la soumission (agentId = null — jamais d'attribution à un
 * agent qui n'a rien fait, cohérent avec le principe déjà appliqué à la
 * validation différée : acteur_type = 'systeme' si aucun agent).
 */
export async function finaliserDemande(requestId: string, agentId: string | null): Promise<FinaliserResult> {
  try {
    return await finaliserDemandeInterne(requestId, agentId);
  } catch (e) {
    // Filet de sécurité final — n'importe quelle exception non prévue
    // (réseau, Supabase, autre) doit toujours revenir comme un résultat
    // propre, jamais comme une exception qui plante toute la page ou
    // laisse une génération automatique échouer en silence. Le détail
    // complet part dans les journaux serveur (Netlify), seul endroit où
    // la cause exacte sera visible.
    console.error('finaliserDemande a échoué de façon inattendue', {
      requestId,
      agentId,
      erreur: e instanceof Error ? { message: e.message, stack: e.stack } : e,
    });
    return { error: 'Une erreur inattendue est survenue pendant la génération des documents.' };
  }
}

async function finaliserDemandeInterne(requestId: string, agentId: string | null): Promise<FinaliserResult> {
  const service = createServiceRoleClient();

  const { data: req, error: reqError } = await service
    .from('internship_request')
    .select(
      `id, statut,
       student:student_id ( nom_complet, numero_ine, telephone, email_personnel ),
       academic_assignment:academic_assignment_id (
         program:program_id ( nom, departement ),
         level:level_id ( libelle ),
         academic_year:academic_year_id ( libelle )
       )`,
    )
    .eq('id', requestId)
    .single();

  if (reqError || !req) {
    return { error: 'Demande introuvable.' };
  }
  if (req.statut !== 'en_attente') {
    return { error: 'Cette demande a déjà été traitée.' };
  }

  const { data: settings } = await service.from('settings').select('duree_validite_document_mois').single();
  const dureeValiditeMois = settings?.duree_validite_document_mois ?? 3;

  // Lecture de l'identité avec compatibilité ascendante : si la migration
  // 0024 n'est pas encore appliquée, l'ancienne image de signature est
  // traitée comme une image combinée afin d'éviter une panne au déploiement.
  let identiteRow: IdentiteInstitutionnelleRow | null = null;
  const { data: identiteV23, error: identiteV23Error } = await service
    .from('identite_institutionnelle')
    .select('etablissement, service, signataire, fonction, email_professionnel, telephone, signature_image_path, cachet_image_path, combined_image_path, authentication_mode')
    .single();

  if (!identiteV23Error && identiteV23) {
    identiteRow = identiteV23 as IdentiteInstitutionnelleRow;
  } else {
    const { data: legacy } = await service
      .from('identite_institutionnelle')
      .select('etablissement, service, signataire, fonction, email_professionnel, telephone, signature_image_path')
      .single();
    if (legacy) {
      identiteRow = {
        ...legacy,
        cachet_image_path: null,
        combined_image_path: legacy.signature_image_path,
        authentication_mode: legacy.signature_image_path ? 'combined' : 'separate',
      };
    }
  }

  const authenticationMode: 'separate' | 'combined' =
    identiteRow?.authentication_mode === 'combined' ? 'combined' : 'separate';

  async function downloadImage(storagePath: string | null | undefined) {
    if (!storagePath) return undefined;
    const { data: blob, error } = await service.storage.from('documents').download(storagePath);
    if (error || !blob) return undefined;
    return Buffer.from(await blob.arrayBuffer());
  }

  const [signatureImageBuffer, cachetImageBuffer, combinedImageBuffer] = await Promise.all([
    downloadImage(identiteRow?.signature_image_path),
    downloadImage(identiteRow?.cachet_image_path),
    downloadImage(identiteRow?.combined_image_path),
  ]);

  if (authenticationMode === 'separate' && (!signatureImageBuffer || !cachetImageBuffer)) {
    return { error: 'La signature et le cachet doivent être configurés dans Identité institutionnelle avant la génération des documents.' };
  }
  if (authenticationMode === 'combined' && !combinedImageBuffer) {
    return { error: "L'image Signature + Cachet doit être configurée dans Identité institutionnelle avant la génération des documents." };
  }

  const identite = {
    etablissement: identiteRow?.etablissement ?? 'Université de Labé',
    service: identiteRow?.service ?? "Service Conseil et Aide à l'Insertion Professionnelle",
    signataire: identiteRow?.signataire ?? 'Dr Amara KEITA',
    fonction: identiteRow?.fonction ?? 'Chef du SCAIP-UL',
    emailProfessionnel: identiteRow?.email_professionnel ?? 'amara.keita@univ-labe.edu.gn',
    telephone: identiteRow?.telephone ?? '+224 61131 08 01 / +224 622370191',
    authenticationMode,
    signatureImageBuffer,
    cachetImageBuffer,
    combinedImageBuffer,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const student = req.student as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignment = req.academic_assignment as any;

  let refs;
  try {
    refs = await generateReferences(service);
  } catch {
    return { error: 'Impossible de générer le numéro de dossier.' };
  }

  const dateEmission = new Date();

  const paramsGeneration = {
    fields: {
      nom: student.nom_complet,
      ine: student.numero_ine,
      departement: assignment.program?.departement ?? '',
      filiere: assignment.program?.nom ?? '',
      niveau: assignment.level?.libelle ?? '',
      annee: assignment.academic_year?.libelle ?? '',
      contact: student.telephone ?? student.email_personnel,
    },
    referenceA: refs.referenceA,
    referenceR: refs.referenceR,
    dureeValiditeMois,
    dateEmission,
  };

  let autorisationBuffer: Buffer;
  let recommandationBuffer: Buffer;
  let documentsStageBuffer: Buffer;
  try {
    ({ autorisationBuffer, recommandationBuffer, documentsStageBuffer } = await generateDocumentPdfs({ ...paramsGeneration, identite }));
  } catch (e) {
    console.error('Échec du rendu PDF avec les images d’authentification', {
      requestId,
      erreur: e instanceof Error ? { message: e.message, stack: e.stack } : e,
    });
    return { error: "Impossible de générer le PDF : vérifiez les images de signature et de cachet configurées." };
  }

  const dateExpiration = new Date(dateEmission);
  dateExpiration.setMonth(dateExpiration.getMonth() + dureeValiditeMois);
  const dateExpirationStr = dateExpiration.toISOString().slice(0, 10);

  const pathA = `${requestId}/autorisation.pdf`;
  const pathR = `${requestId}/recommandation.pdf`;
  const pathDocumentsStage = `${requestId}/documents-stage.pdf`;

  const [uploadA, uploadR, uploadDocumentsStage] = await Promise.all([
    service.storage.from('documents').upload(pathA, autorisationBuffer, { contentType: 'application/pdf', upsert: true }),
    service.storage.from('documents').upload(pathR, recommandationBuffer, { contentType: 'application/pdf', upsert: true }),
    service.storage.from('documents').upload(pathDocumentsStage, documentsStageBuffer, { contentType: 'application/pdf', upsert: true }),
  ]);

  if (uploadA.error || uploadR.error || uploadDocumentsStage.error) {
    return { error: "Échec du dépôt des documents dans le stockage (bucket 'documents' à créer)." };
  }

  // L'insertion Document est bloquée si delivrance_suspendue = true
  // (trigger de la migration 0003) — l'erreur remonte telle quelle.
  const { error: docError } = await service.from('document').insert([
    { internship_request_id: requestId, type: 'autorisation', reference: refs.referenceA, date_expiration: dateExpirationStr, fichier_pdf: pathA },
    { internship_request_id: requestId, type: 'recommandation', reference: refs.referenceR, date_expiration: dateExpirationStr, fichier_pdf: pathR },
  ]);

  if (docError) {
    return { error: docError.message.includes('suspendue') ? 'Délivrance de documents actuellement suspendue par un administrateur.' : "Impossible d'enregistrer les documents." };
  }

  await service
    .from('internship_request')
    .update({ statut: 'validee', date_traitement: new Date().toISOString(), agent_validateur_id: agentId })
    .eq('id', requestId);

  await service.from('activity_log').insert([
    {
      type_evenement: 'demande_validee',
      acteur_type: agentId ? 'teacher' : 'systeme',
      acteur_id: agentId,
      entite_concernee_type: 'internship_request',
      entite_concernee_id: requestId,
    },
    {
      type_evenement: 'document_genere',
      acteur_type: agentId ? 'teacher' : 'systeme',
      acteur_id: agentId,
      entite_concernee_type: 'document',
      entite_concernee_id: requestId,
      details: `${refs.referenceA} + ${refs.referenceR}`,
    },
  ]);

  // L'échec de l'envoi d'email ne doit pas faire échouer la finalisation
  // elle-même — les documents sont déjà générés et valides à ce stade.
  try {
    await envoyerEmailDocumentsPrets({
      destinataire: student.email_personnel,
      dureeValiditeMois,
      documentsStageBuffer,
    });
  } catch (e) {
    console.error('Échec de l’envoi SMTP après validation', {
      requestId,
      destinataire: student.email_personnel,
      erreur: e instanceof Error ? { message: e.message, stack: e.stack } : e,
    });
    return {
      success: true,
      warning: "Les documents ont été générés, mais l'email n'a pas pu être envoyé. Vérifiez les variables SMTP dans Netlify.",
    };
  }

  return { success: true };
}
