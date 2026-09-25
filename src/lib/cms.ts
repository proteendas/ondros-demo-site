export type CmsEntry = {
  id: string;
  /** Null for content types that model no `slug` field (reusable blocks). */
  slug: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  contentType: {
    apiId: string;
    name: string;
    displayField: string;
    /** Id of the type's slug field, or null when its entries have no URL. */
    slugField?: string | null;
  };
  fields: Record<string, unknown>;
};

type EntriesResponse = {
  items: CmsEntry[];
  total: number;
  includes: { Entry: CmsEntry[]; Asset: unknown[] };
};

export const LOCALES = [
  { code: "en-US", label: "English" },
  { code: "fr", label: "Français" },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: LocaleCode = "en-US";

export function isLocaleCode(value: string | undefined): value is LocaleCode {
  return LOCALES.some((l) => l.code === value);
}

const baseUrl = process.env.CMS_URL;
const spaceId = process.env.CMS_SPACE_ID;
const environment = process.env.CMS_ENVIRONMENT ?? "master";
const token = process.env.CMS_DELIVERY_TOKEN;
/**
 * Preview key (`cms_pre_…`). The delivery key only ever returns published
 * entries, so without this the Ondros editor would preview stale content —
 * every unsaved draft would be invisible.
 */
const previewToken = process.env.CMS_PREVIEW_TOKEN;

/** Public CMS origin, used in the browser for the Code Sync bridge script. */
export const CMS_BROWSER_URL =
  process.env.NEXT_PUBLIC_CMS_URL ?? process.env.CMS_URL ?? "http://localhost:8000";

function root() {
  return `${baseUrl}/spaces/${spaceId}/environments/${environment}/delivery`;
}

export type FetchOptions = {
  /**
   * Render drafts instead of published content. Set when the page is open
   * inside the Ondros editor (see readPreview in ./preview).
   */
  preview?: boolean;
};

async function request<T>(
  path: string,
  params?: Record<string, string | number>,
  opts: FetchOptions = {}
): Promise<T> {
  const url = new URL(`${root()}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, String(value));
  }
  const usePreview = Boolean(opts.preview && previewToken);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${usePreview ? previewToken : token}` },
    // A preview has to show the draft as it is right now: a cached response
    // would make edits appear only every 30 seconds.
    ...(usePreview ? { cache: "no-store" as const } : { next: { revalidate: 30 } }),
  });
  if (!res.ok) {
    throw new Error(`CMS request failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export async function getEntries(
  contentType: string,
  locale: LocaleCode = DEFAULT_LOCALE,
  include = 0,
  opts: FetchOptions = {}
): Promise<EntriesResponse> {
  return request<EntriesResponse>(
    "/entries",
    { content_type: contentType, locale, include },
    opts
  );
}

export async function getEntryBySlug(
  contentType: string,
  slug: string,
  locale: LocaleCode = DEFAULT_LOCALE,
  include = 0,
  opts: FetchOptions = {}
): Promise<{ entry: CmsEntry | null; includes: CmsEntry[] }> {
  const res = await request<EntriesResponse>(
    "/entries",
    { content_type: contentType, slug, locale, include },
    opts
  );
  return { entry: res.items[0] ?? null, includes: res.includes.Entry };
}

export function makeResolver(includes: CmsEntry[]) {
  const byId = new Map(includes.map((entry) => [entry.id, entry]));
  return (ref: unknown): CmsEntry | undefined => {
    if (typeof ref !== "string") return undefined;
    return byId.get(ref);
  };
}
