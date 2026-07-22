"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { LOCALES, DEFAULT_LOCALE, isLocaleCode } from "@/lib/cms";

export function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawLocale = searchParams.get("locale") ?? undefined;
  const current = isLocaleCode(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  function handleChange(code: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (code === DEFAULT_LOCALE) {
      params.delete("locale");
    } else {
      params.set("locale", code);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="relative">
      <select
        aria-label="Change site language"
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-none border border-white/20 bg-white/5 py-1.5 pl-4 pr-8 font-display text-xs font-semibold uppercase tracking-widest text-white transition hover:border-[#ed1515]/60 hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-[#ed1515]"
      >
        {LOCALES.map((locale) => (
          <option key={locale.code} value={locale.code} className="bg-black text-white">
            {locale.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#ed1515]"
      >
        <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
