export const COMPANY_NAME = process.env.COMPANY_NAME || "Aiso";

export type Question = {
  title: string;
  hint: string;
};

export const QUESTIONS: Question[] = [
  {
    title: "Tell us about your background.",
    hint: "Your education, where you have worked, and what you are best at.",
  },
  {
    title: "Tell us about an interesting project you built that is relevant to us.",
    hint: "What was the problem, what did you do yourself, and what was the result?",
  },
  {
    title: `Why did you decide to apply to join ${COMPANY_NAME}?`,
    hint: "What attracted you to the company and to this role?",
  },
];

/** Thinking time shown before each recording starts. */
export const PREP_SECONDS = 30;
/** Longest allowed answer per question. */
export const MAX_ANSWER_SECONDS = 240;
/** Answers shorter than this cannot be submitted (prevents accidental clicks). */
export const MIN_ANSWER_SECONDS = 10;
/** Hard cap for the whole interview, counted from the moment the candidate presses Start. */
export const TOTAL_LIMIT_SECONDS = 15 * 60;
/** Extra time the server allows past the cap so the last upload can finish. */
export const UPLOAD_GRACE_SECONDS = 5 * 60;
/** How long an invite link stays valid. */
export const INVITE_VALID_DAYS = 7;
