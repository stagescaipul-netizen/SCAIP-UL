import { getCurrentUser } from '@/lib/auth/current-user';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const PAR_PAGE = 15;

const STATUT_LABEL: Record<string, string> = {
  valide: 'En cours de validité',
  expire: 'Expiré',
  invalide: 'Invalidé',
};

const STATUT_STYLE: Record<string, string> = {
  valide: 'bg-emerald-50 text-emerald-700',
  expire: 'bg-slate-100 text-slate-500',
  invalide: 'bg-red-50 text-red-700',
};

const MOIS_LABEL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

type Dossier = {
  requestId: string;
  etudiant: string;
  refA?: string;
  refR?: string;
  fichierA?: string | null;
  fichierR?: string | null;
  dateEmission: string;
  dateExpiration: string;
  statutEffectif: 'valide' | 'expire' | 'invalide';
};

type DossierAffiche = Dossier & { urlDocuments?: string | null };

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; statut?: string; annee?: string; mois?: string }>;
}) {
  const user = await getCurrentUser();
  if (user.role !== 'agent') {
    redirect('/connexion');
  }

  const { page: pageParam, statut, annee, mois } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const statutActif = ['valide', 'expire', 'invalide'].includes(statut ?? '') ? statut : undefined;
  const anneeActive = annee && /^\d{4}$/.test(annee) ? annee : undefined;
  const moisActif = mois && /^([1-9]|1[0-2])$/.test(mois) ? mois : undefined;

  const service = createServiceRoleClient();
  const { data: docs } = await service
    .from('document')
    .select(
      `id, type, reference, date_emission, date_expiration, statut, internship_request_id, fichier_pdf,
       internship_request:internship_request_id ( supprime_le, student:student_id ( nom_complet ) )`,
    )
    .order('date_emission', { ascending: false });

  // Étape 1 — uniquement les métadonnées, jamais d'URL signée ici. Les
  // deux documents d'un même dossier sont toujours générés (et invalidés)
  // ensemble — regroupés en une seule ligne, un seul statut effectif par
  // dossier. Les dossiers à la corbeille n'apparaissent pas ici.
  //
  // Le statut brut stocké en base ne vaut jamais "expire" — seule la
  // date le dit. Calculé ici, pas dans la colonne.
  const dossiers = new Map<string, Dossier>();
  const aujourdhui = new Date().toISOString().slice(0, 10);

  for (const d of docs ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = d.internship_request as any;
    if (req?.supprime_le) continue;

    const existing: Dossier =
      dossiers.get(d.internship_request_id) ?? {
        requestId: d.internship_request_id,
        etudiant: req?.student?.nom_complet ?? '',
        dateEmission: d.date_emission,
        dateExpiration: d.date_expiration,
        statutEffectif: 'valide',
      };
    if (d.type === 'autorisation') { existing.refA = d.reference; existing.fichierA = d.fichier_pdf; }
    if (d.type === 'recommandation') { existing.refR = d.reference; existing.fichierR = d.fichier_pdf; }

    if (d.statut === 'invalide_manuellement') {
      existing.statutEffectif = 'invalide';
    } else if (existing.statutEffectif !== 'invalide' && existing.dateExpiration < aujourdhui) {
      existing.statutEffectif = 'expire';
    }

    dossiers.set(d.internship_request_id, existing);
  }

  // Étape 2 — Map vers tableau.
  const tousLesDossiers = Array.from(dossiers.values());

  const nbValide = tousLesDossiers.filter((d) => d.statutEffectif === 'valide').length;
  const nbExpire = tousLesDossiers.filter((d) => d.statutEffectif === 'expire').length;
  const nbInvalide = tousLesDossiers.filter((d) => d.statutEffectif === 'invalide').length;

  let lignes = statutActif ? tousLesDossiers.filter((d) => d.statutEffectif === statutActif) : tousLesDossiers;
  if (anneeActive) {
    lignes = lignes.filter((d) => new Date(d.dateEmission).getFullYear() === Number(anneeActive));
  }
  if (moisActif) {
    lignes = lignes.filter((d) => new Date(d.dateEmission).getMonth() + 1 === Number(moisActif));
  }

  const anneesDisponibles = Array.from(new Set(tousLesDossiers.map((d) => new Date(d.dateEmission).getFullYear()))).sort((a, b) => b - a);

  // Étape 3 — pagination, avant toute génération d'URL.
  const totalPages = Math.max(1, Math.ceil(lignes.length / PAR_PAGE));
  const pageActuelle = Math.min(page, totalPages);
  const debut = (pageActuelle - 1) * PAR_PAGE;
  const pageCourante = lignes.slice(debut, debut + PAR_PAGE);

  // Étape 4 — URL signées uniquement pour les 15 lignes réellement
  // affichées, en parallèle plutôt qu'une par une. Un échec sur un
  // fichier précis ne doit jamais faire planter le reste de la page —
  // la référence s'affiche alors sans lien plutôt que de tout bloquer.
  const visibles: DossierAffiche[] = await Promise.all(
    pageCourante.map(async (l) => {
      const pathDocumentsStage = `${l.requestId}/documents-stage.pdf`;
      const urlDocuments = await service.storage
        .from('documents')
        .createSignedUrl(pathDocumentsStage, 3600)
        .then((r) => r.data?.signedUrl ?? null, () => null);
      return { ...l, urlDocuments };
    }),
  );

  function construireLien(overrides: { statut?: string; annee?: string; mois?: string; page?: number }) {
    const params = new URLSearchParams();
    const s = 'statut' in overrides ? overrides.statut : statutActif;
    const a = 'annee' in overrides ? overrides.annee : anneeActive;
    const m = 'mois' in overrides ? overrides.mois : moisActif;
    if (s) params.set('statut', s);
    if (a) params.set('annee', a);
    if (m) params.set('mois', m);
    if (overrides.page && overrides.page > 1) params.set('page', String(overrides.page));
    const qs = params.toString();
    return `/agent/documents${qs ? `?${qs}` : ''}`;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Documents générés</h1>
      <p className="mt-1 text-sm text-slate-500">
        Archive des dossiers produits — Autorisation et Recommandation générées ensemble, regroupées ici en une
        seule ligne.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
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

      <div className="mt-4 grid grid-cols-3 gap-3 sm:max-w-md">
        <Kpi label="En cours de validité" value={nbValide} couleur="vert" href={construireLien({ statut: statutActif === 'valide' ? undefined : 'valide', page: 1 })} actif={statutActif === 'valide'} />
        <Kpi label="Expiré" value={nbExpire} couleur="gris" href={construireLien({ statut: statutActif === 'expire' ? undefined : 'expire', page: 1 })} actif={statutActif === 'expire'} />
        <Kpi label="Invalidé" value={nbInvalide} couleur="rouge" href={construireLien({ statut: statutActif === 'invalide' ? undefined : 'invalide', page: 1 })} actif={statutActif === 'invalide'} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Étudiant</th>
              <th className="px-4 py-3">Références</th>
              <th className="px-4 py-3">Émis le</th>
              <th className="px-4 py-3">Expire le</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Aucun document pour ce filtre.
                </td>
              </tr>
            )}
            {visibles.map((l, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{l.etudiant}</td>
                <td className="px-4 py-3 text-slate-700">
                  {l.refA && <div>{l.refA}</div>}
                  {l.refR && <div>{l.refR}</div>}
                  {l.urlDocuments && (
                    <a
                      href={l.urlDocuments}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex rounded-md bg-[#E9EEF1] px-2.5 py-1 text-xs font-semibold text-[#1F3B4D]"
                    >
                      Télécharger les 2 pages
                    </a>
                  )}
                </td>
                <td className="px-4 py-3">{l.dateEmission}</td>
                <td className="px-4 py-3">{l.dateExpiration}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUT_STYLE[l.statutEffectif]}`}>
                    {STATUT_LABEL[l.statutEffectif]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lignes.length > PAR_PAGE && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            {debut + 1}–{Math.min(debut + PAR_PAGE, lignes.length)} sur {lignes.length}
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

function Kpi({
  label,
  value,
  couleur,
  href,
  actif,
}: {
  label: string;
  value: number;
  couleur: 'vert' | 'gris' | 'rouge';
  href: string;
  actif: boolean;
}) {
  const styles = {
    vert: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
    gris: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-600' },
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
