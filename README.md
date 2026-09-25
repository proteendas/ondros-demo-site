# Ondros demo site

A small marketing site rendered from [Ondros CMS](https://github.com/proteendas/cms),
and a **reference implementation of Ondros Code Sync** — the integration that
lets the CMS editor preview and edit this site's own pages in place, the way
Adobe's Universal Editor works.

Content comes from the delivery API; nothing is hard-coded.

| Route | Renders |
|---|---|
| `/` | the `landing_page` entry (hero + feature cards) |
| `/articles` | every published `article` |
| `/articles/[slug]` | one article |

---

## Running it

```bash
npm install
cp .env.example .env              # fill in the space id and tokens
node scripts/seed-content.mjs     # create the content model + copy in your space
npm run dev
```

> Use `.env`, not `.env.local`. Next.js reads both but gives `.env.local` the
> higher precedence, so keeping two copies is a reliable way to end up
> debugging a value you already changed.

The space id and API tokens come from the CMS: **Settings → API keys** (or the
`python -m app.seed` output for a local CMS).

| Variable | Why |
|---|---|
| `CMS_URL` | server-side CMS origin |
| `NEXT_PUBLIC_CMS_URL` | browser-side origin, for the bridge script. Defaults to `CMS_URL` |
| `CMS_SPACE_ID` | which space to read |
| `CMS_ENVIRONMENT` | `master` unless you're on a branch environment |
| `CMS_DELIVERY_TOKEN` | `cms_del_…` — published content, for visitors |
| `CMS_PREVIEW_TOKEN` | `cms_pre_…` — draft content, **required for editor previews** |

Without `CMS_PREVIEW_TOKEN` the site still works, but the editor's preview
shows published content only, so an author's unsaved draft appears to do
nothing.

---

## Seeding the content

This site renders four content types and expects a landing page with slug
`home`. Rather than clicking all that into the editor, create it in one go:

```bash
node scripts/seed-content.mjs
```

It reads the same `.env` the site uses, plus one more variable:

```bash
CMS_MANAGEMENT_TOKEN=cms_mgm_…
```

That must be a **Management** key (or a user JWT) — delivery and preview keys
are read-only and cannot create anything. Anything exported in your shell
overrides the file, so a one-off run against another environment is just:

```bash
CMS_ENVIRONMENT=staging node scripts/seed-content.mjs
```

| Flag | Effect |
|---|---|
| *(none)* | create everything, then publish it |
| `--draft` | create it, leave it unpublished so you can review in the editor first |
| `--dry-run` | print what it would create and exit |

It is safe to re-run: a content type that already exists is left alone, and an
entry whose slug is taken is reused rather than duplicated — so it tops up a
partially-seeded space instead of failing halfway.

### What it creates

| Type | Slug field? | Entries |
|---|---|---|
| `hero` | no — a block | 1 |
| `card` | no — a block | 3 |
| `landing_page` | yes | 1 (`home`) |
| `article` | yes | 3 |

`hero` and `card` deliberately model **no slug**. They are the blocks that
demonstrate component-wise preview: opening one in the editor shows it inside
the landing page that references it, rather than on a page of its own.

Text is written in both `en-US` and `fr` so the header's language switcher has
something to switch between, and so localized-field behaviour is visible.

### Editing the copy

All of it lives in [`content/demo-content.json`](content/demo-content.json) —
the model and the prose, nothing in the script itself. Entries wire to each
other by `ref`:

```jsonc
{ "ref": "page-home", "contentType": "landing_page",
  "fields": {
    "hero": { "$ref": "hero-home" },
    "sections": [{ "$ref": "card-preview" }, { "$ref": "card-blocks" }]
  } }
```

`{"$ref": …}` is replaced with the real entry id at creation time, so blocks
must be listed before the pages that reference them.

---

## Code Sync: editing this site from the CMS

Connect this repository under **Settings → Code Sync** in the editor. The CMS
then loads *this site* in its preview pane instead of rendering entries
generically, and authors edit the real page.

Three pieces make that work, and all three are already in place here.

### 1. `ondros/component-definition.json`

Tells the CMS which component renders which content type, and where each
content type lives on this site:

```jsonc
{
  "previewUrl": "http://localhost:3000",
  "routes": {
    "landing_page": "/?ondros-slug={slug}",
    "article": "/articles/{slug}"
  },
  "components": [ /* landing_page, article, hero, card */ ]
}
```

A manifest is **optional** — a repo without one is mapped by convention, with
every type routed at `/{contentType}/{slug}`. This site needs one because its
routes don't follow that convention: articles live at `/articles/{slug}`, and
landing pages render at `/`.

> `/?ondros-slug={slug}` looks odd but is deliberate. This site has a single
> landing-page route — the homepage — so rather than invent a `/landing_page/…`
> URL that production never serves, the preview names which entry to render in
> a query parameter. Visitors still get `/`.

Set `previewUrl` to wherever this site is deployed, or leave it and set the
deployment URL in the editor (which wins, and is what you want for branch
deploys).

### 2. The bridge script

`src/app/layout.tsx` loads it from the CMS:

```tsx
<Script src={`${CMS_BROWSER_URL}/code-sync/ondros-editor.js`} />
```

It no-ops unless the page is open inside the editor, so it ships to production
safely. Inside the editor it outlines components, posts the clicked field back
so the form focuses it, makes text editable on double-click, and applies the
editor's keystrokes straight to the DOM.

### 3. `data-ondros-*` attributes

`src/lib/preview.ts` exports two helpers so pages don't hand-write attribute
strings:

```tsx
<div {...resource(card.id, card.contentType.apiId)}>
  <h3 {...prop("title", "text", "Card title")}>{card.fields.title}</h3>
</div>
```

`resource()` marks which entry a subtree renders; `prop()` marks which field an
element renders. Nested blocks each get their own `resource()` wrapper — that is
what lets the editor preview a hero or a card on its own, and attribute an
inline edit to the block rather than to the page around it.

### Preview parameters

The editor appends these; `readPreview()` in `src/lib/preview.ts` reads them:

| Parameter | Effect |
|---|---|
| `ondros-preview=1` | fetch drafts with the preview token, uncached |
| `ondros-locale=<code>` | render the locale the editor has active |
| `ondros-focus=<uuid>` | the bridge scrolls to and outlines that block |
| `ondros-slug=<slug>` | which landing page `/` should render |

### Page-wise and component-wise preview

`article` and `landing_page` model a `slug` field, so their entries are pages
and preview at their own URL. `hero` and `card` model none — they are blocks
with no URL of their own, so the CMS previews one inside a page that references
it and the bridge reveals it. Nothing here needs to handle that case: it falls
out of the `resource()` wrappers.

---

## Notes

- **Slugs are a content-model field.** A type is addressable because its model
  contains a `slug` field, so `entry.slug` is `null` for blocks. This site only
  builds links from entries that have one.
- Locale comes from `?locale=`, and from `?ondros-locale=` while previewing.
- Data is cached for 30s normally and not at all in preview, so edits show up
  immediately.
