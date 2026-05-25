
-- 1. Add CA3 to results, regenerate total/grade columns
ALTER TABLE public.results DROP COLUMN IF EXISTS total;
ALTER TABLE public.results DROP COLUMN IF EXISTS grade;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS ca3 numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE public.results ADD COLUMN total numeric(5,2) GENERATED ALWAYS AS (ca1 + ca2 + ca3 + exam) STORED;
ALTER TABLE public.results ADD COLUMN grade text GENERATED ALWAYS AS (public.calc_grade(ca1 + ca2 + ca3 + exam)) STORED;

-- 2. Per-student per-term report metadata (remarks, next term begins)
CREATE TABLE IF NOT EXISTS public.student_term_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  class_teacher_remark text,
  principal_remark text,
  next_term_begins date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, term_id)
);
ALTER TABLE public.student_term_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage term reports" ON public.student_term_reports;
CREATE POLICY "Admins manage term reports" ON public.student_term_reports
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Teachers manage term reports" ON public.student_term_reports;
CREATE POLICY "Teachers manage term reports" ON public.student_term_reports
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'teacher'));

DROP POLICY IF EXISTS "Students view own term reports" ON public.student_term_reports;
CREATE POLICY "Students view own term reports" ON public.student_term_reports
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_term_reports.student_id AND s.user_id = auth.uid()));
