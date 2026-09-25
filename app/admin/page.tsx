import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listInterviews } from "@/lib/store";
import { inviteLink } from "@/lib/invite";
import { QUESTIONS } from "@/lib/config";
import { Brand } from "@/app/components/Brand";
import { StatusPill } from "@/app/components/StatusPill";
import { CopyButton } from "@/app/components/CopyButton";
import { InviteForm } from "./InviteForm";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function AdminPage() {
  await requireAdmin();
  const interviews = await listInterviews();
  const links = await Promise.all(interviews.map((i) => inviteLink(i.meta)));

  return (
    <main className="container">
      <div className="spread">
        <Brand href="/admin" />
        <form action={logout}>
          <button className="btn secondary small" type="submit">Sign out</button>
        </form>
      </div>

      <section className="card stack">
        <div className="eyebrow">New candidate</div>
        <h1>Send a <em>video interview</em></h1>
        <p className="muted">
          The candidate gets a private link to answer {QUESTIONS.length} questions on camera, in 15 minutes max.
          You get an email as soon as they finish.
        </p>
        <InviteForm />
      </section>

      <section className="card stack">
        <h2>Interviews</h2>
        {interviews.length === 0 ? (
          <p className="muted">No interviews yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Answers</th>
                  <th>Invited</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {interviews.map((i, idx) => (
                  <tr key={i.meta.id}>
                    <td>
                      <Link href={`/admin/i/${i.meta.id}`} style={{ fontWeight: 600, color: "inherit" }}>
                        {i.meta.name}
                      </Link>
                      <div className="muted small">{i.meta.email}</div>
                    </td>
                    <td>{i.meta.role ?? <span className="muted">-</span>}</td>
                    <td><StatusPill status={i.status} /></td>
                    <td>{i.answers.length} / {QUESTIONS.length}</td>
                    <td className="muted">{fmt(i.meta.createdAt)}</td>
                    <td style={{ textAlign: "right" }}>
                      {i.answers.length > 0 ? (
                        <Link className="btn small" href={`/admin/i/${i.meta.id}`}>Watch</Link>
                      ) : i.status === "invited" || i.status === "in_progress" ? (
                        <CopyButton text={links[idx]} />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
