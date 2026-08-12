'use client';

import { useState, useTransition } from 'react';
import { validerDemande, refuserDemande } from './actions';

export default function RequestActions({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [warning, setWarning] = useState<string | undefined>();
  const [showMotif, setShowMotif] = useState(false);
  const [motif, setMotif] = useState('');

  function onValider() {
    startTransition(async () => {
      setError(undefined);
      setWarning(undefined);
      const res = await validerDemande(requestId);
      if (res.error) setError(res.error);
      if (res.warning) setWarning(res.warning);
    });
  }

  function onRefuser() {
    if (!showMotif) {
      setShowMotif(true);
      return;
    }
    startTransition(async () => {
      const res = await refuserDemande(requestId, motif);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="mt-4">
      {showMotif && (
        <textarea
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Motif du refus (obligatoire)"
          className="mb-2 w-full rounded-md border border-slate-300 p-2 text-sm"
        />
      )}
      <div className="flex gap-2">
        <button
          onClick={onValider}
          disabled={pending}
          className="h-10 flex-1 rounded-md bg-[#1F3B4D] text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Traitement…' : 'Valider et générer'}
        </button>
        <button
          onClick={onRefuser}
          disabled={pending}
          className="h-10 flex-1 rounded-md border border-red-300 text-sm font-medium text-red-700 disabled:opacity-60"
        >
          Refuser
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {warning && <p className="mt-2 rounded-md bg-amber-50 p-2 text-sm text-amber-800">{warning}</p>}
    </div>
  );
}
