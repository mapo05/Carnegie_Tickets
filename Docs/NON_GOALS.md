# Carnegie Tickets: Non-Goals (Version 1)

These are things the app will **not** do in this version. Listing them keeps the scope small and stops surprises later.

## Payments
- No refunds, cancellations, transfers, or resale. (Only exception: fixing system faults, see A-13.)
- No handling of canceled events inside the app. Organizers handle those in Stripe. (A-14)
- No discount codes, promotions, group pricing, or multiple currencies.
- No saved cards, and no card details handled by us at all.
- No payment plans, gift cards, or non-Stripe payment methods.

## Students and identity
- No student accounts, passwords, or profiles. Students verify each visit. (A-02)
- No school single sign-on in v1 (recommended for later).
- No fraud detection beyond the ID photo check, email link, rate limits, and one-purchase rule.
- No support for people under 18 or non-students such as guests and parents. (A-26)

## Tickets
- No QR codes, door scanning, or check-in tools. Ticket numbers only. (A-15)
- No seat maps, seat choice, or ticket tiers.
- No student "my tickets" page. Admins resend emails instead.
- No text-message delivery of tickets.

## Waitlist
- No "leave the waitlist" button and no showing the student's place in line. (A-10)
- No automatic purchase for waitlisted students. They get an offer and must pay.

## Admin
- No individual admin accounts, roles, or second sign-in step. One shared password. (A-11) This is a known weakness.
- No event deletion, reports, exports, or analytics dashboards.
- No admin ability to view or store card details.

## Platform
- No native mobile app. Web only.
- No languages other than English.
- No formal accessibility audit. Recommended before launch, not specified here.
- No advertising, tracking, or analytics on student pages.
- No integration with school systems (rosters, calendars, records), unless a roster is supplied (A-04).

## Process
- No code in this stage. These documents are specifications only.
- No legal review of privacy law. Ask the school. (A-22)
