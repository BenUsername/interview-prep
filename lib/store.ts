import { BlobNotFoundError, del, get, head, list, put } from "@vercel/blob";
import { QUESTIONS, TOTAL_LIMIT_SECONDS, UPLOAD_GRACE_SECONDS } from "./config";

/*
 * Everything lives in a private Vercel Blob store, one folder per interview:
 *
 *   interviews/<id>/meta.json        candidate details, written when invited
 *   interviews/<id>/started.json     written once, when the candidate presses Start
 *   interviews/<id>/answer-<n>.<ext> one recording per question (n = 1..3), never overwritten
 *   interviews/<id>/completed.json   written once, when the candidate finishes
 *
 * Status is derived from which files exist, so there is no database to run.
 */

export type Meta = {
  id: string;
  name: string;
  email: string;
  role?: string;
  createdAt: string;
  expiresAt: string;
};

export type Started = { startedAt: string; userAgent?: string };
export type Completed = { completedAt: string; answered: number };

export type Answer = {
  question: number;
  pathname: string;
  size: number;
  uploadedAt: string;
};

export type Interview = {
  meta: Meta;
  started: Started | null;
  completed: Completed | null;
  answers: Answer[];
  status: "invited" | "in_progress" | "incomplete" | "completed" | "expired";
  deadline: number | null;
};

const ANSWER_RE = /^answer-(\d+)\.(webm|mp4)$/;

export const folder = (id: string) => `interviews/${id}/`;

export function answerPathname(id: string, question: number, ext: "webm" | "mp4") {
  return `${folder(id)}answer-${question}.${ext}`;
}

export function parseAnswerPathname(pathname: string): { id: string; question: number } | null {
  const m = /^interviews\/([A-Za-z0-9_-]+)\/(answer-\d+\.(?:webm|mp4))$/.exec(pathname);
  if (!m) return null;
  const question = Number(ANSWER_RE.exec(m[2])![1]);
  if (question < 1 || question > QUESTIONS.length) return null;
  return { id: m[1], question };
}

async function putJson(pathname: string, data: unknown) {
  await put(pathname, JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: false,
  });
}

async function readJson<T>(pathname: string): Promise<T | null> {
  const res = await get(pathname, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return null;
  return (await new Response(res.stream).json()) as T;
}

/** Writes a file only if it does not exist yet. Returns false if it already existed. */
async function putJsonOnce(pathname: string, data: unknown): Promise<boolean> {
  if (await exists(pathname)) return false;
  try {
    await putJson(pathname, data);
    return true;
  } catch (err) {
    // Lost a race with a concurrent request: the file is there, which is all we need.
    if (await exists(pathname)) return false;
    throw err;
  }
}

async function exists(pathname: string): Promise<boolean> {
  try {
    await head(pathname);
    return true;
  } catch (err) {
    if (err instanceof BlobNotFoundError) return false;
    throw err;
  }
}

async function listFolder(id: string) {
  const blobs = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: folder(id), cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

export async function createInterview(meta: Meta) {
  await putJson(`${folder(meta.id)}meta.json`, meta);
}

export async function markStarted(id: string, userAgent?: string): Promise<Started> {
  const started: Started = { startedAt: new Date().toISOString(), userAgent };
  const created = await putJsonOnce(`${folder(id)}started.json`, started);
  if (created) return started;
  return (await readJson<Started>(`${folder(id)}started.json`))!;
}

/** Returns true the first time only, so notifications are sent once. */
export async function markCompleted(id: string, answered: number): Promise<boolean> {
  return putJsonOnce(`${folder(id)}completed.json`, {
    completedAt: new Date().toISOString(),
    answered,
  } satisfies Completed);
}

export async function getInterview(id: string): Promise<Interview | null> {
  const blobs = await listFolder(id);
  const names = new Set(blobs.map((b) => b.pathname.slice(folder(id).length)));
  if (!names.has("meta.json")) return null;

  const [meta, started, completed] = await Promise.all([
    readJson<Meta>(`${folder(id)}meta.json`),
    names.has("started.json") ? readJson<Started>(`${folder(id)}started.json`) : null,
    names.has("completed.json") ? readJson<Completed>(`${folder(id)}completed.json`) : null,
  ]);
  if (!meta) return null;

  const answers: Answer[] = blobs
    .map((b) => {
      const parsed = parseAnswerPathname(b.pathname);
      return parsed && parsed.id === id
        ? {
            question: parsed.question,
            pathname: b.pathname,
            size: b.size,
            uploadedAt: new Date(b.uploadedAt).toISOString(),
          }
        : null;
    })
    .filter((a): a is Answer => a !== null)
    .sort((a, b) => a.question - b.question);

  const deadline = started
    ? new Date(started.startedAt).getTime() + TOTAL_LIMIT_SECONDS * 1000
    : null;

  let status: Interview["status"];
  if (completed || answers.length >= QUESTIONS.length) status = "completed";
  else if (deadline && Date.now() > deadline + UPLOAD_GRACE_SECONDS * 1000) status = "incomplete";
  else if (started) status = "in_progress";
  else if (Date.now() > new Date(meta.expiresAt).getTime()) status = "expired";
  else status = "invited";

  return { meta, started, completed, answers, status, deadline };
}

export async function listInterviews(limit = 200): Promise<Interview[]> {
  const page = await list({ prefix: "interviews/", mode: "folded" });
  const ids = page.folders
    .map((f) => f.slice("interviews/".length).replace(/\/$/, ""))
    .filter(Boolean);
  const all = await Promise.all(ids.map((id) => getInterview(id)));
  return all
    .filter((i): i is Interview => i !== null)
    .sort((a, b) => b.meta.createdAt.localeCompare(a.meta.createdAt))
    .slice(0, limit);
}

export async function deleteInterview(id: string) {
  const blobs = await listFolder(id);
  if (blobs.length) await del(blobs.map((b) => b.url));
}

export async function streamBlob(pathname: string, range?: string | null) {
  return get(pathname, {
    access: "private",
    headers: range ? { range } : undefined,
  });
}
