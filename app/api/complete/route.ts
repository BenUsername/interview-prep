import { after, NextResponse } from "next/server";
import { verifyInvite } from "@/lib/token";
import { getInterview, markCompleted } from "@/lib/store";
import { analyzeInterview } from "@/lib/analysis";
import { sendCompletedToAdmin, sendThanksToCandidate } from "@/lib/email";
import { appUrl } from "@/lib/url";

// Transcription and grading run after the response, and can take a minute or two.
export const maxDuration = 300;

export async function POST(request: Request) {
  const { token } = (await request.json().catch(() => ({}))) as { token?: string };
  const invite = verifyInvite(token);
  if (!invite.ok) return NextResponse.json({ error: `Link ${invite.reason}` }, { status: 403 });

  const interview = await getInterview(invite.id);
  if (!interview?.started) {
    return NextResponse.json({ error: "Interview has not been started" }, { status: 400 });
  }

  const firstTime = await markCompleted(invite.id, interview.answers.length);
  if (firstTime) {
    const reviewUrl = `${await appUrl()}/admin/i/${invite.id}`;
    after(async () => {
      const results = await Promise.allSettled([
        sendThanksToCandidate(interview.meta),
        analyzeInterview(interview).then((analysis) => sendCompletedToAdmin(interview, reviewUrl, analysis)),
      ]);
      for (const r of results) if (r.status === "rejected") console.error(r.reason);
    });
  }

  return NextResponse.json({ ok: true });
}
