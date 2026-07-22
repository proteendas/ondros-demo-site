"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";

export function SiteHeader() {
  const searchParams = useSearchParams();
  const locale = searchParams.get("locale");
  const suffix = locale ? `?locale=${locale}` : "";

  return (
    <header className="relative border-b border-white/10 bg-black">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#ed1515] to-transparent"
      />
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href={`/${suffix}`}
          className="font-display text-lg font-bold uppercase tracking-[0.15em] text-white"
        >
          Acme<span className="text-[#ed1515]">.</span>
        </Link>
        <div className="flex items-center gap-6">
          <nav className="flex gap-6 font-display text-xs font-semibold uppercase tracking-widest text-neutral-400">
            <Link href={`/${suffix}`} className="transition hover:text-[#ed1515]">
              Home
            </Link>
            <Link href={`/articles${suffix}`} className="transition hover:text-[#ed1515]">
              Articles
            </Link>
          </nav>
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
