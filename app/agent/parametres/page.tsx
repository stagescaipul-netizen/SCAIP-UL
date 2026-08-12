import { getCurrentUser } from '@/lib/auth/current-user';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import ParametresForm from './parametres-form';
import AnneesSection from './annees-section';

export const dynamic = 'force-dynamic';

export default async function ParametresPage() {
  const user = await getCurrentUser();
  if (user.role !== 'agent') {
    redirect('/connexion');
  }

  const service = createServiceRoleClient();
  const { data: settings } = await service
    .from('settings')
    .select(
      'duree_validite_document_mois, duree_conservation_dossier_mois, delivrance_suspendue, mode_generation, generation_differee_delai_minutes',
    )
    .single();

  const { data: annees } = await service
    .from('academic_year')
    .select('id, libelle, date_debut, date_fin')
    .order('date_debut', { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Paramètres</h1>
      <p className="mt-1 text-sm text-slate-500">Réglages globaux — un seul jeu de valeurs pour tout l&apos;établissement.</p>

      <div className="mt-3 max-w-2xl rounded-md bg-amber-50 p-3 text-xs text-amber-800">
        <strong>Attention</strong> — ces réglages s&apos;appliquent immédiatement à toutes les demandes, y compris
        celles en cours de traitement.
      </div>

      {settings ? (
        <ParametresForm settings={settings} readOnly={!user.estAdmin} />
      ) : (
        <p className="mt-4 text-sm text-red-600">Aucun enregistrement de paramètres trouvé en base.</p>
      )}

      <div className="mt-5 max-w-2xl">
        <AnneesSection annees={annees ?? []} readOnly={!user.estAdmin} />
      </div>
    </div>
  );
}
