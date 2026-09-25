import { notFound } from "next/navigation";
import { getEntryBySlug, makeResolver } from "@/lib/cms";
import RichText from "@/components/rich-text";
import { readPreview, resource, prop, type SearchParams } from "@/lib/preview";

export const revalidate = 30;

export default async function ArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const { preview, locale } = readPreview(await searchParams);

  const { entry: article, includes } = await getEntryBySlug("article", slug, locale, 1, {
    preview,
  });

  if (!article) notFound();

  const publishedDate = article.fields.published_date as string | undefined;

  return (
    <div className="bg-white dark:bg-black">
      <article
        {...resource(article.id, article.contentType.apiId)}
        className="mx-auto max-w-3xl px-6 py-16"
      >
        <div className="mb-4 h-1 w-16 bg-[#ed1515]" />
        <h1
          {...prop("title", "text", "Title")}
          className="font-display text-3xl font-extrabold uppercase tracking-tight text-black dark:text-white"
        >
          {article.fields.title as string}
        </h1>
        {publishedDate ? (
          <p
            {...prop("published_date", "datetime", "Publish date")}
            className="mt-2 font-display text-xs font-semibold uppercase tracking-widest text-[#ed1515]"
          >
            {new Date(publishedDate).toLocaleDateString(locale, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        ) : null}
        <RichText
          {...prop("body", "richtext", "Body")}
          value={article.fields.body}
          resolve={makeResolver(includes)}
          className="prose prose-neutral mt-8 max-w-none border border-neutral-200 p-8 dark:prose-invert dark:border-white/10"
        />
      </article>
    </div>
  );
}
