'use client';

import { useActionState } from 'react';
import { mettreAJourProfil, type ProfilState } from './actions';

const initialState: ProfilState = {};

export default function ProfilForm({ nomComplet }: { nomComplet: string }) {
  const [state, formAction, pending] = useActionState(mettreAJourProfil, initialState);

  return (
    <form action={formAction} className="mt-5 max-w-md rounded-lg border border-slate-200 bg-white p-4">
      <label className="mb-3 flex flex-col gap-1 text-sm text-slate-600">
        Nom et prénom
        <input
          name="nom_complet"
          defaultValue={nomComplet}
          required
          className="h-10 rounded-md border border-slate-300 px-3 text-sm"
        />
      </label>
      <label className="mb-3 flex flex-col gap-1 text-sm text-slate-600">
        Nouveau mot de passe
        <input
          name="nouveau_mot_de_passe"
          type="password"
          minLength={8}
          placeholder="Laisser vide pour ne pas changer"
          className="h-10 rounded-md border border-slate-300 px-3 text-sm"
        />
      </label>

      {state.error && <p className="mb-2 text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="mb-2 text-sm text-emerald-600">Profil mis à jour.</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-md bg-[#1F3B4D] px-5 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  );
}
