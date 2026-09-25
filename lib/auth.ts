import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hmac, safeEqual } from "./token";

const COOKIE = "admin_session";

function sessionValue(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD is not set");
  return hmac(`admin:${password}`);
}

export function checkPassword(input: string): boolean {
  const password = process.env.ADMIN_PASSWORD;
  return !!password && safeEqual(input, password);
}

export async function startAdminSession() {
  (await cookies()).set(COOKIE, sessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const value = (await cookies()).get(COOKIE)?.value;
  return !!value && safeEqual(value, sessionValue());
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
