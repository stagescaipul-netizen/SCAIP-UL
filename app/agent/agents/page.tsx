import { getCurrentUser } from '@/lib/auth/current-user';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import AjouterAgentForm from './ajouter-agent-form';
import AgentRowActions from './agent-row-actions';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const user = await getCurrentUser();
  if (user.role !== 'agent') {
    redirect('/connexion');
  }

  const service = createServiceRoleClient();
  const { data: agents } = await service
    .from('teacher')
    .select('id, nom_complet, email_professionnel, est_admin, est_admin_principal, actif')
    .order('nom_complet');

  const nombrePrincipaux = agents?.filter((a) => a.est_admin_principal).length ?? 0;

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Agents</h1>
          <p className="mt-1 text-sm text-slate-500">
            Personnes habilitées à traiter les demandes et à administrer la plateforme.
          </p>
        </div>
      </div>

      {user.role === 'agent' && user.estAdminPrincipal && <AjouterAgentForm />}
      {user.role === 'agent' && !user.estAdminPrincipal && (
        <p className="mt-4 text-sm text-slate-500">
          Seul l&apos;administrateur principal peut ajouter ou retirer des comptes.
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Email professionnel</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Statut</th>
              {user.role === 'agent' && user.estAdminPrincipal && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {agents?.map((a) => (
              <tr key={a.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{a.nom_complet}</td>
                <td className="px-4 py-3">{a.email_professionnel}</td>
                <td className="px-4 py-3">
                  {a.est_admin_principal ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      Admin principal
                    </span>
                  ) : a.est_admin ? (
                    <span className="rounded-full bg-[#E9EEF1] px-2.5 py-0.5 text-xs font-semibold text-[#1F3B4D]">
                      Administrateur
                    </span>
                  ) : (
                    <span className="text-slate-500">Agent</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      a.actif ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {a.actif ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                {user.role === 'agent' && user.estAdminPrincipal && (
                  <td className="px-4 py-3">
                    <AgentRowActions agentId={a.id} estAdminPrincipal={a.est_admin_principal} actif={a.actif} nombrePrincipaux={nombrePrincipaux} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
