"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { inviteCandidate, type InviteState } from "./actions";
import { CopyButton } from "@/app/components/CopyButton";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteCandidate, { status: "idle" });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "sent" || state.status === "created") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="stack">
      <div className="grid-3">
        <label>
          Name
          <input type="text" name="name" placeholder="Jane Doe" required />
        </label>
        <label>
          Email
          <input type="email" name="email" placeholder="jane@example.com" required />
        </label>
        <label>
          <span>
            Role <span className="muted">(optional)</span>
          </span>
          <input type="text" name="role" placeholder="Growth marketer" />
        </label>
      </div>
      <div className="spread">
        <label className="check">
          <input type="checkbox" name="sendEmail" defaultChecked />
          <span>Email the invite to the candidate</span>
        </label>
        <button className="btn" type="submit" disabled={pending}>
          <Send size={16} strokeWidth={2} />
          {pending ? "Creating..." : "Create interview"}
        </button>
      </div>

      {state.status === "error" && <div className="notice error">{state.error}</div>}
      {(state.status === "sent" || state.status === "created") && (
        <div className={`notice ${state.error ? "error" : "success"} stack`}>
          <span>
            {state.error ??
              (state.status === "sent"
                ? `Invite sent to ${state.name} (${state.email}).`
                : `Interview created for ${state.name}. Send them this link:`)}
          </span>
          <div className="row">
            <code className="small" style={{ wordBreak: "break-all", flex: 1 }}>{state.link}</code>
            <CopyButton text={state.link} />
          </div>
        </div>
      )}
    </form>
  );
}
