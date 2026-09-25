import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { verifyInvite } from "@/lib/token";
import { getInterview, parseAnswerPathname } from "@/lib/store";
import { UPLOAD_GRACE_SECONDS } from "@/lib/config";

/**
 * Issues short-lived client upload tokens so the candidate's browser can send the
 * recording straight to Blob storage (Vercel functions cap request bodies at 4.5 MB).
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const invite = verifyInvite(clientPayload);
        if (!invite.ok) throw new Error(`Link ${invite.reason}`);

        const target = parseAnswerPathname(pathname);
        if (!target || target.id !== invite.id) throw new Error("Invalid upload path");

        const interview = await getInterview(invite.id);
        if (!interview?.deadline) throw new Error("Interview has not been started");
        if (interview.completed) throw new Error("Interview already completed");
        if (Date.now() > interview.deadline + UPLOAD_GRACE_SECONDS * 1000) {
          throw new Error("Time limit reached");
        }
        if (interview.answers.some((a) => a.question === target.question)) {
          throw new Error("This question was already answered");
        }

        return {
          allowedContentTypes: ["video/webm", "video/mp4"],
          maximumSizeInBytes: 300 * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 15 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 }
    );
  }
}
