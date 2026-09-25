import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 16) {
    throw new Error("APP_SECRET must be set to a random string of at least 16 characters");
  }
  return s;
}

export function hmac(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function newInterviewId(): string {
  return randomBytes(12).toString("base64url");
}

type InvitePayload = { id: string; exp: number };

/** Signed, self-contained invite token: `<payload>.<signature>`. */
export function signInvite(payload: InvitePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(`invite:${body}`)}`;
}

export type InviteCheck =
  | { ok: true; id: string; exp: number }
  | { ok: false; reason: "invalid" | "expired" };

export function verifyInvite(token: string | null | undefined): InviteCheck {
  if (!token) return { ok: false, reason: "invalid" };
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, hmac(`invite:${body}`))) {
    return { ok: false, reason: "invalid" };
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as InvitePayload;
    if (typeof payload.id !== "string" || typeof payload.exp !== "number") {
      return { ok: false, reason: "invalid" };
    }
    if (Date.now() > payload.exp) return { ok: false, reason: "expired" };
    return { ok: true, id: payload.id, exp: payload.exp };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
