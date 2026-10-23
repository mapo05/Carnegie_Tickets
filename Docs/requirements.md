# Carnegie Tickets: Requirements

Status: Draft 0.1 (specification only, no code)

## 1. What this is

Carnegie Tickets lets verified students buy event tickets with Stripe. A student may buy 1 to 4 tickets, once per event. If an event is sold out, the student joins a waitlist. Ticket numbers are emailed. Card details are never stored. The admin area is password protected.

## 2. How to read this document

- Criteria use **EARS**. Patterns: *Ubiquitous* ("The system shall..."), *Event-driven* ("When..."), *State-driven* ("While..."), *Unwanted behavior* ("If..., then..."), *Optional* ("Where...").
- "Carnegie Tickets" is the system. "Student" means a person who has passed verification. Every requirement has an ID (REQ-nn). Security requirements are in `SECURITY_SPEC.md` (SEC-nn). Tests are in `TEST_SPEC.md`.
- Tags like **[A-08]** point to the assumptions in section 4.

## 3. Fixed settings (named so they are easy to change)

| Setting | Value |
|---|---|
| Tickets per purchase | 1 to 4 |
| Purchases per student per event | 1 |
| Checkout hold | 10 minutes |
| Waitlist offer window | 24 hours |
| Email confirmation link life | 30 minutes |
| ID photo tries per verification | 3 |
| Ticket email deadline | 5 minutes after payment |
| Student session idle limit | 30 minutes |
| Admin session idle limit | 15 minutes |
| Record retention | 14 days after the event ends |

## 4. Assumptions register (please review every line)

