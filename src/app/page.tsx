import Link from "next/link";
import { getEntryBySlug, makeResolver, isLocaleCode, DEFAULT_LOCALE } from "@/lib/cms";
import { FeatureIcon } from "@/lib/icons";
import { CheckboxGrid } from "@/components/checkbox-grid";

export const revalidate = 30;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  const { locale: rawLocale } = await searchParams;
  const locale = isLocaleCode(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  const { entry: page, includes } = await getEntryBySlug("landing_page", "home", locale, 2);

  if (!page) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">No landing page found</h1>
        <p className="mt-2 text-black/60 dark:text-white/60">
          Publish a &ldquo;Landing Page&rdquo; entry with slug &ldquo;home&rdquo; in Ondros CMS.
        </p>
      </div>
    );
  }

  const resolve = makeResolver(includes);
  const hero = resolve(page.fields.hero);
  const cards = ((page.fields.sections as string[]) ?? [])
    .map(resolve)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <div>
      <section className="relative overflow-hidden bg-black">
        <CheckboxGrid />
        <div className="relative mx-auto max-w-5xl px-6 py-32 text-center">
          <span className="font-display inline-block rounded-none border border-[#ed1515]/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#ed1515]">
            Ondros Demo Site
          </span>
          <h1 className="font-display mt-6 text-4xl font-extrabold uppercase tracking-tight text-white sm:text-6xl">
            {(hero?.fields.heading as string) ?? (page.fields.title as string)}
          </h1>
          {hero?.fields.subheading ? (
            <p className="mx-auto mt-5 max-w-xl text-lg text-neutral-400">
              {hero.fields.subheading as string}
            </p>
          ) : null}
          {hero?.fields.cta_label ? (
            <div className="mt-10">
              <Link
                href={locale === DEFAULT_LOCALE ? "/articles" : `/articles?locale=${locale}`}
                className="font-display group relative inline-block overflow-hidden border border-[#ed1515] px-7 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:text-black"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-[#ed1515] transition-transform duration-300 group-hover:translate-x-0"
                />
                <span className="relative">{hero.fields.cta_label as string}</span>
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {cards.length > 0 ? (
        <section className="mx-auto max-w-5xl px-6 py-20">
          <div className="grid gap-px bg-neutral-200 dark:bg-white/10 sm:grid-cols-3">
            {cards.map((card) => (
              <div
                key={card.id}
                className="group relative bg-white p-8 transition hover:bg-black dark:bg-black"
              >
                <div className="inline-flex h-11 w-11 items-center justify-center border border-black/10 text-black transition group-hover:border-[#ed1515] group-hover:text-[#ed1515] dark:border-white/10 dark:text-white">
                  <FeatureIcon name={card.fields.icon as string} className="h-5 w-5" />
                </div>
                <h3 className="font-display mt-5 text-sm font-bold uppercase tracking-wider text-black transition group-hover:text-white dark:text-white">
                  {card.fields.title as string}
                </h3>
                <p className="mt-2 text-sm text-neutral-600 transition group-hover:text-neutral-400 dark:text-neutral-400">
                  {card.fields.body as string}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
