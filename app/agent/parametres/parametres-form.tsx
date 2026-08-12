'use client';

import { useActionState, useState } from 'react';
import { mettreAJourParametres, type ParametresState } from './actions';

type Settings = {
  duree_validite_document_mois: number;
  duree_conservation_dossier_mois: number;
  delivrance_suspendue: boolean;
  mode_generation: string;
  generation_differee_delai_minutes: number;
};

const initialState: ParametresState = {};

const MODES = [
  {
    value: 'confirmation_obligatoire',
    titre: 'Confirmation obligatoire',
    description: "Réglage par défaut. Rien ne se génère sans qu'un agent valide la demande.",
  },
  {
    value: 'differe',
    titre: 'Différé',
    description:
      "Une demande sans action d'un agent après le délai ci-dessous est validée automatiquement. Tracée comme automatique dans le journal, jamais comme l'action d'un agent.",
  },
  {
    value: 'automatique',
    titre: 'Automatique',
    description:
      "Génération immédiate à la soumission, sans délai ni action humaine, si toutes les vérifications automatiques passent. Le justificatif déposé par l'étudiant n'est alors jamais consulté par un agent.",
  },
];

export default function ParametresForm({ settings, readOnly }: { settings: Settings; readOnly: boolean }) {
  const [state, formAction, pending] = useActionState(mettreAJourParametres, initialState);
  const [mode, setMode] = useState(settings.mode_generation);
  const [modifier, setModifier] = useState(false);
  const [confirmation, setConfirmation] = useState(false);

  const verrouille = readOnly || !modifier;

  function onSubmit(e: React.FormEvent) {
    if (!confirmation) {
      e.preventDefault();
      setConfirmation(true);
    }
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="mt-5 flex max-w-2xl flex-col gap-5">
      {!readOnly && (
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={modifier}
            onChange={(e) => {
              setModifier(e.target.checked);
              setConfirmation(false);
            }}
          />
          Modifier ces paramètres
        </label>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <label className="mb-3 flex flex-col gap-1 text-sm text-slate-600">
            Durée de validité d&apos;un document (mois)
            <input
              name="duree_validite_document_mois"
              type="number"
              min={1}
              defaultValue={settings.duree_validite_document_mois}
              disabled={verrouille}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm disabled:bg-slate-50"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            Durée de conservation d&apos;un dossier (mois)
            <input
              name="duree_conservation_dossier_mois"
              type="number"
              min={1}
              defaultValue={settings.duree_conservation_dossier_mois}
              disabled={verrouille}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm disabled:bg-slate-50"
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Arrêt global de la délivrance</p>
        <p className="mt-1 text-xs text-slate-500">
          Désactivé par défaut. Si activé, aucun document n&apos;est généré, même si une demande est validée.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="delivrance_suspendue" defaultChecked={settings.delivrance_suspendue} disabled={verrouille} />
          Suspendre la délivrance de documents
        </label>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Mode de génération des documents</p>
        <div className="mt-3 flex flex-col gap-3">
          {MODES.map((m) => (
            <label key={m.value} className="flex gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="mode_generation"
                value={m.value}
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
                disabled={verrouille}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-slate-900">{m.titre}</span>
                <br />
                <span className="text-xs text-slate-500">{m.description}</span>
              </span>
            </label>
          ))}
        </div>
        <label className="mt-4 flex max-w-[220px] flex-col gap-1 text-sm text-slate-600">
          Délai avant validation automatique en mode différé (minutes)
          <input
            name="generation_differee_delai_minutes"
            type="number"
            min={1}
            defaultValue={settings.generation_differee_delai_minutes}
            disabled={verrouille || mode !== 'differe'}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm disabled:bg-slate-50"
          />
          <span className="text-xs text-slate-400">Ex. 5 pour un test rapide, 1440 pour 24 heures.</span>
        </label>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">Paramètres enregistrés.</p>}

      {!readOnly && modifier && (
        <button
          type="submit"
          disabled={pending}
          className="h-11 min-w-[240px] rounded-md bg-[#1F3B4D] px-8 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? 'Enregistrement…' : confirmation ? 'Confirmer l\'enregistrement' : 'Enregistrer'}
        </button>
      )}
    </form>
  );
}
