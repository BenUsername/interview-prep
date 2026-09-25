import { NextResponse } from "next/server";
import { verifyInvite } from "@/lib/token";
import { getInterview, markCompleted } from "@/lib/store";
import { sendCompletedToAdmin, sendThanksToCandidate } from "@/lib/email";
import { appUrl } from "@/lib/url";

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
    const results = await Promise.allSettled([
      sendCompletedToAdmin(interview, reviewUrl),
      sendThanksToCandidate(interview.meta),
    ]);
    for (const r of results) if (r.status === "rejected") console.error(r.reason);
  }

  return NextResponse.json({ ok: true });
}
