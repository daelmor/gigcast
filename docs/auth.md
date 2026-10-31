# Authentication

## Why, and what stays public

gigcast now lives at a public address. Starting a brief runs Claude Opus for five to eleven minutes with a dozen tool calls, and until now nothing limited who could do that beyond "one brief at a time". Sign-in gives three things: a limit per account, a record of who asked for each brief, and a switch to restrict creation to a list of people or domains if the budget needs protecting during judging.

Only **creating** a brief is gated. Everything a judge or a promoter reads stays open without an account: the landing page, every finished brief (the public read-only link), the sponsor drafts, the Markdown and JSON representations, the market dashboards and the about page.

## Decision

- **Now: Google sign-in** (OpenID Connect, authorization code with PKCE, through the `arctic` library). It needs one OAuth client and no infrastructure of our own: no passwords, no email delivery, no DNS work. Most judges and promoters have a Google account.
- **Phase 2, if wanted: email magic links.** Useful for people without Google. It needs an email provider (Resend or SES), sender-domain DNS in Route 53 (SPF, DKIM, DMARC) and a table of single-use tokens. The data model below already leaves room for it (`users` is keyed by email; `google_sub` is nullable).
- **Not chosen:** passwords (nothing to gain, plenty to get wrong) and a hosted provider such as Auth0 or Clerk (another vendor and a monthly bill for a hackathon app).

## How it works

| Piece | Where | Notes |
|---|---|---|
| Mode switch | `AUTH_MODE` = `off` (default) or `required` | `off` leaves the product exactly as before; the account controls are hidden. |
| Start sign-in | `GET /auth/google?next=/new` | Stores `state`, the PKCE verifier and the return path in ten-minute httpOnly cookies, then redirects to Google. |
| Finish sign-in | `GET /auth/google/callback` | Checks `state`, exchanges the code, reads `sub`, `email`, `email_verified`, `name`, `picture` from the ID token, applies the allow list, upserts the account, opens a session, redirects to the stored path. Failures land on `/new?auth=failed`, `denied` or `unconfigured` with a message. |
| Sign out | `POST /auth/signout` | Form post from the header; deletes the session row and the cookie. |
| Sessions | `sessions` table, cookie `gigcast_session` | Random 32-byte token in an httpOnly, Secure, SameSite=Lax cookie; the table stores its SHA-256. 30 days, extended when used in the second half. Resolved once per request in `hooks.server.ts` into `locals.user`. |
| Accounts | `users` table | `id`, `email` (unique, lower-case), `name`, `picture`, `google_sub` (unique, nullable), timestamps. |
| Ownership | `briefs.user_id` | Set when a signed-in person starts a brief; null for older briefs and for `AUTH_MODE=off`. Not shown in the UI yet. |
| Gate | `POST /api/briefs` | `401 Sign in to create a brief.` without a session; `429` when the account started `BRIEFS_PER_USER_PER_DAY` briefs (default 10) in the last 24 hours. The form shows a "Sign in with Google" card instead of the Generate button. |
| Allow list | `AUTH_ALLOWED_EMAILS` | Comma-separated emails or `@domains`. Unset allows every verified Google account. |

Security notes: `state` plus PKCE against code injection, cookies never readable by scripts, hashed session ids so a database leak yields no usable cookies, `email_verified` required, the return path must be a same-site path, and the sign-out form is covered by SvelteKit's origin check. No secret from Google is stored beyond the ID-token claims listed above.

## Setup (David)

1. In the Google Cloud console (any project, `n1-data` is fine): **APIs & Services → OAuth consent screen**, External, app name "gigcast", support email, authorized domain `gigcast.ai`. Scopes: `openid`, `email`, `profile`. Publish the app (or add test users while it is in testing).
2. **Credentials → Create credentials → OAuth client ID → Web application.** Authorized redirect URIs: `https://gigcast.ai/auth/google/callback` and `http://localhost:5173/auth/google/callback`.
3. Put `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `AUTH_MODE=required` in the local env file (the deploy script reads them from the environment; the secret becomes the Container Apps secret `google-client-secret`). Optionally `AUTH_ALLOWED_EMAILS` and `BRIEFS_PER_USER_PER_DAY`.
4. Run the deploy script. Check: `/new` shows the sign-in card, "Sign in" completes and returns to `/new`, the header shows the account, a brief starts, `Sign out` works, and the eleventh brief in 24 hours is refused with a clear message.

Until step 3 the deployed app keeps `AUTH_MODE=off`, so nothing changes for visitors.

## Phase 2: email magic links (not built)

Resend (free tier is enough) or SES. DNS in the `gigcast.ai` zone: the provider's DKIM CNAMEs, an SPF `TXT`, and a `_dmarc` `TXT`. Code: a `login_tokens` table (hashed token, email, 15-minute expiry, single use), `POST /auth/email` that sends the link and always answers "check your inbox", `GET /auth/email/callback?token=` that consumes it and opens a session through the same `users` and `sessions` tables, and a per-email and per-IP rate limit on sending. About half a day of work plus the provider sign-up.

## Open points

- Whether to restrict sign-in to an allow list during judging, or leave it open and rely on the daily limit (the default).
- Whether briefs should show who created them. The column exists; nothing displays it.
- End-to-end tests run with `AUTH_MODE=off`. A test for the gate itself would need a fake identity provider; the policy functions are unit-tested instead.
