"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { endAdminSession, requireAdmin } from "@/lib/auth";
import { INVITE_VALID_DAYS } from "@/lib/config";
import { sendInvite } from "@/lib/email";
import { createInterview, deleteInterview, type Meta } from "@/lib/store";
import { newInterviewId, signInvite } from "@/lib/token";
import { appUrl } from "@/lib/url";

export type InviteState =
  | { status: "idle" }
  | { status: "sent" | "created"; link: string; name: string; email: string; error?: string }
  | { status: "error"; error: string };

export async function inviteCandidate(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "").trim() || undefined;
  const sendEmail = formData.get("sendEmail") === "on";

  if (!name) return { status: "error", error: "Enter the candidate's name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", error: "Enter a valid email address." };
  }

  const now = Date.now();
  const exp = now + INVITE_VALID_DAYS * 24 * 60 * 60 * 1000;
  const meta: Meta = {
    id: newInterviewId(),
    name,
    email,
    role,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(exp).toISOString(),
  };

  await createInterview(meta);
  const link = `${await appUrl()}/i/${signInvite({ id: meta.id, exp })}`;
  revalidatePath("/admin");

  if (!sendEmail) return { status: "created", link, name, email };
  try {
    await sendInvite(meta, link);
    return { status: "sent", link, name, email };
  } catch (err) {
    return {
      status: "created",
      link,
      name,
      email,
      error: `The interview was created but the email failed: ${err instanceof Error ? err.message : err}`,
    };
  }
}

export async function removeInterview(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (/^[A-Za-z0-9_-]+$/.test(id)) await deleteInterview(id);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function logout() {
  await endAdminSession();
  redirect("/admin/login");
}