| ID | Assumption | Why it matters |
|---|---|---|
| A-01 | The whole app is behind verification. Nobody sees event details before passing it. | You said only students may "access this." |
| A-02 | Verification = ID photo check + email link. There are no student accounts or passwords, so students re-verify each visit. | Keeps scope small. Adds a little friction. |
| A-03 | The ID photo check is automatic: the system reads the name and ID number from the photo and compares them to what was typed. **I have not seen the sample ID.** | Field layout on your ID decides how well this works. |
| A-04 | No official student roster exists. If you have one, SEC-08 adds a stronger check. | A photo alone is weak (see Security spec, residual risks). |
| A-05 | ID photos are deleted right after the pass/fail decision, not kept 2 weeks. | Less sensitive data held. |
| A-06 | "Once per event" means one **paid** purchase. Failed or expired payments do not count. Buying 2 tickets uses up the student's one purchase. | Your answer 1(a). |
| A-07 | Tickets are held 10 minutes during checkout. | Prevents lost sales and double selling. |
| A-08 | If a student wants more tickets than are left, they may take fewer. | Not specified by you. |
| A-09 | A waitlist entry includes how many tickets (1 to 4) the student wants. Offers go first-come, first-served to the first entry whose quantity fits. Skipped entries keep their place. | Your brief did not say. |
| A-10 | Waitlist students must be verified too. There is no "leave the waitlist" button in v1. | Prevents fake sign-ups. |
| A-11 | Admins share one password (your answer). Each admin also types a name at sign-in for the record. That name is **not verified**. | Shared passwords give weak accountability. |
| A-12 | Admin password must be 16+ characters. Admin sessions last at most 8 hours. Student sessions last at most 2 hours. | Not specified by you. |
| A-13 | "No refunds" applies to student requests. The one exception: a system fault (charged twice, or charged but no tickets). An admin fixes that through the Stripe dashboard. | Otherwise a student could pay and receive nothing. |
| A-14 | If organizers cancel an event, refunds are handled outside the app. | Conflicts with the no-refund policy, so it is out of scope. |
| A-15 | Ticket numbers are random 10-character codes, emailed and also shown on screen. No QR codes or door scanning. | You asked for ticket numbers only. |
| A-16 | "2 weeks after the event has happened" means 14 days after the event's end time. It applies to orders, tickets, waitlist entries, and verified-student records. Backups expire within 30 days. Audit logs hold no personal data and are kept 90 days. | Backups are longer than 14 days. **Conflict to decide.** |
| A-17 | Stripe Checkout (Stripe's hosted page) takes payment in one currency (USD), one price per event. Stripe keeps its own records under its own rules. Chargebacks can arrive after we delete our records. | Deleted records limit our ability to answer disputes. |
| A-18 | Any email address is accepted (not only school addresses). | Requiring a school address is stronger. Your decision. |
| A-19 | "Plain English" means about 8th-grade reading level, no jargon or error codes, English only. | Makes your rule testable. |
| A-20 | Organizers supply one help email address, shown on every student page. | Students need someone to contact. |
| A-21 | "Test until it works" means the test suite in `TEST_SPEC.md` uses Stripe test mode and fake students. It can only run once code exists. | I was told not to write code. |
| A-22 | Student records may fall under privacy law (in the US, FERPA). This is not legal advice. Ask the school. | Could change retention and sharing rules. |
| A-23 | Peak load is up to 500 students at once when tickets go on sale. | Sales spikes drive design and load tests. |
| A-24 | Event times show in one time zone chosen by admins. | Avoids confusion. |
| A-25 | Student ID numbers follow a pattern the organizers give us (length, characters). | Needed to reject junk input. |
| A-26 | All students are adults who can pay for themselves. Under-18 rules are not covered. | Not specified. |

## 5. User stories and acceptance criteria

### US-1: Prove I am a student
*As a student, I want to prove I go here, so that I can buy tickets, and so that outsiders cannot.*

- **REQ-01** (Ubiquitous) Carnegie Tickets shall not show event details, ticket counts, or the waitlist to anyone who has not been verified as a student. [A-01]
- **REQ-02** (Event-driven) When a person starts verification, Carnegie Tickets shall ask for their full name, student ID number, email address, and a photo of their student ID. [A-25]
- **REQ-03** (Event-driven) When the person submits the form, Carnegie Tickets shall check that the name and student ID number they typed match those on the ID photo. [A-03]
- **REQ-04** (Unwanted) If the photo cannot be read or does not match, then Carnegie Tickets shall say in plain English what went wrong, allow up to 3 tries in one verification, and after the third failure tell the person how to contact the organizers.
- **REQ-05** (Event-driven) When the photo check passes, Carnegie Tickets shall email a confirmation link to the address given, and shall treat the person as verified only after they open the link within 30 minutes. [A-02, A-18]

### US-2: See what is on sale
*As a student, I want to see events and how many tickets are left, so that I know what I can buy.*

- **REQ-06** (State-driven) While a student is verified, Carnegie Tickets shall list upcoming events with name, date, time, place, price per ticket, and tickets left. [A-24]
- **REQ-07** (State-driven) While an event has no tickets left, Carnegie Tickets shall show "Sold out" and a "Join the waitlist" button instead of a buy button.
- **REQ-08** (State-driven) While an event's sales window is not open (before it opens or after it closes), Carnegie Tickets shall show when tickets go on sale or that sales have ended, and shall not allow a purchase.

### US-3: Choose my tickets
*As a student, I want to pick how many tickets I need, so that I can go with friends.*

- **REQ-09** (Event-driven) When a student picks an open event, Carnegie Tickets shall let them choose 1, 2, 3, or 4 tickets.
- **REQ-10** (Unwanted) If the student asks for fewer than 1 or more than 4 tickets, then Carnegie Tickets shall refuse and explain the limit of 4 tickets per purchase.
- **REQ-11** (Unwanted) If the student asks for more tickets than are left, then Carnegie Tickets shall tell them how many are left and let them choose that number or fewer. [A-08]
- **REQ-12** (Unwanted) If the student already has a paid purchase for the event, then Carnegie Tickets shall refuse a new purchase and explain that each student may buy only once per event, even if they bought fewer than 4. [A-06]
- **REQ-13** (State-driven) While a student has an unpaid checkout in progress for an event, Carnegie Tickets shall not let them start a second checkout for that event.
- **REQ-14** (Event-driven) When the student confirms their choice, Carnegie Tickets shall hold those tickets for 10 minutes, show the total price and the no-cancellation, no-refund policy, and send the student to payment. [A-07]
- **REQ-15** (Unwanted) If payment is not completed within 10 minutes, or the student leaves payment, then Carnegie Tickets shall release the held tickets and tell the student in plain English that the hold ended.

### US-4: Pay safely
*As a student, I want to pay by card without my card details being kept, so that I feel safe.*

- **REQ-16** (Event-driven) When the student goes to pay, Carnegie Tickets shall take payment only on Stripe's own hosted payment page. [A-17]
- **REQ-17** (Ubiquitous) Carnegie Tickets shall never ask for, receive, show, or keep a card number, expiry date, or security code.
- **REQ-18** (Unwanted) If a payment is declined or fails, then Carnegie Tickets shall show a plain-English message, shall not count it as a purchase, and shall let the student try again while the hold lasts.
- **REQ-19** (Event-driven) When Stripe's server confirms a payment, Carnegie Tickets shall mark the order paid, create the tickets, and show a confirmation. The student's browser returning from Stripe shall not by itself count as confirmation.

### US-5: Get my tickets
*As a student, I want my ticket numbers emailed, so that I can find them later.*

- **REQ-20** (Event-driven) When an order is paid, Carnegie Tickets shall create one unique ticket number for each ticket bought. [A-15]
- **REQ-21** (Event-driven) When the tickets are created, Carnegie Tickets shall email the ticket numbers, event name, date, place, and total paid to the confirmed email within 5 minutes, and show the numbers on the confirmation screen.
- **REQ-22** (Unwanted) If an email cannot be sent, then Carnegie Tickets shall retry, and shall show the failure to admins so they can resend.
- **REQ-23** (Ubiquitous) Carnegie Tickets shall state the no-cancellation, no-refund policy in every confirmation email. [A-13]
- **REQ-24** (Ubiquitous) Carnegie Tickets shall never sell more tickets than an event's capacity, counting paid tickets, held tickets, and tickets reserved for waitlist offers.

### US-6: Join the waitlist
*As a student, I want to join a waitlist when an event is sold out, so that I can get a ticket if one frees up.*

- **REQ-25** (Event-driven) When a verified student chooses "Join the waitlist" for a sold-out event, Carnegie Tickets shall confirm their name, student ID, and email, ask how many tickets (1 to 4) they want, and add them to the waitlist. [A-09, A-10]
- **REQ-26** (Unwanted) If the student is already on that event's waitlist or already has a paid purchase for it, then Carnegie Tickets shall refuse and say why.
- **REQ-27** (Event-driven) When a student joins the waitlist, Carnegie Tickets shall confirm it on screen and by email, and say that they will be emailed if a ticket becomes available.
- **REQ-28** (Ubiquitous) Carnegie Tickets shall offer freed tickets in the order students joined the waitlist. [A-09]
- **REQ-29** (Event-driven) When tickets become available (an unpaid hold ends or an admin raises capacity), Carnegie Tickets shall email the first waitlisted student whose wanted quantity fits an offer to buy, reserve those tickets for that student for 24 hours, and tell them the deadline.
- **REQ-30** (Unwanted) If an offer is not used within 24 hours, then Carnegie Tickets shall cancel the offer, return the tickets to sale, and make the offer to the next waitlisted student.
- **REQ-31** (Ubiquitous) Carnegie Tickets shall apply the same rules (1 to 4 tickets, one purchase per event, Stripe payment) to purchases that come from a waitlist offer.

### US-7: Understand everything the app says
*As a student, I want every question and message in common English, so that I never feel lost.*

- **REQ-32** (Ubiquitous) Carnegie Tickets shall write every question, instruction, error, and email shown to students in plain English at about an 8th-grade reading level or lower, with no error codes or technical terms. [A-19]
- **REQ-33** (Unwanted) If something goes wrong, then Carnegie Tickets shall say what happened and what the student can do next.
- **REQ-34** (Ubiquitous) Carnegie Tickets shall show the organizers' help email address on every student page. [A-20]

### US-8: Sign in to the admin area
*As an admin, I want the backend locked behind a password, so that only authorized people can use it.*

- **REQ-35** (Ubiquitous) Carnegie Tickets shall not show anything in the admin area to a person who has not entered the admin password.
- **REQ-36** (Unwanted) If the password is wrong, then Carnegie Tickets shall deny access with a general message that does not hint at what was wrong.
- **REQ-37** (Event-driven) When an admin signs out, or has been idle for 15 minutes, Carnegie Tickets shall end the admin session. [A-12]
- **REQ-38** (Event-driven) When an admin signs in, Carnegie Tickets shall ask for the admin's name and record it with everything that admin does. [A-11]

### US-9: Manage events
*As an admin, I want to enter and update event details, so that students see correct information.*

- **REQ-39** (Event-driven) When an admin creates an event, Carnegie Tickets shall save its name, date, time, place, price, capacity, and sales open and close times.
- **REQ-40** (Event-driven) When an admin edits an event, Carnegie Tickets shall save the changes and show them to students.
- **REQ-41** (Unwanted) If an admin sets capacity below the tickets already paid, held, or reserved, then Carnegie Tickets shall refuse and explain why.
- **REQ-42** (Event-driven) When an admin changes an event's price, Carnegie Tickets shall apply the new price only to future purchases.

### US-10: Run the event day to day
*As an admin, I want to see sales and help students, so that problems get fixed.*

- **REQ-43** (Event-driven) When an admin opens an event, Carnegie Tickets shall show tickets paid, held, and left, each order (student name, ID, email, quantity, ticket numbers, payment status), and the waitlist.
- **REQ-44** (Event-driven) When an admin enters a ticket number, Carnegie Tickets shall show the event, the buyer's name, and whether the ticket is valid.
- **REQ-45** (Event-driven) When an admin manually verifies a student who failed the photo check, Carnegie Tickets shall verify that student and record which admin did it. [A-11]
- **REQ-46** (Event-driven) When an admin asks to resend a confirmation email, Carnegie Tickets shall resend it to the confirmed address on the order.

### US-11: Keep only what is needed
*As a student, I want my data deleted after the event, so that it is not kept forever.*

- **REQ-47** (Event-driven) When 14 days have passed since an event ended, Carnegie Tickets shall delete that event's orders, tickets, waitlist entries, and the related student and email records. [A-16, A-17]
- **REQ-48** (Event-driven) When a photo check has a pass/fail result, Carnegie Tickets shall delete the ID photo, no later than 1 hour afterwards. [A-05]

### US-12: Stay correct under pressure
*As an organizer, I want sales to stay accurate even when everyone buys at once.*

- **REQ-49** (Unwanted) If two students try to buy the last ticket at the same moment, then Carnegie Tickets shall sell it to only one and tell the other it is sold out, offering the waitlist. [A-23]
- **REQ-50** (Unwanted) If Stripe reports the same payment more than once, then Carnegie Tickets shall create the tickets only once.
- **REQ-51** (Unwanted) If Stripe confirms payment but Carnegie Tickets cannot create the tickets, then Carnegie Tickets shall keep the payment record, flag the order for admins, and tell the student in plain English that their tickets are on the way. An admin then issues the tickets or refunds through Stripe. [A-13]

## 6. Decisions I need from you

1. **Sample student ID** (A-03): please supply it so the check can be specified against real fields.
2. **School-email requirement** (A-18): restrict emails to the school's domain? Strongly recommended.
3. **Roster** (A-04): can the school give you a list of valid student IDs?
4. **Backups vs 14-day deletion** (A-16): accept 30-day backup expiry?
5. **Help address and ID-number pattern** (A-20, A-25).
6. **Expected crowd size on sale day** (A-23).

## Scope for HW3

- Build story [7]: [Reserve event tickets for attendees].
- No real payments. Where the spec says to charge a card, use a
  "Simulated payment" button and list real payments as a non-goal in
  the README.
- No sign-in provider. Where the spec needs a signed-in user, use a
  name typed into a text box and list real authentication as a
  non-goal.
- No database. Keep data in memory on the server and say in the README
  that it resets on every deploy.