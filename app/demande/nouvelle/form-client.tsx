'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { submitDemande, type DemandeState } from './actions';

type RefRow = { id: string; nom?: string; libelle?: string; departement?: string; nom_complet?: string };

const initialState: DemandeState = {};

// Un PDF ne peut pas être compressé sans bibliothèque dédiée — on se
// contente d'une limite de taille raisonnable, avec message clair.
const TAILLE_MAX_PDF = 5 * 1024 * 1024; // 5 Mo
// Filet de sécurité si la compression d'image échoue (format non
// supporté par le navigateur, par exemple) — au-delà, on refuse plutôt
// que d'envoyer un fichier énorme en silence.
const TAILLE_MAX_IMAGE_NON_COMPRESSEE = 8 * 1024 * 1024; // 8 Mo
const DIMENSION_MAX_PX = 1600;
const QUALITE_JPEG = 0.75;

/**
 * Redimensionne et compresse une image côté navigateur avant l'envoi —
 * une photo de téléphone de plusieurs Mo devient une image JPEG de
 * quelques centaines de Ko, largement suffisante pour rester lisible,
 * sans rien demander de plus à l'étudiant.
 */
async function comprimerImage(fichier: File): Promise<File> {
  const url = URL.createObjectURL(fichier);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = document.createElement('img');
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image illisible par le navigateur.'));
      img.src = url;
    });

    const ratio = Math.min(1, DIMENSION_MAX_PX / Math.max(image.naturalWidth, image.naturalHeight));
    const largeur = Math.round(image.naturalWidth * ratio);
    const hauteur = Math.round(image.naturalHeight * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = largeur;
    canvas.height = hauteur;
    const contexte = canvas.getContext('2d');
    if (!contexte) throw new Error('Compression impossible sur ce navigateur.');
    contexte.drawImage(image, 0, 0, largeur, hauteur);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITE_JPEG));
    if (!blob) throw new Error('Compression impossible sur ce navigateur.');

    const nomSansExtension = fichier.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${nomSansExtension}.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

const emptyValues = {
  nom_complet: '',
  numero_ine: '',
  telephone: '',
  email_personnel: '',
  departement: '',
  filiere_programme: '',
  level_id: '',
  academic_year_id: '',
  responsable_declare: '',
};

