'use client';

import { useActionState, useState } from 'react';
import { ajouterAgent, type AjouterAgentState } from './actions';

const initialState: AjouterAgentState = {};

export default function AjouterAgentForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(ajouterAgent, initialState);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md bg-[#1F3B4D] px-4 py-2 text-sm font-medium text-white"
      >
        + Ajouter un agent
      </button>

      {open && (
        <form action={formAction} className="mt-3 max-w-md rounded-lg border border-slate-200 bg-white p-4">
          <label className="mb-3 flex flex-col gap-1 text-sm text-slate-600">
            Nom et prénom
            <input name="nom_complet" required className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
          </label>
          <label className="mb-3 flex flex-col gap-1 text-sm text-slate-600">
            Email professionnel
            <input name="email_professionnel" type="email" required className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
          </label>
          <label className="mb-3 flex flex-col gap-1 text-sm text-slate-600">
            Mot de passe temporaire
            <input name="mot_de_passe" type="password" required minLength={8} className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
          </label>
          <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="est_admin" />
            Administrateur
          </label>
          {state.error && <p className="mb-2 text-sm text-red-600">{state.error}</p>}
          {state.success && <p className="mb-2 text-sm text-emerald-600">Agent ajouté.</p>}
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-md bg-[#1F3B4D] px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? 'Ajout…' : 'Enregistrer'}
          </button>
        </form>
      )}
    </div>
  );
}
