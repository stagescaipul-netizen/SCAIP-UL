'use client';

import { useState, useTransition } from 'react';
import { ajouterAdminPrincipal, retirerAdminPrincipal, supprimerCompteAgent, basculerActifAgent } from './actions';

export default function AgentRowActions({
  agentId,
  estAdminPrincipal,
  actif,
  nombrePrincipaux,
}: {
  agentId: string;
  estAdminPrincipal: boolean;
  actif: boolean;
  nombrePrincipaux: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [confirmingPrincipal, setConfirmingPrincipal] = useState(false);
  const [confirmingSuppression, setConfirmingSuppression] = useState(false);
  const [supprime, setSupprime] = useState(false);

  function onTogglePrincipal() {
    setError(undefined);
    if (!confirmingPrincipal) {
      setConfirmingPrincipal(true);
      return;
    }
    startTransition(async () => {
      const res = estAdminPrincipal ? await retirerAdminPrincipal(agentId) : await ajouterAdminPrincipal(agentId);
      if (res.error) setError(res.error);
      setConfirmingPrincipal(false);
    });
  }

  function onToggleActif() {
    setError(undefined);
    startTransition(async () => {
      const res = await basculerActifAgent(agentId, !actif);
      if (res.error) setError(res.error);
    });
  }

  function onSupprimer() {
    setError(undefined);
    if (!confirmingSuppression) {
      setConfirmingSuppression(true);
      return;
    }
    startTransition(async () => {
      const res = await supprimerCompteAgent(agentId);
      if (res.error) setError(res.error);
      else setSupprime(true);
    });
  }

  if (supprime) {
    return <span className="text-xs text-slate-400">Compte supprimé</span>;
  }

  const peutAjouterPrincipal = !estAdminPrincipal && nombrePrincipaux < 2;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {(estAdminPrincipal || peutAjouterPrincipal) && (
          <button
            onClick={onTogglePrincipal}
            disabled={pending}
            className="h-8 rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-700 disabled:opacity-60"
          >
            {confirmingPrincipal ? 'Confirmer' : estAdminPrincipal ? 'Retirer principal' : 'Principal'}
          </button>
        )}
        {!estAdminPrincipal && (
          <button
            onClick={onToggleActif}
            disabled={pending}
            className="h-8 rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-700 disabled:opacity-60"
          >
            {actif ? 'Désactiver' : 'Réactiver'}
          </button>
        )}
        {!estAdminPrincipal && (
          <button
            onClick={onSupprimer}
            disabled={pending}
            className="h-8 rounded-md border border-red-300 px-2.5 text-xs font-medium text-red-700 disabled:opacity-60"
          >
            {confirmingSuppression ? 'Confirmer, irréversible' : 'Supprimer le compte'}
          </button>
        )}
      </div>
      {error && <p className="max-w-[260px] text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
