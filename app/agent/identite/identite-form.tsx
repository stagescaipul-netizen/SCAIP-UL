'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mettreAJourIdentite, type IdentiteState } from './actions';

type Mode = 'separate' | 'combined';
type Identite = {
  etablissement: string;
  service: string;
  signataire: string;
  fonction: string;
  email_professionnel: string;
  telephone: string;
  signature_image_path: string | null;
  cachet_image_path: string | null;
  combined_image_path: string | null;
  authentication_mode: Mode;
};

const initialState: IdentiteState = {};

export default function IdentiteForm({
  identite,
  readOnly,
  signatureExistanteUrl,
  cachetExistantUrl,
  combinedExistantUrl,
}: {
  identite: Identite;
  readOnly: boolean;
  signatureExistanteUrl: string | null;
  cachetExistantUrl: string | null;
  combinedExistantUrl: string | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(mettreAJourIdentite, initialState);
  const [modifier, setModifier] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [mode, setMode] = useState<Mode>(identite.authentication_mode);
  const verrouille = readOnly || !modifier;

  useEffect(() => {
    if (!state.success) return;
    setModifier(false);
    setConfirmation(false);
    router.refresh();
  }, [state.success, router]);

  function onSubmit(e: React.FormEvent) {
    if (!confirmation) {
      e.preventDefault();
      setConfirmation(true);
    }
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="mt-5 max-w-3xl rounded-lg border border-slate-200 bg-white p-5">
      {!readOnly && (
        <label className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={modifier} onChange={(e) => { setModifier(e.target.checked); setConfirmation(false); }} />
          Modifier ces informations
        </label>
      )}

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field name="etablissement" label="Établissement" defaultValue={identite.etablissement} disabled={verrouille} full />
        <Field name="service" label="Service" defaultValue={identite.service} disabled={verrouille} full />
        <Field name="signataire" label="Signataire" defaultValue={identite.signataire} disabled={verrouille} />
        <Field name="fonction" label="Fonction" defaultValue={identite.fonction} disabled={verrouille} />
        <Field name="email_professionnel" label="Email professionnel" defaultValue={identite.email_professionnel} disabled={verrouille} />
        <Field name="telephone" label="Téléphone" defaultValue={identite.telephone} disabled={verrouille} />
      </div>

      <div className="mt-5 border-t border-slate-200 pt-5">
        <h2 className="text-base font-semibold text-slate-900">Authentification des documents</h2>
        <p className="mt-1 text-xs text-slate-500">Choisissez comment la signature et le cachet seront intégrés aux nouveaux PDF.</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className={`rounded-lg border p-3 ${mode === 'separate' ? 'border-[#1F3B4D] bg-slate-50' : 'border-slate-200'}`}>
            <span className="flex items-start gap-2">
              <input name="authentication_mode" type="radio" value="separate" checked={mode === 'separate'} disabled={verrouille} onChange={() => setMode('separate')} />
              <span>
                <span className="block text-sm font-semibold text-slate-800">Signature + Cachet</span>
                <span className="block text-xs text-slate-500">Recommandé — les deux images sont gérées séparément et superposées dans le PDF.</span>
              </span>
            </span>
          </label>
          <label className={`rounded-lg border p-3 ${mode === 'combined' ? 'border-[#1F3B4D] bg-slate-50' : 'border-slate-200'}`}>
            <span className="flex items-start gap-2">
              <input name="authentication_mode" type="radio" value="combined" checked={mode === 'combined'} disabled={verrouille} onChange={() => setMode('combined')} />
              <span>
                <span className="block text-sm font-semibold text-slate-800">Image combinée</span>
                <span className="block text-xs text-slate-500">Utilisez une image unique contenant déjà la signature et le cachet.</span>
              </span>
            </span>
          </label>
        </div>

        {mode === 'separate' ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ImageField
              title="Signature"
              inputName="signature_image"
              deleteName="supprimer_signature"
              existingPath={identite.signature_image_path}
              existingUrl={signatureExistanteUrl}
              disabled={verrouille}
              previewClass="h-28 w-full"
            />
            <ImageField
              title="Cachet"
              inputName="cachet_image"
              deleteName="supprimer_cachet"
              existingPath={identite.cachet_image_path}
              existingUrl={cachetExistantUrl}
              disabled={verrouille}
              previewClass="h-36 w-full"
            />
          </div>
        ) : (
          <div className="mt-4 max-w-md">
            <ImageField
              title="Image Signature + Cachet"
              inputName="combined_image"
              deleteName="supprimer_combined"
              existingPath={identite.combined_image_path}
              existingUrl={combinedExistantUrl}
              disabled={verrouille}
              previewClass="h-36 w-full"
            />
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500">PNG à fond transparent recommandé. JPEG accepté. Taille maximale : 5 Mo par image.</p>
      </div>

      {state.error && <p className="mt-4 text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="mt-4 text-sm text-emerald-600">Informations enregistrées.</p>}

      {!readOnly && modifier && (
        <button type="submit" disabled={pending} className="mt-5 h-11 min-w-[240px] rounded-md bg-[#1F3B4D] px-8 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? 'Enregistrement…' : confirmation ? "Confirmer l'enregistrement" : 'Enregistrer'}
        </button>
      )}
    </form>
  );
}

function ImageField({
  title,
  inputName,
  deleteName,
  existingPath,
  existingUrl,
  disabled,
  previewClass,
}: {
  title: string;
  inputName: string;
  deleteName: string;
  existingPath: string | null;
  existingUrl: string | null;
  disabled: boolean;
  previewClass: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [remove, setRemove] = useState(false);
  const shown = preview ?? existingUrl;

  function clearSelection() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFileName('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <input
        ref={inputRef}
        name={inputName}
        type="file"
        accept="image/png,image/jpeg"
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (preview) URL.revokeObjectURL(preview);
          setPreview(null);
          setFileName('');
          if (!file) return;
          setFileName(file.name);
          setPreview(URL.createObjectURL(file));
          setRemove(false);
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className="rounded-md bg-[#E9EEF1] px-3 py-2 text-xs font-semibold text-[#1F3B4D] disabled:text-slate-400">
          {existingPath ? 'Remplacer' : 'Téléverser'}
        </button>
        {fileName && <span className="text-xs text-slate-600">{fileName}</span>}
        {fileName && <button type="button" onClick={clearSelection} disabled={disabled} className="text-xs text-slate-500 underline">Annuler</button>}
      </div>

      {existingPath && !preview && !remove && (
        <button type="button" disabled={disabled} onClick={() => setRemove(true)} className="mt-2 text-xs font-medium text-red-600 underline disabled:text-slate-400">Supprimer</button>
      )}
      {remove && (
        <div className="mt-2">
          <input type="hidden" name={deleteName} value="on" />
          <span className="text-xs text-red-700">Cette image sera supprimée à l&apos;enregistrement.</span>{' '}
          <button type="button" onClick={() => setRemove(false)} className="text-xs text-slate-500 underline">Annuler</button>
        </div>
      )}

      {shown && !remove ? (
        <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt={title} className={`${previewClass} object-contain`} />
        </div>
      ) : (
        <div className={`mt-3 flex ${previewClass} items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400`}>Aucune image</div>
      )}
    </div>
  );
}

function Field({ name, label, defaultValue, disabled, full = false }: { name: string; label: string; defaultValue: string; disabled: boolean; full?: boolean }) {
  return (
    <label className={`mb-3 flex flex-col gap-1 text-sm text-slate-600 ${full ? 'sm:col-span-2' : ''}`}>
      {label}
      <input name={name} defaultValue={defaultValue} disabled={disabled} className="h-10 rounded-md border border-slate-300 px-3 text-sm disabled:bg-slate-50" />
    </label>
  );
}
