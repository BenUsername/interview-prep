import { redirect } from "next/navigation";
import { checkPassword, isAdmin, startAdminSession } from "@/lib/auth";
import { Brand } from "@/app/components/Brand";

async function login(formData: FormData) {
  "use server";
  if (!checkPassword(String(formData.get("password") ?? ""))) {
    redirect("/admin/login?error=1");
  }
  await startAdminSession();
  redirect("/admin");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAdmin()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <main className="container narrow">
      <Brand />
      <form action={login} className="card stack">
        <h1>Interview dashboard</h1>
        {error && <div className="notice error">Wrong password.</div>}
        <label>
          Password
          <input type="password" name="password" autoFocus required />
        </label>
        <button className="btn" type="submit">Sign in</button>
      </form>
    </main>
  );
}
