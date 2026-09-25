import type { Interview } from "@/lib/store";

const LABELS: Record<Interview["status"], string> = {
  invited: "Invited",
  in_progress: "In progress",
  incomplete: "Incomplete",
  completed: "Completed",
  expired: "Expired",
};

export function StatusPill({ status }: { status: Interview["status"] }) {
  return <span className={`pill ${status}`}>{LABELS[status]}</span>;
}
