'use client';

import { useEffect, useState } from 'react';
import NavLink from './nav-link';

export default function MobileNav() {
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    function fermerSurDesktop() {
      if (window.innerWidth >= 900) setOuvert(false);
    }
    window.addEventListener('resize', fermerSurDesktop);
    return () => window.removeEventListener('resize', fermerSurDesktop);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label="Ouvrir le menu"
        aria-expanded={ouvert}
        className="agent-menu-button flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
      </button>

      {ouvert && (
        <div className="agent-mobile-overlay fixed inset-0 z-50 bg-black/35" onClick={() => setOuvert(false)}>
          <aside
            className="h-full w-[min(82vw,320px)] overflow-y-auto bg-white px-4 py-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <strong className="text-sm text-slate-800">Menu</strong>
              <button
                type="button"
                onClick={() => setOuvert(false)}
                aria-label="Fermer le menu"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-xl text-slate-600"
              >
                ×
              </button>
            </div>

            <a
              href="/demande/nouvelle"
              target="_blank"
              rel="noopener noreferrer"
              className="mb-3 block rounded-md border border-[#1F3B4D] px-3 py-2.5 text-center text-sm font-semibold text-[#1F3B4D]"
            >
              + Nouvelle demande
            </a>

            <div onClick={() => setOuvert(false)}>
              <NavLink href="/agent/demandes" label="Demandes" />
              <NavLink href="/agent/documents" label="Documents générés" />
              <NavLink href="/agent/agents" label="Agents" />
              <NavLink href="/agent/corbeille" label="Corbeille" />
              <NavLink href="/agent/parametres" label="Paramètres" />
              <NavLink href="/agent/identite" label="Identité institutionnelle" />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
