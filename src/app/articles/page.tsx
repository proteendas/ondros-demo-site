import Link from "next/link";
import { getEntries, isLocaleCode, DEFAULT_LOCALE } from "@/lib/cms";

export const revalidate = 30;

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  const { locale: rawLocale } = await searchParams;
  const locale = isLocaleCode(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const suffix = locale === DEFAULT_LOCALE ? "" : `?locale=${locale}`;

  const { items } = await getEntries("article", locale);

  return (
    <div className="bg-white dark:bg-black">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight text-black dark:text-white">
          Articles<span className="text-[#ed1515]">.</span>
        </h1>
        <ul className="mt-10 divide-y divide-neutral-200 dark:divide-white/10">
          {items.map((article) => (
            <li key={article.id}>
              <Link
                href={`/articles/${article.slug}${suffix}`}
                className="group block border-l-2 border-transparent py-6 pl-4 transition hover:border-[#ed1515] hover:bg-neutral-50 dark:hover:bg-white/5"
              >
                <h2 className="text-xl font-semibold text-black group-hover:text-[#ed1515] dark:text-white">
                  {article.fields.title as string}
                </h2>
                {article.fields.excerpt ? (
                  <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                    {article.fields.excerpt as string}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
          {items.length === 0 ? (
            <p className="py-6 text-neutral-600 dark:text-neutral-400">
              No articles published yet.
            </p>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
