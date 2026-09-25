"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Camera, Clock, Lightbulb, MessageSquare, Mic, RotateCcw, Square, Video } from "lucide-react";
import type { Question } from "@/lib/config";

type Settings = {
  prepSeconds: number;
  maxAnswerSeconds: number;
  minAnswerSeconds: number;
  totalLimitSeconds: number;
  uploadGraceSeconds: number;
};

type Props = {
  token: string;
  interviewId: string;
  firstName: string;
  companyName: string;
  questions: Question[];
  answered: number[];
  deadline: number | null;
  settings: Settings;
};

type Phase = "intro" | "setup" | "prep" | "recording" | "uploading" | "finishing" | "done";

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4;codecs=avc1,mp4a",
  "video/mp4",
];

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function InterviewFlow({
  token,
  interviewId,
  firstName,
  companyName,
  questions,
  answered: initialAnswered,
  deadline: initialDeadline,
  settings,
}: Props) {
  const { prepSeconds, maxAnswerSeconds, minAnswerSeconds, totalLimitSeconds, uploadGraceSeconds } = settings;

  const [phase, setPhase] = useState<Phase>("intro");
  const [current, setCurrent] = useState(0);
  const [answered, setAnswered] = useState<Set<number>>(() => new Set(initialAnswered));
  const [deadline, setDeadline] = useState<number | null>(initialDeadline);
  const [now, setNow] = useState(() => Date.now());
  const [phaseStart, setPhaseStart] = useState(0);
  const [recordLimit, setRecordLimit] = useState(maxAnswerSeconds);
  const [uploadPct, setUploadPct] = useState(0);
  const [level, setLevel] = useState(0);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pendingRef = useRef<{ blob: Blob; question: number } | null>(null);
  const answeredRef = useRef(new Set(initialAnswered));
  const deadlineRef = useRef(initialDeadline);
  const audioRef = useRef<{ ctx: AudioContext; raf: number } | null>(null);

  const resuming = initialDeadline !== null || initialAnswered.length > 0;
  const firstUnanswered = () => questions.findIndex((_, i) => !answeredRef.current.has(i + 1));
  const secondsLeft = () =>
    deadlineRef.current ? (deadlineRef.current - Date.now()) / 1000 : totalLimitSeconds;

  const attachPreview = useCallback((el: HTMLVideoElement | null) => {
    if (el && streamRef.current && el.srcObject !== streamRef.current) el.srcObject = streamRef.current;
  }, []);

  const stopMeter = useCallback(() => {
    if (audioRef.current) {
      cancelAnimationFrame(audioRef.current.raf);
      void audioRef.current.ctx.close();
      audioRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    stopMeter();
  }, [stopMeter]);

  useEffect(() => stopStream, [stopStream]);

  // Tick the clocks while the candidate is on a question.
  useEffect(() => {
    if (phase !== "prep" && phase !== "recording") return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [phase]);

  // Warn before leaving mid-interview.
  useEffect(() => {
    if (!["prep", "recording", "uploading", "finishing"].includes(phase)) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  function startMeter(stream: MediaStream) {
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
        if (audioRef.current) audioRef.current.raf = requestAnimationFrame(loop);
      };
      audioRef.current = { ctx, raf: requestAnimationFrame(loop) };
    } catch {
      // The level meter is a nicety; recording still works without it.
    }
  }

  async function enableCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser cannot record video. Please use an up-to-date Chrome, Edge, Firefox or Safari.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      startMeter(stream);
      setPhase("setup");
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setError(
        name === "NotAllowedError"
          ? "Camera or microphone access was blocked. Allow access in your browser's address bar, then try again."
          : name === "NotFoundError"
            ? "No camera or microphone was found. Please connect one and try again."
            : "We could not start your camera. Close other apps that may be using it and try again."
      );
    }
  }

  function goToQuestion(index: number) {
    setCurrent(index);
    setPhase("prep");
    setPhaseStart(Date.now());
    setNow(Date.now());
  }

  /** Starts the timer on first call; afterwards just returns the current server state. */
  async function fetchState(): Promise<{ deadline: number; answered: number[]; error?: string } | null> {
    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      return res.ok ? data : { deadline: 0, answered: [], error: data.error ?? "Something went wrong." };
    } catch {
      return null;
    }
  }

  async function begin() {
    setError(null);
    const data = await fetchState();
    if (!data || data.error) {
      setError(data?.error ?? "Could not reach the server. Check your internet connection and try again.");
      return;
    }
    stopMeter();
    deadlineRef.current = data.deadline;
    setDeadline(data.deadline);
    data.answered.forEach((q) => answeredRef.current.add(q));
    setAnswered(new Set(answeredRef.current));
    const next = firstUnanswered();
    if (next === -1 || secondsLeft() <= 5) await finish();
    else goToQuestion(next);
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || recorderRef.current?.state === "recording") return;
    const limit = Math.floor(Math.min(maxAnswerSeconds, secondsLeft()));
    if (limit < 3) {
      void finish();
      return;
    }
    const question = current + 1;
    const mimeType = pickMime();
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 1_000_000,
      audioBitsPerSecond: 96_000,
    });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const type = (recorder.mimeType || mimeType || "video/webm").split(";")[0];
      pendingRef.current = { blob: new Blob(chunksRef.current, { type }), question };
      void uploadAnswer();
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    setRecordLimit(limit);
    setPhase("recording");
    setPhaseStart(Date.now());
    setNow(Date.now());
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      setUploadPct(0);
      setPhase("uploading");
      recorder.stop();
    }
  }

  async function uploadAnswer() {
    const pending = pendingRef.current;
    if (!pending) return;
    setError(null);
    setPhase("uploading");
    setUploadPct(0);
    const ext = pending.blob.type === "video/mp4" ? "mp4" : "webm";
    try {
      await upload(`interviews/${interviewId}/answer-${pending.question}.${ext}`, pending.blob, {
        access: "private",
        handleUploadUrl: "/api/upload",
        clientPayload: token,
        contentType: pending.blob.type,
        multipart: pending.blob.size > 8 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setUploadPct(percentage),
      });
    } catch {
      // The upload may have landed even though we got an error (e.g. the connection dropped
      // on the response), or the time limit may have passed. Ask the server before retrying.
      const state = await fetchState();
      if (state?.answered.includes(pending.question)) {
        advance(pending.question);
      } else if (secondsLeft() < -uploadGraceSeconds) {
        void finish();
      } else {
        setError("Your answer could not be saved. Check your internet connection and try again.");
      }
      return;
    }
    advance(pending.question);
  }

  function advance(question: number) {
    pendingRef.current = null;
    answeredRef.current.add(question);
    setAnswered(new Set(answeredRef.current));
    const next = firstUnanswered();
    if (next === -1 || secondsLeft() <= 5) void finish();
    else goToQuestion(next);
  }

  async function finish() {
    setPhase("finishing");
    recorderRef.current = null;
    stopStream();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch("/api/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (res.ok) break;
      } catch {
        // retry below
      }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    setPhase("done");
  }

  const prepLeft = prepSeconds - (now - phaseStart) / 1000;
  const elapsed = (now - phaseStart) / 1000;
  const totalLeft = deadline ? (deadline - now) / 1000 : totalLimitSeconds;

  // Automatic transitions driven by the clocks.
  useEffect(() => {
    if (phase === "prep" && totalLeft <= 5) void finish();
    else if (phase === "prep" && prepLeft <= 0) startRecording();
    else if (phase === "recording" && elapsed >= recordLimit) stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, now]);

  const question = questions[current];
  const answerLeft = recordLimit - elapsed;

  if (phase === "intro") {
    return (
      <Shell companyName={companyName}>
        <div className="card stack">
          <div className="eyebrow">Video interview</div>
          <h1>
            Hi {firstName}, welcome to your <em>{companyName}</em> interview
          </h1>
          <p className="muted">
            This is a short recorded interview in English. Nobody is watching live, so take a breath and be
            yourself.
          </p>
          <ul className="list">
            <Item icon={<MessageSquare size={18} />}>
              {questions.length} questions, answered on camera in English.
            </Item>
            <Item icon={<Clock size={18} />}>
              {prepSeconds} seconds to read each question, then up to {Math.round(maxAnswerSeconds / 60)} minutes to
              answer. Recording starts automatically.
            </Item>
            <Item icon={<Video size={18} />}>
              {Math.round(totalLimitSeconds / 60)} minutes maximum in total. Each question can be recorded once.
            </Item>
            <Item icon={<Lightbulb size={18} />}>Find a quiet place with good light, and face the camera.</Item>
          </ul>
          {resuming && (
            <div className="notice info">
              Welcome back. You have answered {answered.size} of {questions.length} questions
              {deadline ? `, and ${clock(totalLeft)} is left on your timer` : ""}.
            </div>
          )}
          <label className="check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              I agree to be recorded, and for {companyName} to use the recordings only to assess my application.
            </span>
          </label>
          {error && <div className="notice error">{error}</div>}
          <div>
            <button className="btn" disabled={!consent} onClick={enableCamera}>
              <Camera size={16} strokeWidth={2} /> Check my camera and microphone
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  if (phase === "setup") {
    return (
      <Shell companyName={companyName}>
        <div className="card stack">
          <div className="eyebrow">Device check</div>
          <h2>Can we see and hear you?</h2>
          <video ref={attachPreview} className="video mirror" autoPlay muted playsInline />
          <div className="stack" style={{ gap: 8 }}>
            <div className="row small muted">
              <Mic size={16} /> Say a few words. The bar should move when you speak.
            </div>
            <div className="meter">
              <div style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
          </div>
          {error && <div className="notice error">{error}</div>}
          <div className="spread">
            <span className="muted small">
              {resuming
                ? "Your timer is already running."
                : `The ${Math.round(totalLimitSeconds / 60)} minute timer starts when you press Start.`}
            </span>
            <button className="btn" onClick={begin}>
              {resuming ? "Continue interview" : "Start interview"}
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  if (phase === "finishing" || phase === "done") {
    return (
      <Shell companyName={companyName}>
        <div className="card stack">
          {phase === "finishing" ? (
            <>
              <h1>Saving your interview...</h1>
              <p className="muted">Please keep this page open for a moment.</p>
            </>
          ) : (
            <>
              <div className="eyebrow">All done</div>
              <h1>
                Thank you, <em>{firstName}</em>
              </h1>
              <p className="muted">
                Your interview has been sent to the {companyName} team. We will get back to you soon. You can close
                this page now.
              </p>
            </>
          )}
        </div>
      </Shell>
    );
  }

  // prep, recording, uploading
  return (
    <Shell companyName={companyName}>
      <div className="card stack">
        <div className="steps">
          {questions.map((_, i) => (
            <span key={i} className={answered.has(i + 1) ? "done" : i === current ? "current" : ""} />
          ))}
        </div>
        <div className="spread small">
          <span className="eyebrow">
            Question {current + 1} of {questions.length}
          </span>
          <span className="muted" style={{ color: totalLeft < 60 ? "var(--danger-fg)" : undefined }}>
            {clock(totalLeft)} left in total
          </span>
        </div>
        <p className="question">{question.title}</p>
        <p className="muted">{question.hint}</p>

        <div style={{ position: "relative" }}>
          <video ref={attachPreview} className="video mirror" autoPlay muted playsInline />
          <div
            className="row"
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              background: "rgba(15,11,30,.7)",
              color: "#fff",
              padding: "6px 12px",
              borderRadius: 9999,
              fontSize: 14,
              fontWeight: 600,
              gap: 8,
            }}
          >
            {phase === "prep" && <>Recording starts in {clock(prepLeft)}</>}
            {phase === "recording" && (
              <>
                <span className="rec-dot" /> REC {clock(elapsed)} / {clock(recordLimit)}
              </>
            )}
            {phase === "uploading" && <>Saving answer</>}
          </div>
        </div>

        {phase === "prep" && (
          <div className="spread">
            <span className="muted small">Take a moment to think about your answer.</span>
            <button className="btn" onClick={startRecording}>
              <Video size={16} strokeWidth={2} /> Start recording now
            </button>
          </div>
        )}

        {phase === "recording" && (
          <div className="spread">
            <span className="small" style={{ color: answerLeft < 30 ? "var(--danger-fg)" : "var(--ink-55)" }}>
              {answerLeft < 30
                ? `${clock(answerLeft)} left for this answer. Time to wrap up.`
                : elapsed < minAnswerSeconds
                  ? `You can finish after ${minAnswerSeconds} seconds.`
                  : "Press Finish when you are done."}
            </span>
            <button className="btn" onClick={stopRecording} disabled={elapsed < minAnswerSeconds}>
              <Square size={14} strokeWidth={2} fill="currentColor" /> Finish answer
            </button>
          </div>
        )}

        {phase === "uploading" && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="small muted">Saving your answer... {Math.round(uploadPct)}%</div>
            <div className="meter">
              <div style={{ width: `${uploadPct}%` }} />
            </div>
            {error && (
              <>
                <div className="notice error">{error}</div>
                <div className="row">
                  <button className="btn" onClick={uploadAnswer}>
                    <RotateCcw size={16} strokeWidth={2} /> Try again
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ companyName, children }: { companyName: string; children: React.ReactNode }) {
  return (
    <main className="container narrow">
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/feather-black.png" alt="" />
        <span>{companyName}</span>
      </div>
      {children}
    </main>
  );
}

function Item({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li>
      <span className="icon-chip">{icon}</span>
      <span style={{ paddingTop: 6 }}>{children}</span>
    </li>
  );
}
