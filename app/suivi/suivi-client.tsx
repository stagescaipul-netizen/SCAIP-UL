'use client';

import { useActionState } from 'react';
import Image from 'next/image';
import { rechercherParIdentite, type StatutState } from './actions';

const statutInitial: StatutState = {};

const LABEL_STATUT: Record<string, string> = {
  en_attente: 'En attente de traitement',
  validee: 'Validée : documents disponibles',
  refusee: 'Refusée',
  annulee: 'Annulée',
  invalidee: 'Document invalidé',
};

const COULEUR_STATUT: Record<string, string> = {
  en_attente: 'bg-amber-50 text-amber-700',
  validee: 'bg-emerald-50 text-emerald-700',
  refusee: 'bg-red-50 text-red-700',
  annulee: 'bg-red-50 text-red-700',
  invalidee: 'bg-red-50 text-red-700',
};

export default function SuiviClient() {
  const [statut, rechercherAction, rechercheEnCours] = useActionState(
    rechercherParIdentite,
    statutInitial,
  );

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Image
        src="/logo/universite-labe.png"
        alt="Université de Labé"
        width={489}
        height={129}
        className="mb-6 h-9 w-auto"
        priority
      />

      <h1 className="text-lg font-semibold text-slate-900">Suivre ma demande</h1>
      <p className="mt-1 text-sm text-slate-500">
        Renseignez votre numéro INE et l&apos;adresse email utilisée lors de votre demande.
      </p>

      <form action={rechercherAction} className="mt-5 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          Numéro INE
          <input
            name="numero_ine"
            required
            maxLength={14}
            pattern="^[A-Za-z]{4}[0-9]{10}$"
            placeholder="Ex. KOOA0307536419"
            className="h-11 rounded-md border border-slate-300 px-3 text-sm uppercase"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          Email personnel
          <input
            name="email_personnel"
            type="email"
            required
            placeholder="votre@email.com"
            className="h-11 rounded-md border border-slate-300 px-3 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={rechercheEnCours}
          className="h-11 rounded-md bg-[#1F3B4D] text-sm font-semibold text-white disabled:opacity-60"
        >
          {rechercheEnCours ? 'Recherche…' : 'Vérifier ma demande'}
        </button>
        {statut.error && <p className="text-sm text-red-600">{statut.error}</p>}
      </form>

      {statut.trouve && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Demande de</p>
          <p className="font-medium text-slate-900">{statut.nomEtudiant}</p>
          <p className="mt-3 text-sm text-slate-500">Statut</p>
          <span
            className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${
              COULEUR_STATUT[statut.statut ?? ''] ?? 'bg-slate-100 text-slate-600'
            }`}
          >
            {LABEL_STATUT[statut.statut ?? ''] ?? statut.statut}
          </span>

          {statut.motifRefus && (
            <p className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">
              Motif : {statut.motifRefus}
            </p>
          )}

          {statut.statut === 'en_attente' && (
            <p className="mt-3 text-xs text-slate-600">
              Votre demande a bien été enregistrée. Vos documents ne sont pas encore disponibles. Vous recevrez un email dès qu&apos;ils seront prêts.
            </p>
          )}

          {statut.peutTelecharger && statut.urlDocuments && (
            <a
              href={statut.urlDocuments}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex h-11 items-center justify-center rounded-md bg-[#1F3B4D] text-sm font-semibold text-white"
            >
              Télécharger mes documents
            </a>
          )}

          {statut.statut === 'validee' && !statut.urlDocuments && (
            <p className="mt-3 text-xs text-amber-700">
              Les documents sont validés mais le fichier de téléchargement est momentanément indisponible.
              Contactez le SCAIP-UL si le problème persiste.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
