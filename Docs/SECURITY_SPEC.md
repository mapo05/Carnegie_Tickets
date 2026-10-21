# Carnegie Tickets: Security Specification

Status: Draft 0.1 (specification only, no code)
Uses EARS wording, the same as `requirements.md`. Tags like **[A-11]** refer to the assumptions register there. Each item is a security rule the finished system must meet.

## 1. What could go wrong (threat map)

| # | What could go wrong | Rules that stop it |
|---|---|---|
| T1 | A non-student gets in (fake or borrowed ID photo) | SEC-01, 05, 06, 08, 09, 34 |
| T2 | One person buys many tickets (scalping, bots, workarounds) | SEC-09, 13, 34 |
| T3 | Someone reaches the admin area without the password | SEC-17 to 23, 39 |
| T4 | Someone guesses the admin password | SEC-18, 19 |
| T5 | Card details leak | SEC-10, 11, 16, 32 |
| T6 | Fake payment success (forged messages, edited prices) | SEC-12, 13, 14, 16 |
| T7 | Student IDs, names, emails, or ID photos leak | SEC-02 to 04, 25 to 30 |
| T8 | Forged or guessed tickets | SEC-31 |
| T9 | Hacking through form fields or web attacks | SEC-23, 33, 35, 37 |
| T10 | Secrets or test data exposed | SEC-15, 37, 40 |
| T11 | Nobody can tell who did what | SEC-24, 38 |
| T12 | Data kept too long | SEC-03, 27 |

## 2. Student-only access

- **SEC-01** (Ubiquitous) Carnegie Tickets shall check on the server, for every student page and data request, that the visitor has a valid verified-student session, and shall deny by default anything not explicitly allowed. *(supports REQ-01)*
- **SEC-02** (Event-driven) When an ID photo is uploaded, Carnegie Tickets shall accept only JPEG or PNG files up to 10 MB, check the real file contents (not just the file name), and reject everything else.
- **SEC-03** (Ubiquitous) Carnegie Tickets shall keep ID photos in private, encrypted storage that cannot be reached from the internet, shall remove location and camera metadata, and shall delete every photo within 1 hour of the decision, or within 24 hours for unfinished attempts. *(supports REQ-48)*
- **SEC-04** (Ubiquitous) Carnegie Tickets shall never put ID photos, full student ID numbers, names, or email addresses in web addresses, log files, or error messages.
- **SEC-05** (Unwanted) If more than 5 failed verification attempts come from the same device or network address, or for the same student ID number, within 1 hour, then Carnegie Tickets shall block further attempts for 1 hour and say so in plain English. *(Note: REQ-04 allows 3 tries per verification. A person could start again, so this overall cap applies.)*
- **SEC-06** (Ubiquitous) Carnegie Tickets shall make email confirmation links random (at least 128 bits), single-use, tied to one student and one email address, and valid for 30 minutes.
- **SEC-07** (Ubiquitous) Carnegie Tickets shall give verified students a random session token (at least 128 bits) in a cookie marked Secure, HttpOnly, and SameSite=Lax, tied to one student ID, that ends after 30 minutes idle or 2 hours total. [A-12]
- **SEC-08** (Optional) Where admins have loaded a student roster, Carnegie Tickets shall also require the typed name and ID number to match a roster entry before verification can pass. [A-04]
- **SEC-09** (Ubiquitous) Carnegie Tickets shall enforce "one paid or in-progress purchase per student ID per event" in the database itself, after normalizing the ID number (trim spaces, ignore letter case), so the limit cannot be beaten by another email, another name spelling, two browser tabs, or repeated clicks. *(supports REQ-12, REQ-13)*

## 3. Payments

- **SEC-10** (Ubiquitous) Carnegie Tickets shall have no card number, expiry, or security code fields on its own pages, and shall never place card data in requests, databases, logs, emails, analytics, or backups. *(supports REQ-16, REQ-17)*
- **SEC-11** (Ubiquitous) Carnegie Tickets shall store only these payment fields: Stripe reference IDs, amount, currency, and status.
- **SEC-12** (Event-driven) When a message arrives claiming to be from Stripe, Carnegie Tickets shall verify its signature with the Stripe signing secret and reject it if the signature is invalid or the message is older than 5 minutes.
- **SEC-13** (Ubiquitous) Carnegie Tickets shall work out price, total, and quantity limits on the server from the event record and shall ignore any price or total sent from the browser.
- **SEC-14** (Event-driven) When Stripe reports a payment, Carnegie Tickets shall check that the amount paid equals the expected total and shall process each Stripe event ID only once. If the amount is wrong, then Carnegie Tickets shall not create tickets and shall flag the order for admins. *(supports REQ-50)*
- **SEC-15** (Ubiquitous) Carnegie Tickets shall keep all secret keys (Stripe keys, signing secret, email keys, admin password hash) outside the code and outside the browser, keep test and live keys separate, and support key replacement.
- **SEC-16** (Event-driven) When a student returns from Stripe to Carnegie Tickets, Carnegie Tickets shall show a result only after asking Stripe's server, and shall ignore anything in the web address that claims success. *(supports REQ-19)*

## 4. Admin backend (the part that must need a password)