export default function DemandeForm({
  levels,
  years,
  typeResponsableVerification,
  dureeValiditeMois,
}: {
  levels: RefRow[];
  years: RefRow[];
  typeResponsableVerification: 'chef_departement' | 'directeur_programme';
  dureeValiditeMois: number;
}) {
  const [showGuide, setShowGuide] = useState(true);
  const [step, setStep] = useState(1);
  const [state, formAction, pending] = useActionState(submitDemande, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Champs contrôlés — un formulaire soumis via l'attribut `action` (donc
  // via le mécanisme natif du navigateur) réinitialise les champs non
  // contrôlés une fois l'action terminée, succès ou erreur. Les garder en
  // état React évite de perdre la saisie et permet de resoumettre sans
  // recharger la page.
  const [values, setValues] = useState(emptyValues);
  const [fileName, setFileName] = useState('');
  const [fichierReinitialise, setFichierReinitialise] = useState(false);
  const [compressionEnCours, setCompressionEnCours] = useState(false);
  const [erreurFichier, setErreurFichier] = useState('');
  const [typeResponsableActuel, setTypeResponsableActuel] = useState<
    'chef_departement' | 'directeur_programme'
  >(typeResponsableVerification);

  // La question finale doit réellement alterner d'une nouvelle demande à
  // l'autre. sessionStorage pouvait être perdu ou réinitialisé selon la
  // navigation ; on conserve donc le dernier rôle dans localStorage. Le tout
  // premier affichage reste tiré au sort, puis on alterne strictement :
  // chef -> directeur -> chef -> directeur.
  useEffect(() => {
    const cle = 'scaip-dernier-role-question';
    let prochain: 'chef_departement' | 'directeur_programme';
    try {
      const precedent = window.localStorage.getItem(cle);
      if (precedent === 'chef_departement') {
        prochain = 'directeur_programme';
      } else if (precedent === 'directeur_programme') {
        prochain = 'chef_departement';
      } else {
        const tirage = new Uint32Array(1);
        window.crypto.getRandomValues(tirage);
        prochain = tirage[0] % 2 === 0 ? 'chef_departement' : 'directeur_programme';
      }
      window.localStorage.setItem(cle, prochain);
    } catch {
      prochain = Math.random() < 0.5 ? 'chef_departement' : 'directeur_programme';
    }
    setTypeResponsableActuel(prochain);
  }, []);

  // Le champ fichier ne peut pas être contrôlé par React — le navigateur
  // le vide après toute tentative de soumission, succès ou échec. Sans
  // cette vérification, un correctif apporté après une première erreur
  // échouerait une seconde fois pour une raison invisible (fichier manquant),
  // pas pour la raison que l'étudiant vient de corriger.
  useEffect(() => {
    if (state.error && fileName && fileInputRef.current?.files?.length === 0) {
      setFileName('');
      setFichierReinitialise(true);
      setStep(1);
    }
  }, [state.error, fileName]);

  // Une erreur signalée par le serveur doit être visible à l'endroit où
  // elle concerne réellement l'étudiant — le nom du responsable se
  // corrige à l'étape 4, un doublon d'INE se corrige à l'étape 1. Sans
  // ce renvoi explicite, l'étudiant pouvait se retrouver visuellement
  // ramené à la première étape sans jamais voir le message, resté
  // affiché dans le bloc d'une étape devenue inactive.
  useEffect(() => {
    if (state.error && state.errorStep) {
      setStep(state.errorStep);
    }
  }, [state.error, state.errorStep]);

  function setField(name: keyof typeof emptyValues) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [name]: e.target.value }));
  }

  function validateStep(n: number): boolean {
    const stepEl = formRef.current?.querySelector(`[data-step="${n}"]`);
    if (!stepEl) return true;
    const fields = stepEl.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[required]');
    for (const field of fields) {
      if (!field.reportValidity()) return false;
    }
    return true;
  }

  if (showGuide) {
    return <VideoGuide onContinue={() => setShowGuide(false)} />;
  }

  if (state.success) {
    const peutTelecharger = Boolean(state.urlDocuments);

    return (
      <Shell>
        <div className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <span className="text-2xl text-emerald-600">✓</span>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Dossier transmis</h1>
          <p className="mt-2 text-sm text-slate-600">
            Merci, votre demande a bien été enregistrée.
          </p>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">
              {peutTelecharger
                ? 'Vos documents sont disponibles.'
                : 'Votre demande est en cours de traitement par le SCAIP-UL.'}
            </p>

            {state.generationWarning && (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {state.generationWarning}
              </p>
            )}

            {peutTelecharger && state.urlDocuments ? (
              <a
                href={state.urlDocuments}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex h-11 items-center justify-center rounded-md bg-[#1F3B4D] text-sm font-semibold text-white"
              >
                Télécharger mes documents
              </a>
            ) : (
              <Link
                href="/suivi"
                className="mt-4 flex h-11 items-center justify-center rounded-md border border-[#1F3B4D] text-sm font-semibold text-[#1F3B4D]"
              >
                Suivre ma demande
              </Link>
            )}

            <p className="mt-3 text-xs text-slate-500">
              {peutTelecharger
                ? 'Vous pourrez retrouver vos documents à tout moment avec votre numéro INE et votre adresse email.'
                : 'Vous recevrez un email dès que vos documents seront disponibles. Vous pourrez aussi suivre votre demande avec votre numéro INE et votre adresse email.'}
            </p>
          </div>

          <p className="mt-4 text-xs font-medium text-amber-700">
            Les informations fournies engagent votre responsabilité : toute fausse déclaration
            peut entraîner l&apos;annulation du dossier et expose son auteur à des poursuites
            judiciaires en cas de fraude avérée.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="mb-4 text-sm text-slate-500">Aucun compte requis.</p>
      <Stepper step={step} />
      <form ref={formRef} action={formAction} noValidate className="mt-6 flex flex-col gap-4">
        <div data-step="1" className={step === 1 ? '' : 'hidden'}>
          {fichierReinitialise && (
            <div className="mb-3 rounded-md bg-amber-50 p-3 text-xs font-medium text-amber-800">
              Votre justificatif a été réinitialisé après la tentative précédente. Merci de le
              rejoindre à nouveau avant de continuer.
            </div>
          )}
          <Field label="Nom et prénom" name="nom_complet" required value={values.nom_complet} onChange={setField('nom_complet')} uppercase />
          <Field
            label="Numéro INE"
            name="numero_ine"
            required
            pattern="^[A-Za-z]{4}[0-9]{10}$"
            maxLength={14}
            title="4 lettres suivies de 10 chiffres, sans espace ni tiret (ex. KOOA0307536419)"
            placeholder="Ex. KOOA0307536419"
            value={values.numero_ine}
            onChange={setField('numero_ine')}
            uppercase
          />
          <Field
            label="Téléphone"
            name="telephone"
            type="tel"
            pattern="^[0-9]*$"
            title="Chiffres uniquement"
            value={values.telephone}
            onChange={(e) => {
              e.target.value = e.target.value.replace(/\D/g, '');
              setField('telephone')(e);
            }}
          />
          <Field
            label="Email personnel"
            name="email_personnel"
            type="email"
            required
            value={values.email_personnel}
            onChange={setField('email_personnel')}
          />
          <label className="mb-3 flex flex-col gap-1 text-sm text-slate-600">
            Justificatif d&apos;inscription : attestation, carte d&apos;étudiant ou certificat de scolarité
            <input
              ref={fileInputRef}
              name="justificatif"
              type="file"
              accept="image/*,application/pdf"
              required
              className="hidden"
              onChange={async (e) => {
                const fichier = e.target.files?.[0];
                if (!fichier) return;

                setFichierReinitialise(false);

                if (fichier.type === 'application/pdf') {
                  if (fichier.size > TAILLE_MAX_PDF) {
                    setErreurFichier("Ce PDF dépasse 5 Mo. Merci d'en choisir un plus léger.");
                    setFileName('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    return;
                  }
                  setErreurFichier('');
                  setFileName(fichier.name);
                  return;
                }

                setCompressionEnCours(true);
                try {
                  const compresse = await comprimerImage(fichier);
                  const transfert = new DataTransfer();
                  transfert.items.add(compresse);
                  if (fileInputRef.current) fileInputRef.current.files = transfert.files;
                  setErreurFichier('');
                  setFileName(compresse.name);
                } catch {
                  // La compression a échoué (format non pris en charge par
                  // exemple) — on garde le fichier d'origine plutôt que de
                  // bloquer l'étudiant, avec une vérification de taille.
                  if (fichier.size > TAILLE_MAX_IMAGE_NON_COMPRESSEE) {
                    setErreurFichier("Cette image est trop volumineuse et n'a pas pu être compressée automatiquement. Merci d'en choisir une plus légère.");
                    setFileName('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  } else {
                    setErreurFichier('');
                    setFileName(fichier.name);
                  }
                } finally {
                  setCompressionEnCours(false);
                }
              }}
            />
            <button
              type="button"
              disabled={compressionEnCours}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-[#1F3B4D] disabled:opacity-60"
            >
              {compressionEnCours ? 'Compression…' : fileName || 'Choisir un fichier'}
            </button>
          </label>
          {erreurFichier && <p className="mt-1 text-sm text-red-600">{erreurFichier}</p>}
          {state.errorStep === 1 && state.error && (
            <p className="mt-2 text-sm text-red-600">{state.error}</p>
          )}
          <div className="mt-2 flex gap-2">
            <NextButton onClick={() => !compressionEnCours && validateStep(1) && setStep(2)} />
          </div>
        </div>

        <div data-step="2" className={step === 2 ? '' : 'hidden'}>
          <Field
            label="Département"
            name="departement"
            required
            value={values.departement}
            onChange={setField('departement')}
            uppercase
          />
          <Field
            label="Filière / Programme"
            name="filiere_programme"
            required
            value={values.filiere_programme}
            onChange={setField('filiere_programme')}
            uppercase
          />
          <SelectField
            label="Niveau"
            name="level_id"
            options={levels.map((l) => ({ value: l.id, label: l.libelle! }))}
            required
            value={values.level_id}
            onChange={setField('level_id')}
          />
          <SelectField
            label="Année universitaire"
            name="academic_year_id"
            options={years.map((y) => ({ value: y.id, label: y.libelle! }))}
            required
            value={values.academic_year_id}
            onChange={setField('academic_year_id')}
          />
          <label className="mb-3 flex flex-col gap-1 text-sm text-slate-600">
            Destinataire de la demande
            <span className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
              SCAIP-UL
            </span>
          </label>
          <div className="mt-2 flex gap-2">
            <PrevButton onClick={() => setStep(1)} />
            <NextButton onClick={() => validateStep(2) && setStep(3)} />
          </div>
        </div>

        <div data-step="3" className={step === 3 ? '' : 'hidden'}>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Vérifiez vos informations</h2>
          <div className="divide-y divide-slate-100 rounded-md border border-slate-200 text-sm">
            <RecapRow label="Nom et prénom" value={values.nom_complet} />
            <RecapRow label="Numéro INE" value={values.numero_ine} />
            <RecapRow label="Téléphone" value={values.telephone} />
            <RecapRow label="Email personnel" value={values.email_personnel} />
            <RecapRow label="Département" value={values.departement} />
            <RecapRow label="Filière / Programme" value={values.filiere_programme} />
            <RecapRow label="Niveau" value={levels.find((l) => l.id === values.level_id)?.libelle ?? ''} />
            <RecapRow label="Année universitaire" value={years.find((y) => y.id === values.academic_year_id)?.libelle ?? ''} />
            <RecapRow label="Destinataire" value="SCAIP-UL" />
          </div>
          <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
            Relisez attentivement. Une fois la demande validée, une correction nécessite de
            contacter le SCAIP-UL directement.
          </div>
          <div className="mt-2 flex gap-2">
            <PrevButton onClick={() => setStep(2)} />
            <NextButton onClick={() => setStep(4)} />
          </div>
        </div>

        <div data-step="4" className={step === 4 ? '' : 'hidden'}>
          <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
            Deux documents seront générés automatiquement : Autorisation de stage et Lettre de
            recommandation.
          </div>
          <div className="mt-2 rounded-md bg-amber-50 p-3 text-xs font-medium text-amber-800">
            Votre document sera valable {dureeValiditeMois} mois. Une seule demande est autorisée
            pendant cette période. Vérifiez l&apos;exactitude de vos informations avant de
            soumettre, une correction après validation nécessite de contacter le service.
          </div>
          <input
            type="hidden"
            name="type_responsable_verification"
            value={typeResponsableActuel}
          />
          <label className="mt-3 flex flex-col gap-1 text-sm text-slate-600">
            {typeResponsableActuel === 'chef_departement'
              ? `Nom du chef de département « ${values.departement || 'votre département'} »`
              : `Nom du directeur de programme du département « ${values.departement || 'votre département'} »`}
            <input
              name="responsable_declare"
              required
              value={values.responsable_declare}
              onChange={(e) => setValues((v) => ({ ...v, responsable_declare: e.target.value.toUpperCase() }))}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-900 uppercase"
            />
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" name="cert_statut_etudiant" required className="mt-0.5" />
            Je certifie que je suis étudiant(e) régulièrement inscrit(e) à l&apos;Université de
            Labé.
          </label>
          <label className="mt-2 flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" name="cert_exactitude" required className="mt-0.5" />
            Je certifie que les informations fournies sont exactes.
          </label>

          {/* hCaptcha — clé de site non configurée dans cet environnement,
              jamais testée avec une vraie clé. */}
          {process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY && (
            <div className="h-captcha mt-3" data-sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY} />
          )}

          {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}

          <div className="mt-4 flex gap-2">
            <PrevButton onClick={() => setStep(3)} />
            <button
              type="submit"
              disabled={pending}
              onClick={(e) => {
                if (!validateStep(4)) e.preventDefault();
              }}
              className="flex h-10 flex-1 items-center justify-center whitespace-nowrap rounded-md bg-[#1F3B4D] text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? 'Envoi…' : 'Soumettre'}
            </button>
          </div>
        </div>
      </form>
    </Shell>
  );
}

function VideoGuide({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-7">
          <Image
            src="/logo/universite-labe.png"
            alt="Université de Labé"
            width={489}
            height={129}
            className="mb-3 h-9 w-auto"
            priority
          />
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            Avant de commencer ta demande
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Regarde cette vidéo de 2 min 42 pour comprendre chaque étape, préparer ton
            justificatif et éviter les erreurs.
          </p>
        </div>

        <div className="bg-slate-950">
          <video
            className="aspect-video w-full"
            controls
            playsInline
            preload="metadata"
            controlsList="nodownload"
          >
            <source src="/media/guide-demande-documents-stage.mp4" type="video/mp4" />
            Ton navigateur ne permet pas de lire cette vidéo.
          </video>
        </div>

        <div className="flex flex-col-reverse gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <Link
            href="/"
            className="flex h-11 items-center justify-center rounded-md border border-slate-300 px-5 text-sm font-medium text-slate-700"
          >
            Quitter
          </Link>
          <button
            type="button"
            onClick={onContinue}
            className="flex h-11 items-center justify-center rounded-md bg-[#1F3B4D] px-6 text-sm font-semibold text-white"
          >
            Continuer vers le formulaire
          </button>
        </div>
      </div>
    </main>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value || 'Non renseigné'}</span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <div className="rounded-lg border border-slate-200 p-6">
        <Image
          src="/logo/universite-labe.png"
          alt="Université de Labé"
          width={489}
          height={129}
          className="mb-3 h-9 w-auto"
          priority
        />
        <h1 className="text-lg font-semibold text-slate-900">Demande de documents de stage</h1>
        {children}
      </div>
    </main>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ['Étudiant', 'Académique', 'Récapitulatif', 'Vérification'];
  return (
    <div className="flex items-start">
      {labels.map((label, i) => {
        const n = i + 1;
        const active = n <= step;
        return (
          <div key={label} className="flex flex-1 flex-col items-center">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                active ? 'bg-[#1F3B4D] text-white' : 'border border-slate-300 text-slate-400'
              }`}
            >
              {n}
            </div>
            <span className={`mt-1 text-[11px] ${active ? 'text-slate-900' : 'text-slate-400'}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required = false,
  pattern,
  maxLength,
  title,
  placeholder,
  value,
  onChange,
  uppercase = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  pattern?: string;
  maxLength?: number;
  title?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uppercase?: boolean;
}) {
  return (
    <label className="mb-3 flex flex-col gap-1 text-sm text-slate-600">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        pattern={pattern}
        maxLength={maxLength}
        title={title}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          if (uppercase) e.target.value = e.target.value.toUpperCase();
          onChange(e);
        }}
        className={`h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-900 ${uppercase ? 'uppercase' : ''}`}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
  required = false,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <label className="mb-3 flex flex-col gap-1 text-sm text-slate-600">
      {label}
      <select
        name={name}
        required={required}
        value={value}
        onChange={onChange}
        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
      >
        <option value="" disabled>
          Sélectionnez
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NextButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 flex-1 items-center justify-center whitespace-nowrap rounded-md bg-[#1F3B4D] text-sm font-medium text-white"
    >
      Suivant →
    </button>
  );
}

function PrevButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 flex-1 items-center justify-center whitespace-nowrap rounded-md border border-[#1F3B4D] text-sm font-medium text-[#1F3B4D]"
    >
      ← Précédent
    </button>
  );
}
