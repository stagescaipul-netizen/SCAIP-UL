'use client';

import { useState, useTransition } from 'react';
import { restaurerDemande, supprimerDefinitivement } from '../demandes/[id]/actions';

export default function CorbeilleActions({
  requestId,
  peutSupprimerDefinitivement,
}: {
  requestId: string;
  peutSupprimerDefinitivement: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  function onRestaurer() {
    startTransition(async () => {
      const res = await restaurerDemande(requestId);
      if (res.error) setError(res.error);
      else setDone(true);
    });
  }

  function onSupprimer() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      const res = await supprimerDefinitivement(requestId);
      if (res.error) setError(res.error);
      else setDone(true);
    });
  }

  if (done) {
    return <span className="text-sm text-slate-500">Fait.</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          onClick={onRestaurer}
          disabled={pending}
          className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:opacity-60"
        >
          Restaurer
        </button>
        {peutSupprimerDefinitivement && (
          <button
            onClick={onSupprimer}
            disabled={pending}
            className="h-9 rounded-md border border-red-300 px-3 text-sm font-medium text-red-700 disabled:opacity-60"
          >
            {confirming ? 'Confirmer, irréversible' : 'Supprimer définitivement'}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
