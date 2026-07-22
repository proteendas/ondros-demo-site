export type CmsEntry = {
  id: string;
  slug: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  contentType: { apiId: string; name: string; displayField: string };
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

function root() {
  return `${baseUrl}/spaces/${spaceId}/environments/${environment}/delivery`;
}

async function request<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${root()}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 30 },
  });
  if (!res.ok) {
    throw new Error(`CMS request failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export async function getEntries(
  contentType: string,
  locale: LocaleCode = DEFAULT_LOCALE,
  include = 0
): Promise<EntriesResponse> {
  return request<EntriesResponse>("/entries", { content_type: contentType, locale, include });
}

export async function getEntryBySlug(
  contentType: string,
  slug: string,
  locale: LocaleCode = DEFAULT_LOCALE,
  include = 0
): Promise<{ entry: CmsEntry | null; includes: CmsEntry[] }> {
  const res = await request<EntriesResponse>("/entries", {
    content_type: contentType,
    slug,
    locale,
    include,
  });
  return { entry: res.items[0] ?? null, includes: res.includes.Entry };
}

export function makeResolver(includes: CmsEntry[]) {
  const byId = new Map(includes.map((entry) => [entry.id, entry]));
  return (ref: unknown): CmsEntry | undefined => {
    if (typeof ref !== "string") return undefined;
    return byId.get(ref);
  };
}
