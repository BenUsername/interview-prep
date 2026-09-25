import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Mail } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getInterview } from "@/lib/store";
import { inviteLink } from "@/lib/invite";
import { QUESTIONS } from "@/lib/config";
import { Brand } from "@/app/components/Brand";
import { StatusPill } from "@/app/components/StatusPill";
import { CopyButton } from "@/app/components/CopyButton";
import { removeInterview } from "../../actions";
import { ReviewVideo } from "./ReviewVideo";

export const dynamic = "force-dynamic";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]+$/.test(id)) notFound();
  const interview = await getInterview(id);
  if (!interview) notFound();
  const { meta, started, completed, answers, status } = interview;
  const link = await inviteLink(meta);

  return (
    <main className="container">
      <Brand href="/admin" />
      <Link href="/admin" className="row small" style={{ marginBottom: 16, textDecoration: "none" }}>
        <ArrowLeft size={16} strokeWidth={2} /> All interviews
      </Link>

      <section className="card stack">
        <div className="spread">
          <div className="stack" style={{ gap: 4 }}>
            <h1>{meta.name}</h1>
            <div className="muted">
              {meta.email}
              {meta.role ? ` · ${meta.role}` : ""}
            </div>
          </div>
          <StatusPill status={status} />
        </div>
        <div className="muted small">
          Invited {fmt(meta.createdAt)}
          {started && ` · Started ${fmt(started.startedAt)}`}
          {completed && ` · Finished ${fmt(completed.completedAt)}`}
          {!started && ` · Link expires ${fmt(meta.expiresAt)}`}
        </div>
        <div className="row">
          <a className="btn secondary small" href={`mailto:${meta.email}`}>
            <Mail size={14} strokeWidth={2} /> Email candidate
          </a>
          {status !== "completed" && <CopyButton text={link} label="Copy interview link" />}
        </div>
      </section>

      {QUESTIONS.map((q, i) => {
        const answer = answers.find((a) => a.question === i + 1);
        const src = answer ? `/api/admin/video?path=${encodeURIComponent(answer.pathname)}` : null;
        return (
          <section key={i} className="card stack">
            <div className="eyebrow">Question {i + 1}</div>
            <h2>{q.title}</h2>
            {src ? (
              <>
                <ReviewVideo src={src} />
                <div className="spread small muted">
                  <span>
                    Uploaded {fmt(answer!.uploadedAt)} · {(answer!.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <a className="row" href={`${src}&download=1`} style={{ gap: 6 }}>
                    <Download size={14} strokeWidth={2} /> Download
                  </a>
                </div>
              </>
            ) : (
              <p className="muted">Not answered yet.</p>
            )}
          </section>
        );
      })}

      <section className="card spread">
        <div>
          <h2>Delete interview</h2>
          <p className="muted small">Removes the candidate details and all recordings permanently.</p>
        </div>
        <form action={removeInterview}>
          <input type="hidden" name="id" value={meta.id} />
          <button className="btn danger" type="submit">Delete</button>
        </form>
      </section>
    </main>
  );
}
