
-- Update score model: remove 3rd CA, recreate total/grade from CA1+CA2+Exam
ALTER TABLE public.results DROP COLUMN IF EXISTS total;
ALTER TABLE public.results DROP COLUMN IF EXISTS grade;
ALTER TABLE public.results DROP COLUMN IF EXISTS ca3;
ALTER TABLE public.results ADD COLUMN total numeric(5,2) GENERATED ALWAYS AS (ca1 + ca2 + exam) STORED;
ALTER TABLE public.results ADD COLUMN grade text GENERATED ALWAYS AS (public.calc_grade(ca1 + ca2 + exam)) STORED;

-- School settings extras
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS section_label text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS secondary_logo_url text;

-- Terms get begin/end dates
ALTER TABLE public.terms
  ADD COLUMN IF NOT EXISTS term_begins date,
  ADD COLUMN IF NOT EXISTS term_ends date;

-- Classes section (Nursery / Primary / Secondary)
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS section text;

-- Students house
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS house text;

-- Subjects grouping and max score
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Core Subjects',
  ADD COLUMN IF NOT EXISTS max_score numeric(5,2) DEFAULT 100;

-- Per-student term report extras: affective/psychomotor, head/teacher signatures, promotion
ALTER TABLE public.student_term_reports
  ADD COLUMN IF NOT EXISTS affective jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS psychomotor jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS promotion_status text,
  ADD COLUMN IF NOT EXISTS teacher_name text,
  ADD COLUMN IF NOT EXISTS teacher_signature_url text,
  ADD COLUMN IF NOT EXISTS head_name text,
  ADD COLUMN IF NOT EXISTS head_signature_url text,
  ADD COLUMN IF NOT EXISTS serial_no text;
