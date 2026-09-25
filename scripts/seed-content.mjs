#!/usr/bin/env node
/**
 * Create this site's content model and copy in an Ondros CMS space.
 *
 *   node scripts/seed-content.mjs            # create, then publish
 *   node scripts/seed-content.mjs --draft    # create, leave everything draft
 *   node scripts/seed-content.mjs --dry-run  # print what it would do
 *
 * Configuration is read from .env (the same file the site uses), overridden by
 * anything exported in the shell. Needs a MANAGEMENT token (cms_mgm_…) or a
 * user JWT — delivery and preview keys are read-only and cannot create
 * anything:
 *
 *   CMS_URL=https://your-cms.example.com
 *   CMS_SPACE_ID=…
 *   CMS_ENVIRONMENT=master
 *   CMS_MANAGEMENT_TOKEN=cms_mgm_…
 *
 * Safe to re-run. A content type that already exists is reused rather than
 * duplicated, and an entry whose slug is taken is skipped — so this tops up a
 * partially-seeded space instead of failing halfway.
 */
import { readFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CONTENT = join(ROOT, "content", "demo-content.json");

/**
 * Load .env into process.env.
 *
 * Next.js loads env files for `next dev` and `next build`, but a plain
 * `node scripts/…` does not — so without this the script would sit next to a
 * filled-in .env insisting nothing is configured.
 *
 * `.env` is this project's config file: Next reads it too, so the site and
 * this script always agree. `.env.local` is still read as a fallback for
 * checkouts that already have one, but keeping both is asking for trouble —
 * Next gives `.env.local` the higher precedence, so the two would disagree.
 *
 * Anything already exported wins over both. Hand-rolled rather than
 * process.loadEnvFile so the precedence is explicit and it runs on any Node 20+.
 */
function loadEnvFiles() {
  for (const file of [".env", ".env.local"]) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      // An exported-but-empty var shouldn't mask a real value in the file.
      if (!key || (key in process.env && process.env[key] !== "")) continue;
      let value = trimmed.slice(eq + 1).trim();
      // Strip one layer of matching quotes, the way dotenv does.
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value) process.env[key] = value;
    }
  }
}

loadEnvFiles();

const DRY_RUN = process.argv.includes("--dry-run");
const PUBLISH = !process.argv.includes("--draft");

const url = process.env.CMS_URL;
const spaceId = process.env.CMS_SPACE_ID;
const environment = process.env.CMS_ENVIRONMENT ?? "master";
const token = process.env.CMS_MANAGEMENT_TOKEN;

function die(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

if (!url || !spaceId || !token) {
  const missing = [
    !url && "CMS_URL",
    !spaceId && "CMS_SPACE_ID",
    !token && "CMS_MANAGEMENT_TOKEN",
  ].filter(Boolean);
  const looked = [".env", ".env.local"].filter((f) => existsSync(join(ROOT, f)));
  die(
    `Missing ${missing.join(", ")}.\n` +
      (looked.length
        ? `  Read ${looked.join(" and ")} — add the missing key(s) there.\n`
        : `  No .env found in ${ROOT}. Copy .env.example to .env.\n`) +
      "  The management token comes from Settings → API keys (type: Management).\n" +
      "  A delivery or preview key will not work — they cannot write."
  );
}

const envRoot = `${url}/spaces/${spaceId}/environments/${environment}`;

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${url.replace(/\/$/, "")}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

function rel(path) {
  return path.replace(url.replace(/\/$/, ""), "");
}

/** Replace {"$ref": "…"} placeholders with the ids of entries made earlier. */
function resolveRefs(value, ids) {
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, ids));
  if (value && typeof value === "object") {
    if (typeof value.$ref === "string") {
      const id = ids.get(value.$ref);
      if (!id) throw new Error(`Unknown entry ref "${value.$ref}"`);
      return id;
    }
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveRefs(v, ids)])
    );
  }
  return value;
}

/**
 * Find an entry this plan already created, so re-runs top up rather than
 * duplicate. Pages match on slug; blocks have none, so they match on the
 * content type's display field — unique across this content set.
 */
async function findExisting(entry, fields, typeIdByApiId) {
  const found = await api(
    rel(`${envRoot}/entries?content_type=${entry.contentType}&limit=200`)
  );
  if (!found.ok) return null;

  if (typeof fields.slug === "string" && fields.slug) {
    return found.body.items.find((e) => e.slug === fields.slug) ?? null;
  }

  const types = typeIdByApiId.get(entry.contentType);
  const displayField = entry.displayField ?? DISPLAY_FIELDS[entry.contentType];
  if (!displayField) return null;
  const wanted = strings(fields[displayField]);
  if (!wanted.size) return null;
  return (
    found.body.items.find((e) =>
      [...strings(e.fields?.[displayField])].some((v) => wanted.has(v))
    ) ?? null
  );
}

/**
 * Every string in a value, whether it is plain or a {locale: value} map.
 *
 * Comparing "the first value" would be a bug: the API returns locale maps in
 * whatever order Postgres stored them, so the same entry can come back
 * {fr, en-US} while the seed file says {en-US, fr}. Matching on any overlap is
 * order-independent.
 */
function strings(value) {
  if (typeof value === "string") return new Set(value.trim() ? [value] : []);
  if (value && typeof value === "object") {
    return new Set(
      Object.values(value).filter((v) => typeof v === "string" && v.trim())
    );
  }
  return new Set();
}

let DISPLAY_FIELDS = {};

