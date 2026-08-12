import { getCurrentUser } from '@/lib/auth/current-user';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const STATUT_LABEL: Record<string, string> = {
  en_attente: 'À vérifier',
  validee: 'Document généré',
  refusee: 'Refusée',
  annulee: 'Annulée',
  invalidee: 'Invalidée',
};

const STATUT_STYLE: Record<string, string> = {
  en_attente: 'bg-amber-50 text-amber-700',
  validee: 'bg-emerald-50 text-emerald-700',
  refusee: 'bg-red-50 text-red-700',
  annulee: 'bg-slate-100 text-slate-500',
  invalidee: 'bg-red-50 text-red-700',
};

const MOIS_LABEL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const PAR_PAGE = 15;

export default async function DemandesListPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string; annee?: string; mois?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (user.role !== 'agent') {
    redirect('/connexion');
  }

  const { filtre, annee, mois, page: pageParam } = await searchParams;
  const filtreActif = ['en_attente', 'validee', 'refusee', 'invalidee'].includes(filtre ?? '') ? filtre : undefined;
  const anneeActive = annee && /^\d{4}$/.test(annee) ? annee : undefined;
  const moisActif = mois && /^([1-9]|1[0-2])$/.test(mois) ? mois : undefined;
  const page = Math.max(1, Number(pageParam) || 1);

  const service = createServiceRoleClient();

  // Un agent voit toutes les demandes, tous agents confondus — confirmé
  // par le client (pas de filtre par agent assigné).
  const { data: requests } = await service
    .from('internship_request')
    .select(
      `id, statut, date_soumission,
       student:student_id ( nom_complet, numero_ine ),
       academic_assignment:academic_assignment_id ( program:program_id ( nom, departement ) )`,
    )
    .is('supprime_le', null)
    .order('date_soumission', { ascending: false });

  // L'invalidation est un état du document, pas de la demande — une
  // demande reste "validee" pour toujours même après invalidation. Il
  // faut donc consulter document séparément pour savoir lesquelles sont
  // concernées.
  const { data: docsInvalides } = await service
    .from('document')
    .select('internship_request_id')
    .eq('statut', 'invalide_manuellement');
  const idsInvalides = new Set((docsInvalides ?? []).map((d) => d.internship_request_id));

  const all = (requests ?? []).map((r) => ({
    ...r,
    statutAffiche: r.statut === 'validee' && idsInvalides.has(r.id) ? 'invalidee' : r.statut,
  }));

  const enAttente = all.filter((r) => r.statutAffiche === 'en_attente').length;
  const validees = all.filter((r) => r.statutAffiche === 'validee').length;
  const refusees = all.filter((r) => r.statutAffiche === 'refusee').length;
  const invalidees = all.filter((r) => r.statutAffiche === 'invalidee').length;

  let filtrees = filtreActif ? all.filter((r) => r.statutAffiche === filtreActif) : all;
  if (anneeActive) {
    filtrees = filtrees.filter((r) => new Date(r.date_soumission).getFullYear() === Number(anneeActive));
  }
  if (moisActif) {
    filtrees = filtrees.filter((r) => new Date(r.date_soumission).getMonth() + 1 === Number(moisActif));
  }

  const totalPages = Math.max(1, Math.ceil(filtrees.length / PAR_PAGE));
  const pageActuelle = Math.min(page, totalPages);
  const page_debut = (pageActuelle - 1) * PAR_PAGE;
  const visibles = filtrees.slice(page_debut, page_debut + PAR_PAGE);

  const anneesDisponibles = Array.from(new Set(all.map((r) => new Date(r.date_soumission).getFullYear()))).sort((a, b) => b - a);

  function construireLien(overrides: { filtre?: string; annee?: string; mois?: string; page?: number }) {
    const params = new URLSearchParams();
    const f = 'filtre' in overrides ? overrides.filtre : filtreActif;
    const a = 'annee' in overrides ? overrides.annee : anneeActive;
    const m = 'mois' in overrides ? overrides.mois : moisActif;
    if (f) params.set('filtre', f);
    if (a) params.set('annee', a);
    if (m) params.set('mois', m);
    if (overrides.page && overrides.page > 1) params.set('page', String(overrides.page));
    const qs = params.toString();
    return `/agent/demandes${qs ? `?${qs}` : ''}`;
  }

  const exportParams = new URLSearchParams();
  if (filtreActif) exportParams.set('statut', filtreActif);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Demandes de stage</h1>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {filtreActif || anneeActive || moisActif ? 'Filtré' : 'Toutes les demandes, tous agents confondus.'}
          {(filtreActif || anneeActive || moisActif) && (
            <Link href="/agent/demandes" className="ml-2 text-[#1F3B4D] underline">
              Réinitialiser
            </Link>
          )}
        </p>
        <div className="flex gap-3 text-sm">
          <a href={`/agent/export?format=pdf${exportParams.toString() ? `&${exportParams}` : ''}`} className="text-[#1F3B4D] underline">Télécharger en PDF</a>
          <a href={`/agent/export?format=xlsx${exportParams.toString() ? `&${exportParams}` : ''}`} className="text-[#1F3B4D] underline">Télécharger en Excel</a>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <FiltreAnneeMois anneesDisponibles={anneesDisponibles} anneeActive={anneeActive} moisActif={moisActif} construireLien={construireLien} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-lg sm:grid-cols-4">
        <Kpi label="À vérifier" value={enAttente} couleur="jaune" href={construireLien({ filtre: filtreActif === 'en_attente' ? undefined : 'en_attente', page: 1 })} actif={filtreActif === 'en_attente'} />
        <Kpi label="Document généré" value={validees} couleur="vert" href={construireLien({ filtre: filtreActif === 'validee' ? undefined : 'validee', page: 1 })} actif={filtreActif === 'validee'} />
        <Kpi label="Refusées" value={refusees} couleur="rouge" href={construireLien({ filtre: filtreActif === 'refusee' ? undefined : 'refusee', page: 1 })} actif={filtreActif === 'refusee'} />
        <Kpi label="Invalidée" value={invalidees} couleur="rouge" href={construireLien({ filtre: filtreActif === 'invalidee' ? undefined : 'invalidee', page: 1 })} actif={filtreActif === 'invalidee'} />
      </div>

      <div className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {visibles.length === 0 && <p className="p-5 text-sm text-slate-500">Aucune demande pour ce filtre.</p>}
        {visibles.map((r) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const student = r.student as any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const assignment = r.academic_assignment as any;
          return (
            <Link
              key={r.id}
              href={`/agent/demandes/${r.id}`}
              className="flex items-center justify-between p-4 text-sm hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-900">{student?.nom_complet}</p>
                <p className="text-slate-500">
                  {student?.numero_ine} · {assignment?.program?.departement}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUT_STYLE[r.statutAffiche] ?? ''}`}>
                {STATUT_LABEL[r.statutAffiche] ?? r.statutAffiche}
              </span>
            </Link>
          );
        })}
      </div>

      {filtrees.length > PAR_PAGE && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            {page_debut + 1}–{Math.min(page_debut + PAR_PAGE, filtrees.length)} sur {filtrees.length}
          </span>
          <div className="flex gap-2">
            <Link
              href={construireLien({ page: pageActuelle - 1 })}
              aria-disabled={pageActuelle <= 1}
              className={`rounded-md border border-slate-300 px-3 py-1.5 ${pageActuelle <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50'}`}
            >
              ← Précédent
            </Link>
            <Link
              href={construireLien({ page: pageActuelle + 1 })}
              aria-disabled={pageActuelle >= totalPages}
              className={`rounded-md border border-slate-300 px-3 py-1.5 ${pageActuelle >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50'}`}
            >
              Suivant →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function FiltreAnneeMois({
  anneesDisponibles,
  anneeActive,
  moisActif,
  construireLien,
}: {
  anneesDisponibles: number[];
  anneeActive?: string;
  moisActif?: string;
  construireLien: (o: { annee?: string; mois?: string; page?: number }) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-500">Filtrer par :</span>
      {anneesDisponibles.map((a) => (
        <Link
          key={a}
          href={construireLien({ annee: anneeActive === String(a) ? undefined : String(a), page: 1 })}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            anneeActive === String(a) ? 'border-[#1F3B4D] bg-[#1F3B4D] text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {a}
        </Link>
      ))}
      {anneeActive &&
        MOIS_LABEL.map((label, i) => (
          <Link
            key={label}
            href={construireLien({ mois: moisActif === String(i + 1) ? undefined : String(i + 1), page: 1 })}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              moisActif === String(i + 1) ? 'border-[#1F3B4D] bg-[#1F3B4D] text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label.slice(0, 3)}
          </Link>
        ))}
    </div>
  );
}

function Kpi({
  label,
  value,
  couleur,
  href,
  actif,
}: {
  label: string;
  value: number;
  couleur: 'jaune' | 'vert' | 'rouge';
  href: string;
  actif: boolean;
}) {
  const styles = {
    jaune: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    vert: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
    rouge: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  }[couleur];

  return (
    <Link
      href={href}
      className={`rounded-lg border p-3 transition ${styles.border} ${styles.bg} ${actif ? 'ring-2 ring-offset-1' : 'hover:opacity-80'}`}
    >
      <p className={`text-xl font-bold ${styles.text}`}>{value}</p>
      <p className={`text-[11px] ${styles.text}`}>{label}</p>
    </Link>
  );
}
