'use client';

import Image from 'next/image';
import { useActionState } from 'react';
import { login, type LoginState } from './actions';

const initialState: LoginState = {};

export default function ConnexionPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Image
        src="/logo/universite-labe.png"
        alt="Université de Labé"
        width={489}
        height={129}
        className="mb-4 h-9 w-auto"
        priority
      />
      <h1 className="text-xl font-semibold text-slate-900">Connexion</h1>
      <p className="mt-1 text-sm text-slate-500">Université de Labé | SCAIP-UL</p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          Email
          <input
            name="email"
            type="email"
            required
            className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          Mot de passe
          <input
            name="mot_de_passe"
            type="password"
            required
            className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
          />
        </label>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 h-10 rounded-md bg-[#1F3B4D] text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </main>
  );
}
