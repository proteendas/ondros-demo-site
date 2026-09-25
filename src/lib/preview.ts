/**
 * Ondros Code Sync preview state.
 *
 * When this site is open inside the Ondros editor, the editor loads it with a
 * handful of query parameters (see docs/20-code-sync.md in the CMS repo):
 *
 *   ondros-preview=<ticket>   signed permission to render drafts
 *   ondros-locale=<code>      the locale the editor has active
 *   ondros-focus=<entry uuid> a block to reveal, when previewing a component
 *   ondros-slug=<slug>        which entry of a single-route page to render
 *   ondros-environment=<key>  which environment the editor is working in
 *
 * `ondros-preview` is a **credential**, not a flag. Drafts are unpublished
 * content, so a preview must not be unlockable by typing a query parameter:
 * the ticket is signed by the CMS for an authenticated user and verified here
 * against ONDROS_PREVIEW_SECRET. Every other parameter only matters once that
 * check passes.
 *
 * Reading them here keeps every page from re-deriving the same thing, and
 * keeps the parameter names in one place.
 */
import { DEFAULT_LOCALE, isLocaleCode, type LocaleCode } from "@/lib/cms";
import { verifyPreviewTicket } from "@/lib/preview-ticket";

const PREVIEW_SECRET = process.env.ONDROS_PREVIEW_SECRET;

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
  // Fails closed: an unverifiable ticket is simply not a preview, so the page
  // still renders — with published content, as it would for any visitor.
  const ticket = verifyPreviewTicket(one(searchParams["ondros-preview"]), PREVIEW_SECRET, {
    environment: one(searchParams["ondros-environment"]),
  });
  const preview = ticket !== null;
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
