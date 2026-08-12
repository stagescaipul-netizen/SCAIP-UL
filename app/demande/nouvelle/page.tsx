import { createServiceRoleClient } from '@/lib/supabase/service';
import DemandeForm from './form-client';
import Script from 'next/script';

export const dynamic = 'force-dynamic';

export default async function DemandePage() {
  const service = createServiceRoleClient();

  const [{ data: levels }, { data: years }, { data: settings }] = await Promise.all([
    service.from('level').select('id, libelle').order('ordre'),
    service.from('academic_year').select('id, libelle').order('libelle', { ascending: false }),
    service.from('settings').select('duree_validite_document_mois').single(),
  ]);

  // Valeur de repli pour le rendu initial. Le composant client réalise ensuite
  // le tirage initial et l'alternance chef/directeur dans la session afin
  // d'éviter qu'un cache de navigation conserve toujours la même question.
  const typeResponsableVerification = 'chef_departement' as const;

  return (
    <>
      {process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY && (
        <Script src="https://js.hcaptcha.com/1/api.js" async defer />
      )}
      <DemandeForm
        levels={levels ?? []}
        years={years ?? []}
        typeResponsableVerification={typeResponsableVerification}
        dureeValiditeMois={settings?.duree_validite_document_mois ?? 3}
      />
    </>
  );
}
