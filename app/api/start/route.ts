import { NextResponse } from "next/server";
import { verifyInvite } from "@/lib/token";
import { getInterview, markStarted } from "@/lib/store";
import { TOTAL_LIMIT_SECONDS } from "@/lib/config";

export async function POST(request: Request) {
  const { token } = (await request.json().catch(() => ({}))) as { token?: string };
  const invite = verifyInvite(token);
  if (!invite.ok) return NextResponse.json({ error: `Link ${invite.reason}` }, { status: 403 });

  const interview = await getInterview(invite.id);
  if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  if (interview.status === "completed") {
    return NextResponse.json({ error: "Interview already completed" }, { status: 409 });
  }

  const started = await markStarted(invite.id, request.headers.get("user-agent") ?? undefined);
  const deadline = new Date(started.startedAt).getTime() + TOTAL_LIMIT_SECONDS * 1000;
  return NextResponse.json({
    startedAt: started.startedAt,
    deadline,
    answered: interview.answers.map((a) => a.question),
  });
}
