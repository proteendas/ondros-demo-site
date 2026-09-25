/**
 * Verifies the signed ticket that authorizes a draft preview.
 *
 * Rendering drafts is a privilege, so the thing that unlocks it has to be
 * unforgeable. A plain `?ondros-preview=1` is not: anyone sent the URL — or
 * who finds it in a referrer log, a chat message or browser history — reads
 * every unpublished entry in the space.
 *
 * So the editor passes `?ondros-preview=<payload>.<signature>`, minted by the
 * CMS for an authenticated user and signed with this site's preview secret.
 * We check the signature and the expiry here, server-side. The secret never
 * reaches the browser and is never compared in the client bundle.
 *
 * Anything that fails — missing, malformed, expired, wrong signature, or the
 * literal `1` an older editor sent — means "not a preview", and the page
 * renders its published content like any other visitor's.
 *
 * Copy this file into your own project; it is the whole contract. See
 * docs/20-code-sync.md in the CMS repo.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Tolerance for clock skew between the CMS and this site. */
const LEEWAY_SECONDS = 60;

export type TicketPayload = {
  iat: number;
  exp: number;
  env?: string;
  sub?: string;
};

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function verifyPreviewTicket(
  ticket: string | undefined,
  secret: string | undefined,
  options: { environment?: string; now?: number } = {}
): TicketPayload | null {
  if (!secret || !ticket) return null;

  const dot = ticket.indexOf(".");
  if (dot <= 0) return null;
  const body = ticket.slice(0, dot);
  const signature = ticket.slice(dot + 1);

  let payload: TicketPayload;
  try {
    const expected = createHmac("sha256", secret).update(body, "ascii").digest();
    const given = fromBase64Url(signature);
    // Lengths must match before timingSafeEqual, which throws otherwise.
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return null;
    }
    payload = JSON.parse(fromBase64Url(body).toString("utf8"));
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") return null;
  if (typeof payload.exp !== "number") return null;

  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (now > payload.exp + LEEWAY_SECONDS) return null;

  // A ticket minted for staging must not unlock master's drafts.
  if (options.environment && payload.env && payload.env !== options.environment) {
    return null;
  }

  return payload;
}
