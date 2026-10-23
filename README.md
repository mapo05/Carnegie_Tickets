# Carnegie Tickets

## Security spec audit

Assessment of the current preview build against each requirement in [Docs/SECURITY_SPEC.md](./Docs/SECURITY_SPEC.md):

| Requirement | Status | Why |
|---|---|---|
| SEC-01 | Partly | The confirmation endpoint checks a server-side flow and token, but there is no verified-student session cookie or server gate on every page/data request. |
| SEC-02 | Partly | The endpoint checks JPEG/PNG MIME type and a 10 MB limit, but does not validate actual image contents and instead treats photo text as a demo match. |
| SEC-03 | Partly | The server strips image metadata, encrypts uploads in a private temporary directory, deletes them after processing, and sweeps files older than 23 hours 45 minutes every 15 minutes to meet the 24-hour limit; production still needs a configured 32-byte `STUDENT_PHOTO_ENCRYPTION_KEY` and deployment-level assurance that temporary storage is not backed up and cleanup runs reliably. |
| SEC-04 | Fully | The current app does not place submitted personal data in URLs, logs, or error messages; its API errors are generic. |
| SEC-05 | Partly | Attempts are limited to three per flow, but restarting creates a new flow and there is no one-hour device, network, or student-ID limit. |
| SEC-06 | Partly | Confirmation tokens are 256-bit, single-use, and expire after 30 minutes, but the email/link is simulated and no email is sent. |
| SEC-07 | Not at all | Verification state is held in an in-memory flow; no student session cookie or required idle/absolute expiry is provided. |
| SEC-08 | Not at all | There is no roster-loading or roster-matching feature. |
| SEC-09 | Not at all | There is no purchase flow, database, or per-student/per-event purchase constraint. |
| SEC-10 | Fully | The current pages and API have no card fields and handle no card data. |
| SEC-11 | Not at all | No payment processing or payment-data storage is implemented. |
| SEC-12 | Not at all | There is no Stripe webhook or signature/timestamp verification. |
| SEC-13 | Not at all | There is no checkout, server-side pricing, or quantity-limit implementation. |
| SEC-14 | Not at all | The app does not process Stripe payments or payment event IDs. |
| SEC-15 | Partly | No payment or email secrets are currently used, but key separation, replacement, and secret management are not implemented. |
| SEC-16 | Not at all | There is no Stripe return flow or server-side payment-status check. |
| SEC-17 | Not at all | There are no admin pages, admin sessions, or protected admin data requests. |
| SEC-18 | Not at all | Admin passwords, password hashing, and password rules are not implemented. |
| SEC-19 | Not at all | There is no admin sign-in lockout or failure logging. |
| SEC-20 | Not at all | There are no admin session cookies or admin session expiry controls. |
| SEC-21 | Not at all | Admin password changes and session revocation are not implemented. |
| SEC-22 | Not at all | There is no separate admin address or trusted-network restriction. |
| SEC-23 | Not at all | There are no admin data-changing actions or anti-forgery tokens. |
| SEC-24 | Not at all | There is no admin audit log. |
| SEC-25 | Not at all | The app does not configure HTTPS redirection, TLS, or encryption for databases, files, and backups. |
| SEC-26 | Fully | The current verification form collects only name, student ID, email, and a temporary photo, all of which are allowed by this requirement. |
| SEC-27 | Not at all | There is no event-based retention/deletion process, deletion log, or backup-expiry policy. |
| SEC-28 | Not at all | There are no admin lists or order-detail pages showing student IDs. |
| SEC-29 | Fully | API errors and client request failures are presented as plain-English messages without stack traces or internal details. |
| SEC-30 | Not at all | The app does not send email or configure SPF, DKIM, or DMARC. |
| SEC-31 | Not at all | The app does not issue tickets or generate ticket numbers. |
| SEC-32 | Fully | The current app has no advertising/tracking code or external student-data sharing in its implementation. |
| SEC-33 | Partly | The verification endpoint validates several field formats and React escapes displayed text, but actual image validation and the specified database, quantity, and complete input protections are absent. |
| SEC-34 | Partly | There is a three-attempt per-flow limit, but no device/network request throttling or bot check. |
| SEC-35 | Not at all | The app does not configure the required CSP, HSTS, framing, and content-type security headers. |
| SEC-36 | Not at all | There is no waitlist or waitlist offer-link implementation. |
| SEC-37 | Not at all | No dependency-vulnerability or secret-scan release process is configured. |
| SEC-38 | Not at all | Security events are not logged, and there is no admin-restricted log access. |
| SEC-39 | Not at all | The photo check is a local demo text-marker check rather than a real service, so service unavailability and fail-closed behavior are not implemented. |
| SEC-40 | Partly | The preview uses synthetic demo data and no live keys, but there is no Stripe integration or test-mode configuration. |
| SEC-41 | Not at all | No incident-response procedure, admin audit log review, or school notification process is implemented. |

Set `STUDENT_PHOTO_ENCRYPTION_KEY` to a fresh 32-byte hex value before running the app; generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep the key outside source control and do not back up the temporary photo directory.

## HW3 Story 7 preview

The ticket reservation flow is a demonstration only. Attendees type a name instead of signing in, payments are simulated, and the confirmation page does not send email. Events, reservations, and purchases are held in server memory; they are not saved in a database and reset whenever the server restarts or the app is redeployed. Do not use this preview to sell real tickets.
