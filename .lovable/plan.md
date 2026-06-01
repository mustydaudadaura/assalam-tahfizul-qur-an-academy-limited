
# Phased rebuild plan

You've asked for ~6 major new modules **plus** a multi-tenant schema rewrite **plus** Termii SMS/email. Honestly, that's 4–6 weeks of focused work. I will not pretend to ship it all in one turn — that produces broken code across every module. Here's how I propose to sequence it. Each phase ships working, tested code before the next starts.

## Phase 0 — Multi-tenant foundation (MUST come first)

Everything else depends on this. Touching it later means re-migrating every table.

- New `schools` table (name, logo, stamp, motto, address, contact, socials, theme colors, current_session_id, current_term_id)
- New `school_branches` table (optional, FK to schools)
- Add `school_id uuid NOT NULL` to: `students, teachers (profiles+roles), classes, subjects, sessions, terms, results, attendance, attendance_daily, student_term_reports, school_settings → schools, teacher_assignments`
- New `user_schools` table linking auth users to one or more schools with a role per school
- New roles enum values: `super_admin`, `cashier`, `accountant`, `parent`
- Rewrite every RLS policy to scope by `school_id` via a `current_school_id()` SECURITY DEFINER function reading from a `user_active_school` table (one row per user)
- School switcher in the admin shell
- Data migration: backfill existing rows into a default "HisGrace International School" school

**Deliverable:** existing app keeps working, scoped to one default school. No new features yet.

## Phase 1 — Parent portal + auto-linking

- New `guardians` table (full_name, phone, whatsapp, email, address, occupation, user_id nullable)
- New `student_guardians` join table (student_id, guardian_id, relationship, is_primary)
- Extend student registration form: capture guardian fields → on submit, create/find guardian by phone+email, create auth user with random password, send credentials, link to student
- New `/parent` route tree: dashboard listing all linked children, per-child tabs for results, attendance, fees, report card download
- Login by phone (custom server fn that resolves phone → email → password) or email
- `parent` role added to sidebar routing

**Deliverable:** Parents auto-provisioned during admission, can log in and see all children's records.

## Phase 2 — Finance module

- Tables: `fee_categories` (tuition, uniform, etc.), `fee_structures` (per class+term+category), `fee_assignments` (per student), `payments` (amount, method, receipt_no, recorded_by, paid_at), `expenses`, `payroll_records`
- Admin pages: fee setup, payment recording, outstanding balances, expense ledger
- Cashier portal: payment recording only
- Accountant portal: full financial view + reports
- PDF receipt generation (jsPDF, same pattern as report card)
- Parent portal: fee statement + outstanding balance per child

**Deliverable:** Fees can be configured, payments recorded, receipts printed, outstanding tracked.

## Phase 3 — CBT exam engine

- Tables: `question_banks` (per subject), `questions` (text, options jsonb, correct_option, marks), `cbt_exams` (subject, class, term, duration, start/end window), `cbt_attempts` (student, exam, started_at, submitted_at, score), `cbt_responses`
- Teacher portal: question entry + bulk import (CSV/Excel)
- Student portal: timed exam interface with auto-submit on timeout
- Auto-marking on submit, optionally feeds into `results.exam` score
- Anti-cheat basics: tab-blur detection log, randomized question order

**Deliverable:** Teachers create exams, students take them online, scores recorded.

## Phase 4 — Timetable + analytics dashboard

- Tables: `timetable_slots` (class_id, day_of_week, period_no, start_time, end_time, subject_id, teacher_id, room)
- Conflict detection: teacher can't be in two classes same slot, class can't have two subjects
- Class view, teacher view, exam timetable (separate table)
- Print/PDF export
- Admin dashboard: revenue trend, fee collection rate, attendance rate, student population by class/gender, top performers, grade distribution (using Recharts)

**Deliverable:** Functional scheduling + visual analytics overview.

## Phase 5 — Notifications (Termii SMS + Lovable email)

- Set up Lovable email infrastructure (sender domain)
- Add `TERMII_API_KEY` secret (you'll provide it)
- Server functions: `sendResultPublishedNotification`, `sendFeeReminderNotification`, `sendAttendanceAlert`, `sendAnnouncement`
- Notification log table for audit
- Admin "Announcements" page → broadcast to all parents / specific class / specific role
- Bulk SMS uses Termii batch endpoint; emails use Lovable queue

**Deliverable:** Result publication and announcements push to parents via SMS + email.

## What I'm NOT including (be aware)

- WhatsApp Business API (separate provider, expensive verification — defer)
- Online result checker with PINs (Phase 1 parent portal already covers this; PINs add maintenance overhead)
- Dark mode (1-hour polish task — easy add later)
- Activity logs / audit trails (Postgres triggers — Phase 6 if you want)
- Multi-branch beyond the table existing (UI deferred until needed)
- Super-admin cross-school dashboard (Phase 6)

## Technical notes (for me, summarized for you)

- All new tables follow the existing GRANT + RLS pattern, scoped by `school_id`
- Parent auto-provisioning uses a server function with `supabaseAdmin` (service role) since it creates auth users
- Termii integration goes through a TanStack server function with the API key in `process.env`, not client-side
- PDF generation continues using jsPDF + html2canvas (already in the project)

## My ask

**Confirm I should start with Phase 0 (multi-tenant foundation) in the next turn.** It's a schema migration touching every table — I want your explicit OK before running it because it's irreversible without a backup, and your existing data will be moved into a default "HisGrace" school row.

After Phase 0 ships and you confirm the app still works, I'll proceed to Phase 1 in the following turn. Each phase is roughly 1 substantial turn of work.

If you'd rather skip multi-tenancy (stay single-school) and jump straight to Parent Portal, say so — that saves ~1 phase of work and is the right call if you don't have other schools lined up as customers yet.
