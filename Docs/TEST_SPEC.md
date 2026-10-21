# Carnegie Tickets: Test Specification

Status: Draft 0.1 (specification only, no code)
Every requirement in `requirements.md` (REQ-01 to REQ-51) and `SECURITY_SPEC.md` (SEC-01 to SEC-41) maps to a named test below. Where one test covers several requirements, the same name appears on each row.

**Type:** Auto = automated test. Manual = a person follows the steps. Review = a person checks a document, setting, or result.

## 1. Test environment rules (per SEC-40, A-21)

- Stripe **test mode** only. Use Stripe's published test cards: one that succeeds, one that is declined. Never real cards.
- Fake students only. Fake ID images are built from the sample ID you provide. Never real student data.
- A separate test email inbox catches all outgoing email.
- Load tests run against a copy, never live.
- Tests must run from a clean, empty database.

## 2. End-to-end tests (the scenarios you asked for)

| Name | Steps | Pass condition |
|---|---|---|
| `e2e_happy_path_buy_tickets` | Fake student enters name, student ID, email, and ID photo. Opens the email link. Picks an event and 3 tickets. Pays with the Stripe test success card. | Verified. 3 unique ticket numbers appear on screen and arrive by email within 5 minutes. Database, logs, and email contain no card data. |
| `e2e_sold_out_waitlist_offer_purchase` | Sell out an event. A second student joins the waitlist for 2. An unpaid hold expires. | The waitlisted student gets an offer email, buys 2 tickets in time, and gets ticket numbers. |
| `e2e_non_student_blocked` | A person with no ID photo, a wrong photo, or no link click tries to see events. | Nothing about events is shown. Plain-English message. |
| `e2e_admin_locked_and_usable` | Try the backend with no password, wrong password, then the right one. Create an event and look up a ticket. | First two are denied. Third works. Actions appear in the audit log. |
| `e2e_one_purchase_only` | A student buys 2 tickets, then tries again for the same event. | Second try refused in plain English. |

## 3. Requirement tests

