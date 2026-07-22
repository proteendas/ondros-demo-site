import { notFound } from "next/navigation";
import { getEntryBySlug, isLocaleCode, DEFAULT_LOCALE } from "@/lib/cms";

export const revalidate = 30;

export default async function ArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const { slug } = await params;
  const { locale: rawLocale } = await searchParams;
  const locale = isLocaleCode(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  const { entry: article } = await getEntryBySlug("article", slug, locale);

  if (!article) notFound();

  const publishedDate = article.fields.published_date as string | undefined;

  return (
    <div className="bg-white dark:bg-black">
      <article className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-4 h-1 w-16 bg-[#ed1515]" />
        <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-black dark:text-white">
          {article.fields.title as string}
        </h1>
        {publishedDate ? (
          <p className="mt-2 font-display text-xs font-semibold uppercase tracking-widest text-[#ed1515]">
            {new Date(publishedDate).toLocaleDateString(locale, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        ) : null}
        <div
          className="prose prose-neutral mt-8 max-w-none border border-neutral-200 p-8 dark:prose-invert dark:border-white/10"
          dangerouslySetInnerHTML={{ __html: article.fields.body as string }}
        />
      </article>
    </div>
  );
}
