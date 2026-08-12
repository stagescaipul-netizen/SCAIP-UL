import { getCurrentUser } from '@/lib/auth/current-user';
import { redirect } from 'next/navigation';
import ProfilForm from './profil-form';

export const dynamic = 'force-dynamic';

export default async function ProfilPage() {
  const user = await getCurrentUser();
  if (user.role !== 'agent') {
    redirect('/connexion');
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Mon profil</h1>
      <p className="mt-1 text-sm text-slate-500">Modifiez votre nom ou votre mot de passe.</p>
      <ProfilForm nomComplet={user.nomComplet} />
    </div>
  );
}