| ID | Test name | Type | Pass condition |
|---|---|---|---|
| REQ-01 | `test_unverified_person_sees_no_event_details` | Auto | Event pages and data requests return no event data without verification. |
| REQ-02 | `test_verification_form_asks_for_all_four_items` | Auto | Form asks for name, student ID, email, ID photo. |
| REQ-03 | `test_matching_id_photo_passes` and `test_mismatched_name_or_id_fails` | Auto | Matching data passes. A wrong name or number fails. |
| REQ-04 | `test_failed_check_explains_and_allows_three_tries` and `test_third_failure_points_to_organizers` | Auto | Clear reason shown. Three tries allowed. Third failure shows the help address. |
| REQ-05 | `test_email_link_required_and_expires_after_30_minutes` | Auto | Unverified before the click. Link works within 30 minutes and fails after. |
| REQ-06 | `test_verified_student_sees_event_list_with_all_fields` | Auto | Name, date, time, place, price, tickets left all shown. |
| REQ-07 | `test_sold_out_event_shows_waitlist_not_buy` | Auto | "Sold out" and waitlist button show. No buy button. |
| REQ-08 | `test_sales_window_not_open_or_closed_blocks_purchase` | Auto | Message shown. Purchase refused before open and after close. |
| REQ-09 | `test_student_can_choose_one_to_four_tickets` | Auto | Each of 1, 2, 3, 4 accepted. |
| REQ-10 | `test_zero_five_negative_or_text_quantity_refused` | Auto | 0, 5, -1, "abc", and 2.5 all refused with the 4-ticket explanation. |
| REQ-11 | `test_request_above_remaining_offers_remaining_count` | Auto | With 2 left, asking for 4 shows "2 left" and allows 2 or 1. |
| REQ-12 | `test_second_purchase_same_event_refused_after_buying_fewer_than_four` | Auto | After buying 1, a second purchase is refused. |
| REQ-13 | `test_second_checkout_blocked_while_first_in_progress` | Auto | Second checkout for the same event is refused while the first is open. |
| REQ-14 | `test_hold_created_with_total_and_policy_shown` | Auto | Tickets held. Total and no-refund policy shown before payment. |
| REQ-15 | `test_hold_released_after_10_minutes_and_on_abandon` | Auto | Tickets back on sale after 10 minutes or after leaving payment. Plain message shown. |
| REQ-16 | `test_payment_only_on_stripe_hosted_page` | Auto | Payment step is on Stripe's page only. |
| REQ-17 | `test_no_card_field_or_card_data_in_our_pages_requests_or_database` | Auto | No card fields. Search of database, logs, emails, and backups for the test card number finds nothing. |
| REQ-18 | `test_declined_card_no_purchase_and_can_retry` | Auto | Declined test card shows plain message. No order paid. Retry allowed during hold. |
| REQ-19 | `test_paid_only_after_stripe_server_message` | Auto | Returning from Stripe without the server message creates no tickets. |
| REQ-20 | `test_ticket_numbers_unique_and_one_per_ticket` | Auto | 4 tickets give 4 different numbers. No repeats across 1,000 tickets. |
| REQ-21 | `test_ticket_email_within_five_minutes_and_on_screen` | Auto | Email arrives in 5 minutes with all listed items. Numbers also on screen. |
| REQ-22 | `test_email_failure_retries_and_admin_sees_failure` | Auto | Forced failure is retried and shown to admins. |
| REQ-23 | `test_confirmation_email_states_no_refund_policy` | Auto | Policy sentence is in the email. |
| REQ-24 | `test_never_sells_more_than_capacity` | Auto | Paid + held + reserved never exceeds capacity in any test. |
| REQ-25 | `test_join_waitlist_with_wanted_quantity` | Auto | Sold-out event: student joins with quantity 1 to 4. |
| REQ-26 | `test_duplicate_waitlist_or_already_bought_refused` | Auto | Second join, or join after buying, refused with reason. |
| REQ-27 | `test_waitlist_confirmation_screen_and_email` | Auto | Screen and email both confirm. |
| REQ-28 | `test_waitlist_offers_first_come_first_served` | Auto | Earliest joiner gets the first offer. |
| REQ-29 | `test_offer_email_sent_and_tickets_reserved_24_hours` | Auto | Offer email has a deadline. Reserved tickets cannot be bought by others. |
| REQ-30 | `test_expired_offer_passes_to_next_and_skips_when_quantity_does_not_fit` | Auto | After 24 hours the next fitting student gets it. A skipped student keeps their place. |
| REQ-31 | `test_offer_purchase_obeys_four_ticket_and_one_purchase_rules` | Auto | Offer purchase over 4, or a second purchase, is refused. |
| REQ-32 | `test_all_student_text_reads_at_grade_8_or_lower` | Auto + Review | Readability tool scores all text and emails at grade 8 or lower. A person reviews each message. |
| REQ-33 | `test_every_error_says_what_happened_and_what_to_do` | Review | Every error message in a checklist has both parts. |
| REQ-34 | `test_help_contact_shown_on_every_student_page` | Auto | Help address present on every student page. |
| REQ-35 | `test_backend_requires_password` | Auto | Every backend page redirects to sign-in without the password. |
| REQ-36 | `test_wrong_password_denied_with_generic_message` | Auto | Message is the same for all wrong entries. |
| REQ-37 | `test_admin_signed_out_after_15_idle_minutes_and_on_request` | Auto | Access ends at 15 idle minutes and on sign-out. |
| REQ-38 | `test_admin_name_required_and_recorded` | Auto | Sign-in without a name is refused. Actions show the name. |
| REQ-39 | `test_admin_creates_event_with_all_fields` | Auto | All fields saved and shown. |
| REQ-40 | `test_admin_edits_event` | Auto | Edits saved and visible to students. |
| REQ-41 | `test_capacity_below_sold_or_reserved_refused` | Auto | Refused with explanation. |
| REQ-42 | `test_price_change_leaves_existing_orders_unchanged` | Auto | Old orders keep their price. New orders use the new price. |
| REQ-43 | `test_admin_sees_sales_orders_and_waitlist` | Auto | Counts, order details, and waitlist all show correctly. |
| REQ-44 | `test_admin_ticket_lookup` | Auto | Valid, unknown, and mistyped numbers each give a clear result. |
| REQ-45 | `test_admin_manual_verification_and_record` | Auto | Student becomes verified. Admin name recorded. |
| REQ-46 | `test_admin_resend_email` | Auto | Email resent to the confirmed address only. |
| REQ-47 | `test_records_deleted_14_days_after_event_end` | Auto | With the clock moved forward, listed data is gone at day 14 and present at day 13. |
| REQ-48 | `test_id_photo_deleted_after_decision` | Auto | Photo gone within 1 hour of pass or fail. |
| REQ-49 | `test_last_ticket_two_buyers_only_one_wins` | Auto | 500 simultaneous attempts on 1 ticket: exactly 1 sale. |
| REQ-50 | `test_duplicate_stripe_message_creates_tickets_once` | Auto | Same message sent twice gives one set of tickets. |
| REQ-51 | `test_paid_but_ticket_failure_flagged_to_admin_and_student_told` | Auto | Forced failure keeps the payment record, flags admins, and shows the plain message. |

