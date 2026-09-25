#!/usr/bin/env node
/**
 * Create this site's content model and copy in an Ondros CMS space.
 *
 *   node scripts/seed-content.mjs            # create, then publish
 *   node scripts/seed-content.mjs --draft    # create, leave everything draft
 *   node scripts/seed-content.mjs --dry-run  # print what it would do
 *
 * Configuration is read from .env.local, then .env, then the environment
 * itself (which wins). Needs a MANAGEMENT token (cms_mgm_…) or a user JWT —
 * delivery and preview keys are read-only, so they cannot create anything:
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
 * Load .env.local / .env into process.env.
 *
 * Next.js loads these for `next dev` and `next build`, but a plain
 * `node scripts/…` does not — so without this the script would sit next to a
 * filled-in .env.local insisting nothing is configured.
 *
 * Precedence matches Next's: a variable already in the environment wins, then
 * .env.local, then .env. Deliberately hand-rolled rather than using
 * process.loadEnvFile so the precedence is explicit and it runs on any Node 20+.
 */
function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
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
  const looked = [".env.local", ".env"].filter((f) => existsSync(join(ROOT, f)));
  die(
    `Missing ${missing.join(", ")}.\n` +
      (looked.length
        ? `  Read ${looked.join(" and ")} — add the missing key(s) there.\n`
        : `  No .env.local or .env found in ${ROOT}.\n`) +
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

async function main() {
  const plan = JSON.parse(await readFile(CONTENT, "utf8"));

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
    const res = await api(rel(`${envRoot}/entries`), {
      method: "POST",
      body: { content_type_id: contentTypeId, fields },
    });

    if (res.status === 409) {
      // Slug already taken: find the existing entry so references still wire up.
      const slug = fields.slug;
      const found = await api(
        rel(`${envRoot}/entries?content_type=${entry.contentType}&limit=200`)
      );
      const match = found.ok ? found.body.items.find((e) => e.slug === slug) : null;
      if (!match) die(`Entry ${entry.ref} exists but could not be found to reuse`);
      ids.set(entry.ref, match.id);
      console.log(`  = entry         ${entry.contentType.padEnd(13)} ${entry.ref}  (slug taken, reused)`);
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
  console.log(`  Next: point .env.local at this space and run \`npm run dev\`.`);
  console.log(`  The landing page renders at /, the articles at /articles.\n`);
}

main().catch((err) => die(err.stack ?? String(err)));
