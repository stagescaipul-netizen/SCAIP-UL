'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { mettreALaCorbeille } from './actions';

export default function TrashButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  function onClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      const res = await mettreALaCorbeille(requestId);
      if (res.error) setError(res.error);
      else router.push('/agent/demandes');
    });
  }

  return (
    <div className="mt-3">
      <button
        onClick={onClick}
        disabled={pending}
        className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-600 disabled:opacity-60"
      >
        {confirming ? 'Confirmer, mettre à la corbeille' : 'Mettre à la corbeille'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
