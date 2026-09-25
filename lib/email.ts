import { Resend } from "resend";
import { COMPANY_NAME, QUESTIONS, TOTAL_LIMIT_SECONDS } from "./config";
import type { Interview, Meta } from "./store";

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

function from() {
  return process.env.EMAIL_FROM || `${COMPANY_NAME} Hiring <onboarding@resend.dev>`;
}

function adminRecipients(): string[] {
  return (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(body: string) {
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f0b1e;max-width:560px">${body}</div>`;
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${href}" style="background:#6d5ae8;color:#fff;text-decoration:none;padding:12px 20px;border-radius:14px;font-weight:600;display:inline-block">${label}</a></p>`;
}

async function send(args: { to: string[]; subject: string; html: string; text: string; replyTo?: string }) {
  const { error } = await client().emails.send({ from: from(), ...args });
  if (error) throw new Error(`Resend: ${error.message}`);
}

export async function sendInvite(meta: Meta, link: string) {
  const minutes = Math.round(TOTAL_LIMIT_SECONDS / 60);
  const expires = new Date(meta.expiresAt).toUTCString().replace(/ \d\d:\d\d:\d\d GMT$/, "");
  const firstName = meta.name.split(" ")[0];
  const role = meta.role ? ` for the ${meta.role} role` : "";
  const replyTo = adminRecipients()[0];

  await send({
    to: [meta.email],
    replyTo,
    subject: `Your ${COMPANY_NAME} video interview`,
    text: [
      `Hi ${firstName},`,
      "",
      `Thanks for applying to ${COMPANY_NAME}${role}. The next step is a short recorded video interview in English.`,
      "",
      `You will answer ${QUESTIONS.length} questions on camera. It takes at most ${minutes} minutes and you can do it whenever suits you before ${expires}.`,
      "",
      `Start here: ${link}`,
      "",
      "You will need a laptop or phone with a camera and microphone, and a quiet place. You get a moment to read each question before recording starts.",
      "",
      "Good luck!",
      `The ${COMPANY_NAME} team`,
    ].join("\n"),
    html: layout(`
      <p>Hi ${esc(firstName)},</p>
      <p>Thanks for applying to ${esc(COMPANY_NAME)}${esc(role)}. The next step is a short recorded video interview in English.</p>
      <p>You will answer ${QUESTIONS.length} questions on camera. It takes at most <strong>${minutes} minutes</strong> and you can do it whenever suits you before <strong>${esc(expires)}</strong>.</p>
      ${button(link, "Start my interview")}
      <p>You will need a laptop or phone with a camera and microphone, and a quiet place. You get a moment to read each question before recording starts.</p>
      <p>Good luck!<br/>The ${esc(COMPANY_NAME)} team</p>
      <p style="color:rgba(15,11,30,.45);font-size:13px">If the button does not work, copy this link: ${esc(link)}</p>
    `),
  });
}

export async function sendCompletedToAdmin(interview: Interview, reviewUrl: string) {
  const to = adminRecipients();
  if (!to.length) return;
  const { meta, answers } = interview;
  const role = meta.role ? ` (${meta.role})` : "";
  const answered = `${answers.length} of ${QUESTIONS.length}`;

  const rows = QUESTIONS.map((q, i) => {
    const a = answers.find((x) => x.question === i + 1);
    return `${i + 1}. ${q.title} ${a ? `(${(a.size / 1024 / 1024).toFixed(1)} MB)` : "(not answered)"}`;
  });

  await send({
    to,
    replyTo: meta.email,
    subject: `Interview completed: ${meta.name}${role}`,
    text: [
      `${meta.name} <${meta.email}> finished their video interview${role}.`,
      `Answered: ${answered}`,
      "",
      ...rows,
      "",
      `Watch the recordings: ${reviewUrl}`,
    ].join("\n"),
    html: layout(`
      <p><strong>${esc(meta.name)}</strong> &lt;${esc(meta.email)}&gt; finished their video interview${esc(role)}.</p>
      <p>Answered: ${answered}</p>
      <ol>${QUESTIONS.map((q, i) => {
        const a = answers.find((x) => x.question === i + 1);
        return `<li>${esc(q.title)} <span style="color:rgba(15,11,30,.55)">${a ? "" : "(not answered)"}</span></li>`;
      }).join("")}</ol>
      ${button(reviewUrl, "Watch the recordings")}
      <p style="color:rgba(15,11,30,.45);font-size:13px">Reply to this email to contact the candidate directly.</p>
    `),
  });
}

export async function sendThanksToCandidate(meta: Meta) {
  const firstName = meta.name.split(" ")[0];
  await send({
    to: [meta.email],
    replyTo: adminRecipients()[0],
    subject: `We received your ${COMPANY_NAME} interview`,
    text: `Hi ${firstName},\n\nThanks for completing your video interview. We have received your answers and will get back to you soon.\n\nThe ${COMPANY_NAME} team`,
    html: layout(
      `<p>Hi ${esc(firstName)},</p><p>Thanks for completing your video interview. We have received your answers and will get back to you soon.</p><p>The ${esc(COMPANY_NAME)} team</p>`
    ),
  });
}
