'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      className={`mb-1 block rounded-md px-3 py-2.5 text-sm font-medium ${
        active ? 'bg-[#E9EEF1] font-semibold text-[#1F3B4D]' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
    </Link>
  );
}
