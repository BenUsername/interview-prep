import { verifyInvite } from "@/lib/token";
import { getInterview } from "@/lib/store";
import {
  COMPANY_NAME,
  MAX_ANSWER_SECONDS,
  MIN_ANSWER_SECONDS,
  PREP_SECONDS,
  QUESTIONS,
  TOTAL_LIMIT_SECONDS,
  UPLOAD_GRACE_SECONDS,
} from "@/lib/config";
import { Brand } from "@/app/components/Brand";
import { InterviewFlow } from "./InterviewFlow";

export const dynamic = "force-dynamic";

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="container narrow">
      <Brand />
      <div className="card stack">
        <h1>{title}</h1>
        <p className="muted">{body}</p>
      </div>
    </main>
  );
}

export default async function InterviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = verifyInvite(decodeURIComponent(token));

  if (!invite.ok) {
    return invite.reason === "expired" ? (
      <Message title="This link has expired" body={`Please reply to the invitation email and the ${COMPANY_NAME} team will send you a new one.`} />
    ) : (
      <Message title="This link is not valid" body="Please check that you copied the whole link from the invitation email." />
    );
  }

  const interview = await getInterview(invite.id);
  if (!interview) {
    return <Message title="Interview not found" body={`This interview may have been cancelled. Please contact the ${COMPANY_NAME} team.`} />;
  }
  if (interview.status === "completed") {
    return <Message title="You're all done" body={`Thanks ${interview.meta.name.split(" ")[0]}, we have received your interview. The ${COMPANY_NAME} team will be in touch soon.`} />;
  }
  if (interview.deadline && Date.now() > interview.deadline) {
    return <Message title="Time is up" body={`The ${Math.round(TOTAL_LIMIT_SECONDS / 60)} minute limit for this interview has passed. Any answers you recorded were saved. Please contact the ${COMPANY_NAME} team if something went wrong.`} />;
  }

  return (
    <InterviewFlow
      token={decodeURIComponent(token)}
      interviewId={invite.id}
      firstName={interview.meta.name.split(" ")[0]}
      companyName={COMPANY_NAME}
      questions={QUESTIONS}
      answered={interview.answers.map((a) => a.question)}
      deadline={interview.deadline}
      settings={{
        prepSeconds: PREP_SECONDS,
        maxAnswerSeconds: MAX_ANSWER_SECONDS,
        minAnswerSeconds: MIN_ANSWER_SECONDS,
        totalLimitSeconds: TOTAL_LIMIT_SECONDS,
        uploadGraceSeconds: UPLOAD_GRACE_SECONDS,
      }}
    />
  );
}
