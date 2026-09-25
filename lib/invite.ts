import type { Meta } from "./store";
import { signInvite } from "./token";
import { appUrl } from "./url";

/** Invite tokens are deterministic, so the link can be rebuilt at any time from the stored meta. */
export async function inviteLink(meta: Meta): Promise<string> {
  return `${await appUrl()}/i/${signInvite({ id: meta.id, exp: new Date(meta.expiresAt).getTime() })}`;
}
