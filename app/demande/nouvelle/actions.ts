'use server';

import { createServiceRoleClient } from '@/lib/supabase/service';
import { headers } from 'next/headers';
import { finaliserDemande } from '@/lib/documents/finalize';

export type DemandeState = {
  error?: string;
  errorStep?: number;
  success?: boolean;
  urlDocuments?: string;
  generationWarning?: string;
};

const LIMITE_TENTATIVES = 5;
const FENETRE_MINUTES = 15;

/**
 * Traite la soumission du formulaire public de demande de stage.
 *
 * Aucune session n'est requise — l'étudiant est identifié par son numéro
 * INE, jamais par un compte. Ce code s'exécute avec la clé de service
 * (contourne RLS intentionnellement) car il n'existe pas de session
 * étudiante pour que les politiques RLS puissent s'appliquer. Voir la note
 * en tête de la migration 0002_auth_and_policies.sql.
 */
export async function submitDemande(
  _prevState: DemandeState,
  formData: FormData,
): Promise<DemandeState> {
  const nomComplet = formData.get('nom_complet') as string;
  const numeroIne = (formData.get('numero_ine') as string)?.trim().toUpperCase();
  const telephone = formData.get('telephone') as string;
  const emailPersonnel = formData.get('email_personnel') as string;
  const justificatif = formData.get('justificatif') as File | null;
  const departement = (formData.get('departement') as string)?.trim();
  const filiereProgramme = (formData.get('filiere_programme') as string)?.trim();
  const typeResponsableVerification = formData.get('type_responsable_verification') as string;
  const levelId = formData.get('level_id') as string;
  const academicYearId = formData.get('academic_year_id') as string;
  const certStatutEtudiant = formData.get('cert_statut_etudiant') === 'on';
  const certExactitude = formData.get('cert_exactitude') === 'on';
  const responsableDeclare = formData.get('responsable_declare') as string;
  const captchaToken = formData.get('h-captcha-response') as string;

  if (!nomComplet || !numeroIne || !emailPersonnel || !departement || !filiereProgramme || !levelId || !academicYearId || !responsableDeclare) {
    return { error: 'Veuillez renseigner tous les champs obligatoires.' };
  }
  if (!['chef_departement', 'directeur_programme'].includes(typeResponsableVerification)) {
    return { error: 'La question de vérification est invalide. Veuillez actualiser le formulaire.', errorStep: 4 };
  }
  if (!/^[A-Z]{4}[0-9]{10}$/.test(numeroIne)) {
    return { error: "Le numéro INE doit comporter 4 lettres suivies de 10 chiffres (ex. KOOA0307536419)." };
  }
  if (!certStatutEtudiant || !certExactitude) {
    return { error: 'Les deux certifications sont obligatoires pour soumettre la demande.' };
  }

  const service = createServiceRoleClient();

  // Limitation par adresse IP — vérifiée avant tout traitement.
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'inconnue';

  const { data: depasse } = await service.rpc('ip_depasse_la_limite', {
    p_ip: ip,
    p_max_tentatives: LIMITE_TENTATIVES,
    p_fenetre_minutes: FENETRE_MINUTES,
  });

  if (depasse) {
    return { error: 'Trop de tentatives récentes. Veuillez réessayer dans quelques minutes.' };
  }

  await service.from('submission_attempt').insert({ ip_address: ip });

  // Vérification hCaptcha — désactivée automatiquement tant que
  // HCAPTCHA_SECRET_KEY n'est pas configurée, pour permettre de tester le
  // reste sans dépendre de ce service externe. À retirer une fois les
  // vraies clés en place, pour ne pas rester ouvert en production.
  if (process.env.HCAPTCHA_SECRET_KEY) {
    if (!captchaToken) {
      return { error: 'Merci de valider la vérification anti-robot.' };
    }
    const captchaCheck = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.HCAPTCHA_SECRET_KEY,
        response: captchaToken,
      }),
    }).then((r) => r.json());

    if (!captchaCheck.success) {
      return { error: 'Vérification anti-robot invalide. Merci de réessayer.' };
    }
  }

  // 1. Étudiant : retrouver par numéro INE, ou créer.
  const { data: existingStudent } = await service
    .from('student')
    .select('id, statut_verification_compte')
    .eq('numero_ine', numeroIne)
    .maybeSingle();

  let studentId: string;
  const dejaVerifie = existingStudent?.statut_verification_compte === 'verifie';

  // L'INE reste l'identifiant stable, mais l'email utilisé pour retrouver une
  // demande doit correspondre aux coordonnées les plus récentes saisies par
  // l'étudiant. On actualise donc les informations de contact à chaque nouvelle
  // soumission d'un étudiant déjà connu.
  if (existingStudent) {
    await service
      .from('student')
      .update({ nom_complet: nomComplet, telephone, email_personnel: emailPersonnel })
      .eq('id', existingStudent.id);
  }

  if (existingStudent && dejaVerifie) {
    // Identité déjà vérifiée — pas de nouveau justificatif exigé (règle
    // confirmée : valable jusqu'à expiration du dernier document délivré,
    // pas de re-vérification à chaque demande).
    studentId = existingStudent.id;
  } else {
    // Première demande, ou compte existant mais pas encore vérifié : le
    // Un justificatif d'inscription valide est obligatoire dans les deux cas.
    if (!justificatif || justificatif.size === 0) {
      return { error: "Un justificatif d'inscription valide est obligatoire : attestation d'inscription, carte d'étudiant ou certificat de scolarité de l'année en cours." };
    }

    if (existingStudent) {
      studentId = existingStudent.id;
    } else {
      const { data: newStudent, error: studentError } = await service
        .from('student')
        .insert({
          nom_complet: nomComplet,
          numero_ine: numeroIne,
          telephone,
          email_personnel: emailPersonnel,
          statut_verification_compte: 'en_attente',
        })
        .select('id')
        .single();

      if (studentError || !newStudent) {
        return { error: 'Ce numéro INE est peut-être déjà enregistré.' };
      }
      studentId = newStudent.id;
    }

    // Dépôt du justificatif — le bucket 'justificatifs' doit exister côté
    // Supabase Storage (étape de configuration, hors périmètre du code).
    const path = `${studentId}/${Date.now()}-${justificatif.name}`;
    const { error: uploadError } = await service.storage
      .from('justificatifs')
      .upload(path, justificatif);

    if (!uploadError) {
      await service.from('student').update({ justificatif_inscription_fichier: path }).eq('id', studentId);
    }

    await service.from('activity_log').insert({
      type_evenement: 'compte_etudiant_soumis',
      acteur_type: 'student',
      entite_concernee_type: 'student',
      entite_concernee_id: studentId,
    });
  }

  // 2. Département et Filière/Programme saisis librement, séparément (pas
  // de liste exhaustive — demandé explicitement par le client). On
  // retrouve ou crée la ligne Program correspondante — recherche sur la
  // combinaison des deux, pas seulement le nom, pour éviter de confondre
  // deux filières homonymes rattachées à des départements différents.
  const { data: existingProgram } = await service
    .from('program')
    .select('id')
    .ilike('nom', filiereProgramme)
    .ilike('departement', departement)
    .maybeSingle();

  let programId: string;
  if (existingProgram) {
    programId = existingProgram.id;
  } else {
    const { data: newProgram, error: programError } = await service
      .from('program')
      .insert({ nom: filiereProgramme, departement })
      .select('id')
      .single();
    if (programError || !newProgram) {
      return { error: "Impossible d'enregistrer le département / la filière." };
    }
    programId = newProgram.id;
  }

  // 3. Rattachement académique de l'année — un seul par étudiant et par
  // année (contrainte testée en LOT 02).
  const { data: assignment, error: assignmentError } = await service
    .from('academic_assignment')
    .upsert(
      { student_id: studentId, program_id: programId, level_id: levelId, academic_year_id: academicYearId },
      { onConflict: 'student_id,academic_year_id' },
    )
    .select('id')
    .single();

  if (assignmentError || !assignment) {
    return { error: 'Impossible d\'enregistrer les informations académiques.' };
  }

  // Priorité à l'INE sur le nom du responsable, comme demandé : si les
  // deux problèmes se présentent à la fois, l'étudiant doit d'abord
  // savoir qu'il a déjà une demande en cours, pas se concentrer sur un
  // nom à corriger inutilement. Vérifié explicitement ici, avant le nom
  // — la contrainte en base (migrations 0004/0005/0013) reste le vrai
  // filet de sécurité dans tous les cas, cette vérification n'est que
  // pour donner la priorité au bon message.
  const { data: demandePendante } = await service
    .from('internship_request')
    .select('id')
    .eq('student_id', studentId)
    .eq('statut', 'en_attente')
    .is('supprime_le', null)
    .maybeSingle();

  if (demandePendante) {
    return {
      error: 'Vous avez déjà une demande en attente de traitement. Merci de patienter. Une nouvelle demande n\'est possible qu\'une fois celle-ci traitée (validée ou refusée).',
      errorStep: 1,
    };
  }

  const { data: demandesValidees } = await service
    .from('internship_request')
    .select('id')
    .eq('student_id', studentId)
    .eq('statut', 'validee')
    .is('supprime_le', null);

  if (demandesValidees && demandesValidees.length > 0) {
    const { data: documentEncoreValide } = await service
      .from('document')
      .select('id')
      .in('internship_request_id', demandesValidees.map((d) => d.id))
      .neq('statut', 'invalide_manuellement')
      .gte('date_expiration', new Date().toISOString().slice(0, 10))
      .limit(1)
      .maybeSingle();

    if (documentEncoreValide) {
      return {
        error: 'Vous avez déjà un document en cours de validité. Une nouvelle demande n\'est possible qu\'après son expiration, ou si le document en cours a été invalidé par le SCAIP-UL.',
        errorStep: 1,
      };
    }
  }

  // Vérification finale : la question porte sur le département réellement
  // renseigné par l'étudiant et varie entre chef de département et directeur
  // de programme. Le rôle demandé doit lui aussi correspondre : le nom du
  // directeur n'est pas accepté lorsqu'on demande le chef, et inversement.
  const normaliser = (valeur: string) =>
    valeur
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();

  const { data: responsables, error: responsablesError } = await service
    .from('department_head')
    .select('departement, chef_departement, directeur_programme');

  if (responsablesError) {
    return {
      error: 'Impossible de vérifier le responsable du département pour le moment. Veuillez réessayer.',
      errorStep: 4,
    };
  }

  const responsableOfficiel = (responsables ?? []).find(
    (row) => normaliser(row.departement) === normaliser(departement),
  );

  if (!responsableOfficiel) {
    return {
      error: `Le département « ${departement} » n'est pas reconnu dans le référentiel officiel. Vérifiez son orthographe.`,
      errorStep: 2,
    };
  }

  const nomAttendu =
    typeResponsableVerification === 'chef_departement'
      ? responsableOfficiel.chef_departement
      : responsableOfficiel.directeur_programme;

  const verifResult =
    normaliser(responsableDeclare) === normaliser(nomAttendu)
      ? 'correspond'
      : 'ne_correspond_pas';

  if (verifResult !== 'correspond') {
    const roleLisible =
      typeResponsableVerification === 'chef_departement'
        ? 'chef(fe) de département'
        : 'directeur(trice) de programme';
    return {
      error: `Le nom renseigné ne correspond pas au/à la ${roleLisible} officiel(le) du département « ${departement} ».`,
      errorStep: 4,
    };
  }

  // 4. La demande elle-même — les deux documents seront générés ensemble,
  // soit par un agent, soit automatiquement selon le mode configuré
  // (voir migration 0012 — confirmation obligatoire par défaut).
  //
  // L'étudiant ne choisit plus de destinataire (toujours affiché comme
  // "SCAIP-UL") — la colonne agent_assigne_id reste obligatoire en base
  // mais n'a plus de rôle de filtrage, elle est renseignée ici avec
  // n'importe quel admin principal.
  const { data: adminPrincipal } = await service
    .from('teacher')
    .select('id')
    .eq('est_admin_principal', true)
    .eq('actif', true)
    .limit(1)
    .single();

  if (!adminPrincipal) {
    return { error: "Impossible d'enregistrer la demande. Aucun administrateur principal n'est configuré." };
  }

  const { data: newRequest, error: requestError } = await service
    .from('internship_request')
    .insert({
      student_id: studentId,
      academic_assignment_id: assignment.id,
      agent_assigne_id: adminPrincipal.id,
      responsable_declare: responsableDeclare,
      departement_verification_pose: departement,
      verification_responsable: verifResult,
      certification_exactitude_horodatage: new Date().toISOString(),
      certification_statut_etudiant_horodatage: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (requestError || !newRequest) {
    const msg = requestError?.message ?? '';
    const code = requestError?.code ?? '';

    // Filet de sécurité pour le rare cas où une demande concurrente
    // serait passée entre la vérification explicite ci-dessus et cette
    // insertion — la contrainte en base reste la vraie protection.
    // Détection par code d'erreur standard en plus du texte, au cas où
    // PostgREST reformule le message avant qu'il n'arrive ici.
    const estDoublonEnAttente = code === '23505' || msg.includes('internship_request_one_pending_per_student');
    const estDocumentValide = code === 'P0001' || msg.includes('document valide existe déjà');

    if (estDoublonEnAttente) {
      return {
        error:
          'Vous avez déjà une demande en attente de traitement. Merci de patienter. Une nouvelle demande n\'est possible qu\'une fois celle-ci traitée (validée ou refusée).',
        errorStep: 1,
      };
    }

    if (estDocumentValide) {
      return {
        error:
          'Vous avez déjà un document en cours de validité. Une nouvelle demande n\'est possible qu\'après son expiration, ou si le document en cours a été invalidé par le SCAIP-UL.',
        errorStep: 1,
      };
    }

    return { error: 'Impossible d\'enregistrer la demande. Veuillez réessayer ou contacter le SCAIP-UL si le problème persiste.', errorStep: 4 };
  }

  const { data: modeSettings } = await service.from('settings').select('mode_generation').single();
  const modeAutomatique = modeSettings?.mode_generation === 'automatique';
  let generationWarning: string | undefined;

  // En mode automatique, la génération fait partie du parcours de soumission :
  // on ATTEND réellement sa fin avant d'afficher l'écran de confirmation.
  // Auparavant le résultat de finaliserDemande était ignoré, ce qui pouvait
  // laisser un bouton gris alors que l'étudiant s'attend à un téléchargement
  // immédiat.
  if (modeAutomatique) {
    const resultatGeneration = await finaliserDemande(newRequest.id, null);
    if (resultatGeneration.error) {
      console.error('Génération automatique non finalisée après soumission', {
            erreur: resultatGeneration.error,
      });
      generationWarning =
        'Votre dossier a bien été transmis, mais la génération automatique des documents n’a pas abouti. Le SCAIP-UL peut le traiter sans nouvelle soumission.';
    }
  }

  // En mode automatique réussi, le PDF regroupé existe déjà. On signe
  // directement SON chemin au lieu de dépendre d'une relecture de la table
  // document, ce qui évite un faux état « indisponible » juste après upload.
  let urlDocuments: string | undefined;
  if (modeAutomatique && !generationWarning) {
    const pathDocumentsStage = `${newRequest.id}/documents-stage.pdf`;
    const { data: signeDocuments, error: signeError } = await service.storage
      .from('documents')
      .createSignedUrl(pathDocumentsStage, 300);

    if (!signeError && signeDocuments?.signedUrl) {
      urlDocuments = signeDocuments.signedUrl;
    } else {
      generationWarning =
        'Les documents ont été générés, mais le lien de téléchargement immédiat n’a pas pu être créé. Utilisez « Suivre ma demande » avec votre INE et votre email pour les récupérer.';
    }
  }

  return {
    success: true,
    urlDocuments,
    generationWarning,
  };
}
