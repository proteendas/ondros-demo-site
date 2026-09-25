/**
 * Ondros Code Sync preview state.
 *
 * When this site is open inside the Ondros editor, the editor loads it with a
 * handful of query parameters (see docs/20-code-sync.md in the CMS repo):
 *
 *   ondros-preview=1          render drafts, not published content
 *   ondros-locale=<code>      the locale the editor has active
 *   ondros-focus=<entry uuid> a block to reveal, when previewing a component
 *   ondros-slug=<slug>        which entry of a single-route page to render
 *
 * Reading them here keeps every page from re-deriving the same thing, and
 * keeps the parameter names in one place.
 */
import { DEFAULT_LOCALE, isLocaleCode, type LocaleCode } from "@/lib/cms";

export type SearchParams = Record<string, string | string[] | undefined>;

export type PreviewState = {
  /** True when the page is being rendered for the Ondros editor. */
  preview: boolean;
  locale: LocaleCode;
  /** Entry the editor wants revealed (the bridge script scrolls to it). */
  focus: string | null;
  /** Overrides which entry a single-route page renders, preview only. */
  slug: string | null;
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function readPreview(searchParams: SearchParams): PreviewState {
  const preview = one(searchParams["ondros-preview"]) === "1";
  // The editor's locale wins while previewing; otherwise the site's own
  // ?locale= switcher does.
  const raw = preview
    ? one(searchParams["ondros-locale"]) ?? one(searchParams.locale)
    : one(searchParams.locale);

  return {
    preview,
    locale: isLocaleCode(raw) ? raw : DEFAULT_LOCALE,
    focus: preview ? one(searchParams["ondros-focus"]) ?? null : null,
    slug: preview ? one(searchParams["ondros-slug"]) ?? null : null,
  };
}

/**
 * Attributes that tell the editor which entry a subtree renders.
 * Mirrors AEM's data-aue-resource.
 */
export function resource(entryId: string, contentType: string) {
  return {
    "data-ondros-resource": `entry:${entryId}`,
    "data-ondros-component": contentType,
  };
}

/** Attributes that tell the editor which field an element renders. */
export function prop(
  fieldId: string,
  type:
    | "text"
    | "longtext"
    | "richtext"
    | "select"
    | "number"
    | "media"
    | "reference"
    | "datetime",
  label?: string
) {
  return {
    "data-ondros-prop": fieldId,
    "data-ondros-type": type,
    ...(label ? { "data-ondros-label": label } : {}),
  };
}
