'use client';

import { useState, useTransition } from 'react';
import { invaliderDocuments } from './actions';

export default function InvalidateButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  function onClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      const res = await invaliderDocuments(requestId);
      if (res.error) setError(res.error);
      else setDone(true);
    });
  }

  if (done) {
    return <p className="mt-3 text-sm text-red-700">Les deux documents ont été invalidés.</p>;
  }

  return (
    <div className="mt-3">
      <button
        onClick={onClick}
        disabled={pending}
        className="h-9 rounded-md border border-red-300 px-3 text-sm font-medium text-red-700 disabled:opacity-60"
      >
        {confirming ? 'Confirmer — invalider les deux documents' : 'Invalider les documents'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
