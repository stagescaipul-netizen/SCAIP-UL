'use client';

import { useActionState, useState } from 'react';
import { ajouterAnnee, type AnneeState } from './actions';

const initialState: AnneeState = {};

// Options préconstruites — calcul automatique du 1er septembre au 31
// juillet, cohérent avec la seule année déjà en place. Une saisie
// manuelle reste possible pour tout cas hors norme, pas besoin de
// repousser cette liste chaque année.
const ANNEES_PRECONSTRUITES = Array.from({ length: 6 }, (_, i) => {
  const debut = 2025 + i;
  return {
    libelle: `${debut}-${debut + 1}`,
    dateDebut: `${debut}-09-01`,
    dateFin: `${debut + 1}-07-31`,
  };
});

type Annee = { id: string; libelle: string; date_debut: string; date_fin: string };

export default function AnneesSection({ annees, readOnly }: { annees: Annee[]; readOnly: boolean }) {
  const [state, formAction, pending] = useActionState(ajouterAnnee, initialState);
  const [choix, setChoix] = useState('');
  const saisieManuelle = choix === 'manuel';

  const preconstruite = ANNEES_PRECONSTRUITES.find((a) => a.libelle === choix);
  const dejaAjoutees = new Set(annees.map((a) => a.libelle));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Années académiques</p>
      <p className="mt-1 text-xs text-slate-500">
        Le formulaire étudiant ne propose que les années listées ici — rien ne s&apos;ajoute automatiquement
        d&apos;une année sur l&apos;autre.
      </p>

      <div className="mt-3 divide-y divide-slate-100">
        {annees.length === 0 && <p className="py-2 text-sm text-slate-500">Aucune année enregistrée.</p>}
        {annees.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-2 text-sm">
            <span className="font-medium text-slate-900">{a.libelle}</span>
            <span className="text-slate-500">
              {a.date_debut} → {a.date_fin}
            </span>
          </div>
        ))}
      </div>

      {!readOnly && (
        <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            Ajouter une année
            <select
              value={choix}
              onChange={(e) => setChoix(e.target.value)}
              className="h-10 w-40 rounded-md border border-slate-300 px-3 text-sm"
            >
              <option value="">Choisir…</option>
              {ANNEES_PRECONSTRUITES.map((a) => (
                <option key={a.libelle} value={a.libelle} disabled={dejaAjoutees.has(a.libelle)}>
                  {a.libelle}{dejaAjoutees.has(a.libelle) ? ' (déjà ajoutée)' : ''}
                </option>
              ))}
              <option value="manuel">Saisie manuelle…</option>
            </select>
          </label>

          {saisieManuelle ? (
            <>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Libellé
                <input name="libelle" required placeholder="Ex. 2031-2032" className="h-10 w-32 rounded-md border border-slate-300 px-3 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Début
                <input name="date_debut" type="date" required className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Fin
                <input name="date_fin" type="date" required className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
              </label>
            </>
          ) : (
            preconstruite && (
              <>
                <input type="hidden" name="libelle" value={preconstruite.libelle} />
                <input type="hidden" name="date_debut" value={preconstruite.dateDebut} />
                <input type="hidden" name="date_fin" value={preconstruite.dateFin} />
                <p className="text-xs text-slate-500">
                  {preconstruite.dateDebut} → {preconstruite.dateFin}
                </p>
              </>
            )
          )}

          <button
            type="submit"
            disabled={pending || !choix}
            className="h-10 rounded-md bg-[#1F3B4D] px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? 'Ajout…' : 'Ajouter'}
          </button>
          {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
          {state.success && <p className="w-full text-sm text-emerald-600">Année ajoutée.</p>}
        </form>
      )}
    </div>
  );
}
