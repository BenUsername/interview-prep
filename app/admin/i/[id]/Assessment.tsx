import { Sparkles } from "lucide-react";
import type { Interview } from "@/lib/store";
import { analysisEnabled } from "@/lib/analysis";
import { SubmitButton } from "@/app/components/SubmitButton";
import { rerunAnalysis } from "../../actions";

const SUBSCORES = [
  ["fluency", "Fluency"],
  ["grammar", "Grammar"],
  ["vocabulary", "Vocabulary"],
  ["coherence", "Coherence"],
] as const;

function Rerun({ id, label }: { id: string; label: string }) {
  return (
    <form action={rerunAnalysis}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="btn secondary small" pendingLabel="Analysing, this takes about a minute...">
        {label}
      </SubmitButton>
    </form>
  );
}

export function AssessmentCard({ interview }: { interview: Interview }) {
  const { analysis, answers, meta, status } = interview;

  if (!analysisEnabled()) {
    return (
      <section className="card stack">
        <div className="eyebrow">English assessment</div>
        <p className="muted small">
          Add <code>DEEPGRAM_API_KEY</code> and <code>ANTHROPIC_API_KEY</code> to get transcripts and an automatic
          English score for every interview.
        </p>
      </section>
    );
  }
  if (answers.length === 0) return null;

  if (!analysis) {
    return (
      <section className="card stack">
        <div className="eyebrow">English assessment</div>
        <p className="muted">
          {status === "completed"
            ? "Transcribing and scoring the answers. Refresh in a minute."
            : "The assessment runs when the candidate finishes."}
        </p>
        <div>
          <Rerun id={meta.id} label="Run it now" />
        </div>
      </section>
    );
  }

  if (analysis.status === "failed") {
    return (
      <section className="card stack">
        <div className="eyebrow">English assessment</div>
        <div className="notice error">The assessment failed: {analysis.error}</div>
        <div>
          <Rerun id={meta.id} label="Try again" />
        </div>
      </section>
    );
  }

  const a = analysis.assessment;
  return (
    <section className="card stack">
      <div className="eyebrow">English assessment</div>
      <div className="assessment">
        <div className="cefr">
          <span className="cefr-level">{a.cefr}</span>
          <span className="muted small">{a.overall_score} / 100</span>
        </div>
        <div className="stack" style={{ gap: 10, flex: 1, minWidth: 220 }}>
          {SUBSCORES.map(([key, label]) => (
            <div key={key} className="subscore">
              <span className="small">{label}</span>
              <div className="meter">
                <div style={{ width: `${(a[key] / 5) * 100}%` }} />
              </div>
              <span className="small muted">{a[key]}/5</span>
            </div>
          ))}
        </div>
      </div>
      <p>{a.summary}</p>
      <div className="grid-2">
        {a.strengths.length > 0 && (
          <div>
            <div className="label">Strengths</div>
            <ul className="bullets">{a.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}
        {a.concerns.length > 0 && (
          <div>
            <div className="label">Concerns</div>
            <ul className="bullets">{a.concerns.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}
      </div>
      <div className="spread">
        <span className="row muted small" style={{ gap: 6 }}>
          <Sparkles size={14} strokeWidth={2} /> Automatic, from speech-to-text transcripts. A starting point, not a
          decision.
        </span>
        <Rerun id={meta.id} label="Re-run" />
      </div>
    </section>
  );
}
