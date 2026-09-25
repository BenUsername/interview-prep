# Interview prep

One-way video interviews for screening candidates. You enter a candidate's name and email,
they get a private link, answer 3 questions on camera in English (15 minutes max), and you
get an email with a link to watch the recordings.

## How it works

1. **Invite.** Sign in at `/admin`, enter name, email and (optionally) role. The candidate gets an
   email with a private link, valid for 7 days. You can also copy the link and send it yourself.
2. **Interview.** The candidate agrees to be recorded, checks their camera and microphone, then
   presses Start. For each question they get 30 seconds to read and think, then up to 4 minutes to
   answer. Recording starts and stops on its own. Each question can be recorded once, and the whole
   interview is capped at 15 minutes from Start (the server enforces this too).
3. **Review.** When they finish you get an email ("Interview completed: Jane Doe") with a button to
   the review page, where you can watch each answer (at 1x to 2x speed), download it, or delete the
   interview. The candidate also gets a short "we received your interview" email.

If the candidate refreshes or loses their connection, they pick up at the next unanswered question
with the same timer. Interviews that run out of time without finishing show as **Incomplete**.

The questions and timings are in [`lib/config.ts`](lib/config.ts).

## Stack

- Next.js (App Router) on Vercel
- [Vercel Blob](https://vercel.com/docs/vercel-blob) (private store) for candidate details and
  recordings. No database: each interview is a folder of files.
- [Resend](https://resend.com) for email
- Browser `MediaRecorder` for recording; files upload straight from the browser to Blob storage.

## Setup

1. **Resend.** Create an API key and verify the domain you send from (e.g. `getaiso.com`).
2. **Deploy to Vercel.** Import this repo, then in the project go to *Storage*, create a
   **Blob** store with **private** access, and connect it. That adds `BLOB_READ_WRITE_TOKEN`.
3. **Environment variables** (see [`.env.example`](.env.example)):

   | Name | What it is |
   | --- | --- |
   | `RESEND_API_KEY` | Resend API key |
   | `EMAIL_FROM` | Sender, e.g. `Aiso Hiring <hiring@getaiso.com>` (verified domain) |
   | `ADMIN_EMAIL` | Who gets "interview completed" emails. Comma-separate for several. |
   | `ADMIN_PASSWORD` | Password for `/admin` |
   | `APP_SECRET` | Random string for signing links: `openssl rand -hex 32` |
   | `APP_URL` | Public URL used in emails, e.g. `https://interview.getaiso.com` |
   | `COMPANY_NAME` | Shown to candidates and used in question 3. Defaults to `Aiso`. |

4. Redeploy, open `/admin`, and send yourself a test invite.

### Local development

```bash
npm install
cp .env.example .env.local   # fill in the values; use the Blob token from Vercel
npm run dev
```

Camera access needs `https` or `localhost`.

## Notes

- Recordings are about 1 Mbps, so a 4 minute answer is around 30 MB.
- Changing `APP_SECRET` invalidates every link already sent and signs you out.
- Changing `ADMIN_PASSWORD` signs out every admin session.
