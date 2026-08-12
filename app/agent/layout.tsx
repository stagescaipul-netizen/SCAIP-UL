import Image from 'next/image';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/current-user';
import NavLink from './nav-link';
import MobileNav from './mobile-nav';
import { deconnexion } from './profil/actions';

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <MobileNav />
          <Image
            src="/logo/universite-labe.png"
            alt="Université de Labé"
            width={489}
            height={129}
            className="h-8 w-auto"
            priority
          />
        </div>
        {user.role === 'agent' && (
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <Link href="/agent/profil" className="hover:text-slate-700">
              {user.nomComplet}
              {user.estAdmin ? ' · admin' : ''}
            </Link>
            <form action={deconnexion}>
              <button type="submit" className="text-slate-500 underline hover:text-slate-700">
                Se déconnecter
              </button>
            </form>
          </div>
        )}
      </header>

      <div className="mx-auto flex max-w-6xl">
        <aside className="agent-desktop-sidebar w-56 shrink-0 border-r border-slate-200 bg-white px-3 py-6">
          <a
            href="/demande/nouvelle"
            target="_blank"
            rel="noopener noreferrer"
            className="mb-4 block rounded-md border border-[#1F3B4D] px-3 py-2.5 text-center text-sm font-semibold text-[#1F3B4D]"
          >
            + Nouvelle demande
          </a>
          <NavLink href="/agent/demandes" label="Demandes" />
          <NavLink href="/agent/documents" label="Documents générés" />
          <NavLink href="/agent/agents" label="Agents" />
          <NavLink href="/agent/corbeille" label="Corbeille" />
          <NavLink href="/agent/parametres" label="Paramètres" />
          <NavLink href="/agent/identite" label="Identité institutionnelle" />
        </aside>

        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