- **SEC-17** (Ubiquitous) Carnegie Tickets shall check for a valid admin session on the server for every admin page and every admin data request, and shall deny by default. *(supports REQ-35)*
- **SEC-18** (Ubiquitous) Carnegie Tickets shall store the admin password only as a salted, slow hash (Argon2id or bcrypt), shall require at least 16 characters, and shall compare passwords in constant time. [A-12]
- **SEC-19** (Unwanted) If there are 5 wrong admin passwords within 15 minutes, then Carnegie Tickets shall lock admin sign-in for 15 minutes and log every failure. *(supports REQ-36)*
- **SEC-20** (Ubiquitous) Carnegie Tickets shall give admins a random session token in a cookie marked Secure, HttpOnly, and SameSite=Strict, ending after 15 minutes idle or 8 hours total. *(supports REQ-37)*
- **SEC-21** (Event-driven) When the admin password is changed, Carnegie Tickets shall end every open admin session at once. The organizers shall change the password whenever someone who knew it leaves the team or it may have been exposed.
- **SEC-22** (Ubiquitous) Carnegie Tickets shall serve the admin area at a separate address that is not linked from any student page. Where the organizers can supply a trusted network (for example the campus network), Carnegie Tickets shall accept admin sign-in only from it (Optional).
- **SEC-23** (Ubiquitous) Carnegie Tickets shall reject any admin action that changes data unless it carries a valid anti-forgery token.
- **SEC-24** (Ubiquitous) Carnegie Tickets shall write an audit log of every admin sign-in (pass or fail), event change, manual verification, lookup, and resend, with time and the admin's typed name. Admins shall not be able to edit or delete the log. The log shall hold internal reference numbers instead of student personal data and be kept 90 days. [A-11, A-16]

## 5. Data protection

- **SEC-25** (Ubiquitous) Carnegie Tickets shall use HTTPS only (redirecting plain HTTP), TLS 1.2 or newer, and shall encrypt the database, file storage, and backups.
- **SEC-26** (Ubiquitous) Carnegie Tickets shall collect only: name, student ID number, email address, ID photo (temporary), ticket quantity, and Stripe reference data.
- **SEC-27** (Event-driven) When the retention period (14 days after the event ends) passes, Carnegie Tickets shall permanently delete the data, record the deletion in a log with no personal data, and let backups expire within 30 days. [A-16] *(supports REQ-47)*
- **SEC-28** (Ubiquitous) Carnegie Tickets shall show only the last 4 characters of a student ID in admin lists, with the full number only on a single order's detail page.
- **SEC-29** (Unwanted) If an error occurs, then Carnegie Tickets shall show only a plain-English message and shall never show stack traces, database messages, file paths, or software versions.
- **SEC-30** (Ubiquitous) Carnegie Tickets shall never put student ID numbers or payment details in emails, and shall send email from a domain protected with SPF, DKIM, and DMARC so messages are hard to fake.
- **SEC-31** (Ubiquitous) Carnegie Tickets shall generate ticket numbers randomly (at least 10 characters, unambiguous letters and digits), unique per event, never in a sequence. [A-15]
- **SEC-32** (Ubiquitous) Carnegie Tickets shall share student data with no one except Stripe and the email service, and shall include no advertising or tracking code on student pages.

## 6. Input and web protection

- **SEC-33** (Ubiquitous) Carnegie Tickets shall check every input on the server (type, length, allowed characters, ID-number pattern, email format, quantity as a whole number 1 to 4), use safe database queries, and safely encode everything it displays, so injected code or commands do nothing. [A-25]
- **SEC-34** (Ubiquitous) Carnegie Tickets shall limit how fast one device or network address can call verification, checkout, and waitlist actions, and shall use a bot check on the verification form (Optional, recommended).
- **SEC-35** (Ubiquitous) Carnegie Tickets shall send security headers on every page (content security policy, HSTS, no framing, no content-type guessing).
- **SEC-36** (Ubiquitous) Carnegie Tickets shall make waitlist offer links random (at least 128 bits), tied to one student and one event, and dead after purchase or after 24 hours.
- **SEC-37** (Event-driven) When a release is prepared, Carnegie Tickets shall be scanned for known-vulnerable libraries and for secrets in code, and shall not ship with any unresolved high or critical finding.

## 7. Monitoring, failure, and response

- **SEC-38** (Ubiquitous) Carnegie Tickets shall log security events (failed sign-ins, blocked attempts, signature failures, deletions) without personal data or secrets, and shall restrict log access to admins. *(supports T11)*
- **SEC-39** (Unwanted) If Stripe, the email service, or the photo check is unavailable, then Carnegie Tickets shall refuse the action with a plain-English message and shall not skip the check, issue tickets, or verify anyone.
- **SEC-40** (Ubiquitous) Carnegie Tickets shall use Stripe test mode and fake students in every test environment, and never real student data or live keys.
- **SEC-41** (Unwanted) If a leak of student data or of the admin password is suspected, then the organizers shall change the admin password immediately, review the audit log, and tell the school within 24 hours. [A-22]

## 8. Residual risks (what this spec cannot fully fix)

1. **A photo of an ID is a weak proof.** A borrowed, shared, or edited image can pass. The one-purchase rule (SEC-09), email confirmation (SEC-06), and rate limits reduce harm, but school single sign-on or a roster (SEC-08) is much stronger. Recommended.
2. **One shared admin password** means you cannot tell admins apart or remove one person without changing it for everyone. The typed name is not proof. Individual accounts plus a second sign-in step are recommended for a later version.
3. **Deleting records at 14 days** can leave you unable to answer a card dispute that arrives later. Stripe keeps its own record.
4. **Backups (30 days) outlive the 14-day rule.** Confirm you accept this.
5. **No refunds, plus system faults.** The exception in REQ-51 needs an admin to act quickly.
6. **Privacy law** (for example FERPA) is not analyzed here. Ask the school.