async function main() {
  const plan = JSON.parse(await readFile(CONTENT, "utf8"));
  DISPLAY_FIELDS = Object.fromEntries(
    plan.contentTypes.map((t) => [t.api_id, t.display_field])
  );

  console.log(`\nOndros demo content`);
  console.log(`  space        ${spaceId}`);
  console.log(`  environment  ${environment}`);
  console.log(`  mode         ${DRY_RUN ? "dry run" : PUBLISH ? "create + publish" : "create as drafts"}\n`);

  if (DRY_RUN) {
    for (const ct of plan.contentTypes) {
      console.log(`  would create content type  ${ct.api_id} (${ct.fields.length} fields)`);
    }
    for (const entry of plan.entries) {
      console.log(`  would create entry         ${entry.contentType}  ${entry.ref}`);
    }
    console.log();
    return;
  }

  // --- locales ---------------------------------------------------------------
  // Publishing rejects a localized value for a locale the space doesn't have,
  // so the copy's locales have to exist before any of it can go live.
  for (const locale of plan.locales ?? []) {
    const res = await api(`/spaces/${spaceId}/locales`, { method: "POST", body: locale });
    if (res.status === 409) {
      console.log(`  = locale        ${locale.code}  (already configured)`);
      continue;
    }
    if (!res.ok) {
      die(
        `Adding locale ${locale.code} failed (${res.status}): ${JSON.stringify(res.body)}\n` +
          `  Add it by hand under Settings → Locales, then re-run.`
      );
    }
    console.log(`  + locale        ${locale.code}`);
  }

  // --- content types --------------------------------------------------------
  const existing = await api(rel(`${envRoot}/content-types`));
  if (!existing.ok) {
    die(
      `Could not read the content model (${existing.status}).\n` +
        `  ${JSON.stringify(existing.body)}\n` +
        `  Check CMS_URL, CMS_SPACE_ID and that the token is a management key.`
    );
  }
  const haveTypes = new Set(existing.body.map((t) => t.api_id));

  for (const ct of plan.contentTypes) {
    if (haveTypes.has(ct.api_id)) {
      console.log(`  = content type  ${ct.api_id}  (already exists, left alone)`);
      continue;
    }
    const res = await api(rel(`${envRoot}/content-types`), { method: "POST", body: ct });
    if (!res.ok) die(`Creating content type ${ct.api_id} failed (${res.status}): ${JSON.stringify(res.body)}`);
    console.log(`  + content type  ${ct.api_id}`);
  }

  // Re-read so every type has an id, including the ones just made.
  const types = (await api(rel(`${envRoot}/content-types`))).body;
  const typeIdByApiId = new Map(types.map((t) => [t.api_id, t.id]));

  // --- entries --------------------------------------------------------------
  // Blocks are listed before the pages that reference them, so a $ref always
  // resolves against something already created.
  const ids = new Map();
  let created = 0;
  let published = 0;

  for (const entry of plan.entries) {
    const contentTypeId = typeIdByApiId.get(entry.contentType);
    if (!contentTypeId) die(`No content type "${entry.contentType}" in this environment`);

    const fields = resolveRefs(entry.fields, ids);

    // A block models no slug, so creating one again would never collide — it
    // would just silently add a second hero. Look first.
    const duplicate = await findExisting(entry, fields, typeIdByApiId);
    if (duplicate) {
      ids.set(entry.ref, duplicate.id);
      console.log(`  = entry         ${entry.contentType.padEnd(13)} ${entry.ref}  (exists, reused)`);
      continue;
    }

    const res = await api(rel(`${envRoot}/entries`), {
      method: "POST",
      body: { content_type_id: contentTypeId, fields },
    });

    if (res.status === 409) {
      // Slug already taken: reuse the existing entry so references still wire up.
      const match = await findExisting(entry, fields, typeIdByApiId);
      if (!match) die(`Entry ${entry.ref} exists but could not be found to reuse`);
      ids.set(entry.ref, match.id);
      console.log(`  = entry         ${entry.contentType.padEnd(13)} ${entry.ref}  (exists, reused)`);
      continue;
    }
    if (!res.ok) die(`Creating entry ${entry.ref} failed (${res.status}): ${JSON.stringify(res.body)}`);

    ids.set(entry.ref, res.body.id);
    created += 1;
    console.log(`  + entry         ${entry.contentType.padEnd(13)} ${entry.ref}`);
  }

  // --- publish ---------------------------------------------------------------
  // Publishing is a second pass: validation checks that every referenced entry
  // exists, so a page cannot be published before the blocks it points at.
  if (PUBLISH) {
    for (const entry of plan.entries) {
      const id = ids.get(entry.ref);
      if (!id) continue;
      const res = await api(`/entries/${id}/publish`, { method: "POST" });
      if (!res.ok) {
        const detail = res.body?.detail;
        const errors = detail?.errors ? `\n      ${detail.errors.join("\n      ")}` : "";
        console.warn(`  ! publish failed for ${entry.ref} (${res.status})${errors || `: ${JSON.stringify(detail)}`}`);
        continue;
      }
      published += 1;
    }
  }

  console.log(
    `\n✓ ${created} entr${created === 1 ? "y" : "ies"} created` +
      (PUBLISH ? `, ${published} published` : ", left as drafts") +
      `\n`
  );
  console.log(`  Next: point .env at this space and run \`npm run dev\`.`);
  console.log(`  The landing page renders at /, the articles at /articles.\n`);
}

main().catch((err) => die(err.stack ?? String(err)));
