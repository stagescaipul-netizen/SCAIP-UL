import { getCurrentUser } from '@/lib/auth/current-user';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import CorbeilleActions from './corbeille-actions';

export const dynamic = 'force-dynamic';

const PAR_PAGE = 15;

export default async function CorbeillePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (user.role !== 'agent') {
    redirect('/connexion');
  }

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const service = createServiceRoleClient();
  const { data: requests } = await service
    .from('internship_request')
    .select(
      `id, statut, supprime_le,
       student:student_id ( nom_complet, numero_ine )`,
    )
    .not('supprime_le', 'is', null)
    .order('supprime_le', { ascending: false });

  const all = requests ?? [];
  const totalPages = Math.max(1, Math.ceil(all.length / PAR_PAGE));
  const pageActuelle = Math.min(page, totalPages);
  const debut = (pageActuelle - 1) * PAR_PAGE;
  const visibles = all.slice(debut, debut + PAR_PAGE);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Corbeille</h1>
      <p className="mt-1 text-sm text-slate-500">
        Demandes retirées des listes. Restaurables tant qu&apos;elles ne sont pas supprimées définitivement.
      </p>

      <div className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {visibles.length === 0 && (
          <p className="p-5 text-sm text-slate-500">La corbeille est vide.</p>
        )}
        {visibles.map((r) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const student = r.student as any;
          return (
            <div key={r.id} className="flex items-center justify-between p-4 text-sm">
              <div>
                <p className="font-medium text-slate-900">{student?.nom_complet}</p>
                <p className="text-slate-500">
                  {student?.numero_ine} · statut d&apos;origine : {r.statut}
                </p>
              </div>
              <CorbeilleActions requestId={r.id} peutSupprimerDefinitivement={user.role === 'agent' && user.estAdminPrincipal} />
            </div>
          );
        })}
      </div>

      {all.length > PAR_PAGE && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            {debut + 1}–{Math.min(debut + PAR_PAGE, all.length)} sur {all.length}
          </span>
          <div className="flex gap-2">
            <Link
              href={`/agent/corbeille?page=${pageActuelle - 1}`}
              aria-disabled={pageActuelle <= 1}
              className={`rounded-md border border-slate-300 px-3 py-1.5 ${pageActuelle <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50'}`}
            >
              ← Précédent
            </Link>
            <Link
              href={`/agent/corbeille?page=${pageActuelle + 1}`}
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
