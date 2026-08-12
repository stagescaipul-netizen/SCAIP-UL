import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <Image
        src="/logo/universite-labe.png"
        alt="Université de Labé"
        width={489}
        height={129}
        className="mx-auto mb-8 h-12 w-auto"
        priority
      />
      <h1 className="text-center text-lg font-semibold text-slate-900">
        Permission de Stage Digital | SCAIP-UL
      </h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        Autorisation de Stage et Lettre de Recommandation
      </p>
      <p className="mt-4 text-center text-sm text-slate-700">
        Bonjour, que souhaitez-vous faire ?
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/demande/nouvelle"
          className="flex h-14 items-center justify-center rounded-lg bg-[#1F3B4D] px-4 text-center text-sm font-semibold text-white"
        >
          Nouvelle demande
        </Link>
        <Link
          href="/suivi"
          className="flex h-14 items-center justify-center rounded-lg border border-[#1F3B4D] px-4 text-center text-sm font-semibold text-[#1F3B4D]"
        >
          Suivre une demande
        </Link>
      </div>
    </main>
  );
}