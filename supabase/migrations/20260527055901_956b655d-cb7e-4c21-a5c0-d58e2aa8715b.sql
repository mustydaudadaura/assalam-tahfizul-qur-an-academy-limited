CREATE TABLE public.attendance_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  session_id uuid NOT NULL,
  term_id uuid NOT NULL,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late')),
  marked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, session_id, term_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_daily TO authenticated;
GRANT ALL ON public.attendance_daily TO service_role;

ALTER TABLE public.attendance_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage daily attendance" ON public.attendance_daily
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers manage daily attendance" ON public.attendance_daily
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'teacher'::app_role))
  WITH CHECK (has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Students view own daily attendance" ON public.attendance_daily
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM students s WHERE s.id = attendance_daily.student_id AND s.user_id = auth.uid()));

CREATE INDEX idx_attendance_daily_lookup ON public.attendance_daily (class_id, session_id, term_id, date);