## 4. Security tests

| ID | Test name | Type | Pass condition |
|---|---|---|---|
| SEC-01 | `test_every_student_route_rejects_no_or_fake_session` | Auto | Automated sweep of all student routes is denied without a valid session. |
| SEC-02 | `test_upload_rules_accept_jpeg_png_reject_others_and_disguised_files` | Auto | PDF, EXE, oversize, and a renamed script are all rejected. |
| SEC-03 | `test_id_photos_private_encrypted_and_deleted` | Auto + Review | Photo address is not reachable from outside. Storage is encrypted. Metadata removed. Deleted on time. |
| SEC-04 | `test_logs_urls_errors_contain_no_personal_data` | Auto | Search of logs, addresses, and error pages finds no names, IDs, emails. |
| SEC-05 | `test_sixth_failed_attempt_in_hour_blocked` | Auto | Sixth failure blocks for 1 hour with a plain message. |
| SEC-06 | `test_email_link_random_single_use_expiring` | Auto | Reuse, expiry, and another student's link all fail. |
| SEC-07 | `test_student_session_cookie_flags_and_timeouts` | Auto | Cookie flags correct. Ends at 30 minutes idle and 2 hours total. |
| SEC-08 | `test_roster_mismatch_fails_verification` | Auto | Only runs if a roster is loaded. Unlisted student fails. |
| SEC-09 | `test_one_purchase_rule_survives_id_variants_email_changes_and_double_clicks` | Auto | ID with extra spaces or different case, new email, two tabs, and double-click still give one purchase. |
| SEC-10 | `test_no_card_data_anywhere_scan` | Auto | Same scan as REQ-17 across pages, requests, database, logs, emails, backups. |
| SEC-11 | `test_payment_record_holds_only_allowed_fields` | Auto | Payment table has only the four allowed field types. |
| SEC-12 | `test_forged_or_old_stripe_message_rejected` | Auto | Wrong signature and 10-minute-old message are rejected. |
| SEC-13 | `test_tampered_price_or_quantity_ignored` | Auto | Edited price or quantity in the request has no effect. |
| SEC-14 | `test_wrong_amount_no_tickets_and_repeated_event_once` | Auto | Wrong amount creates no tickets and flags admins. Repeated event ID processed once. |
| SEC-15 | `test_no_secrets_in_code_browser_or_logs` | Auto | Secret scan of code, page source, and logs is clean. Test and live keys differ. |
| SEC-16 | `test_fake_success_url_does_not_issue_tickets` | Auto | Hand-typed success address shows no tickets. |
| SEC-17 | `test_all_backend_routes_reject_without_admin_session` | Auto | Sweep of every backend route is denied without a session. |
| SEC-18 | `test_password_stored_hashed_and_short_password_refused` | Auto + Review | Storage holds only a hash. Under 16 characters refused. |
| SEC-19 | `test_admin_lockout_after_five_failures` | Auto | Fifth failure locks for 15 minutes. Correct password is refused during the lock. |
| SEC-20 | `test_admin_session_flags_and_timeouts` | Auto | Strict cookie flags. Ends at 15 minutes idle and 8 hours total. |
| SEC-21 | `test_password_change_ends_all_sessions` | Auto | All open sessions fail after a change. |
| SEC-22 | `test_backend_not_linked_from_student_pages` | Auto + Review | No student page links to the backend. Network limit works if enabled. |
| SEC-23 | `test_backend_changes_fail_without_valid_csrf_token` | Auto | Changes without the token are rejected. |
| SEC-24 | `test_audit_log_records_actions_and_cannot_be_edited` | Auto | All listed actions logged. No edit or delete for admins. No personal data inside. |
| SEC-25 | `test_https_only_and_encryption_at_rest` | Auto + Review | HTTP redirects. TLS 1.2 or newer only. Database and backups encrypted. |
| SEC-26 | `test_only_allowed_data_fields_collected` | Review | Database and form fields match the allowed list exactly. |
| SEC-27 | `test_retention_job_and_backup_expiry` | Auto + Review | Deletion logged with no personal data. Oldest backup is 30 days or less. |
| SEC-28 | `test_admin_lists_mask_student_id` | Auto | Lists show the last 4 only. Detail page shows the full number. |
| SEC-29 | `test_errors_show_no_technical_details` | Auto | Forced errors show no stack traces, paths, or versions. |
| SEC-30 | `test_emails_have_no_id_or_payment_data_and_pass_spf_dkim_dmarc` | Auto | No ID number or payment data in email. Mail checks pass. |
| SEC-31 | `test_ticket_numbers_random_unique_not_sequential` | Auto | 10+ characters, no pattern across 10,000 samples. |
| SEC-32 | `test_no_third_party_trackers_or_data_sharing` | Auto | Only Stripe and the email service receive data. No tracking scripts. |
| SEC-33 | `test_injection_and_script_inputs_rejected` | Auto | Injection strings and script tags cause no effect and are safely shown or rejected. |
| SEC-34 | `test_rate_limits_on_student_endpoints` | Auto | Rapid repeated calls are slowed or blocked. Bot check present if enabled. |
| SEC-35 | `test_security_headers_present` | Auto | All listed headers on every page. |
| SEC-36 | `test_offer_link_random_single_student_expires` | Auto | Wrong student, reused link, and link after 24 hours all fail. |
| SEC-37 | `test_dependency_and_secret_scans_clean_before_release` | Auto | Zero unresolved high or critical findings. |
| SEC-38 | `test_security_events_logged_and_logs_restricted` | Auto + Review | Listed events appear. No personal data. Log access limited to admins. |
| SEC-39 | `test_stripe_or_email_outage_fails_closed` | Auto | Simulated outage refuses the action with a plain message. No tickets or verification granted. |
| SEC-40 | `test_test_environment_uses_test_mode_and_fake_data` | Review | Test environment holds only test keys and fake students. |
| SEC-41 | `tabletop_exercise_data_leak` | Review | Organizers walk through the steps and finish inside 24 hours. |

## 5. Load and timing checks

| Name | Pass condition |
|---|---|
| `load_500_students_at_on_sale_moment` (A-23) | No oversell. Pages respond and no student is left charged without tickets. |
| `timing_ticket_email_under_five_minutes` | 95% of emails arrive within 5 minutes under load. |

## 6. Exit rule for "tested until it works" (A-21)

The system counts as working when:

1. Every test above passes in a clean environment, **three runs in a row**.
2. `e2e_happy_path_buy_tickets` passes 20 times in a row with fake names, student IDs, and Stripe test payments, and each run returns the right ticket numbers.
3. There are no open high or critical security findings.
4. A person reads every student-facing message and confirms it is plain English.

Any failed test means fix, then rerun the whole suite (not only the failed test).

## 7. Coverage check

Requirements listed above: REQ-01 to REQ-51 (51 rows) and SEC-01 to SEC-41 (41 rows). Nothing in either specification lacks a test. If a requirement is added, a row must be added here before it is accepted.
