
-- =====================================================================
-- 2. SCHOOLS TABLE
-- =====================================================================
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  motto text,
  address text,
  email text,
  phone text,
  website text,
  logo_url text,
  secondary_logo_url text,
  stamp_url text,
  principal_name text,
  principal_signature_url text,
  facebook_url text,
  twitter_url text,
  instagram_url text,
  primary_color text DEFAULT '#15803d',
  accent_color text DEFAULT '#84cc16',
  current_session_id uuid,
  current_term_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- 3. SCHOOL BRANCHES
CREATE TABLE public.school_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  phone text,
  is_main boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.school_branches TO authenticated;
GRANT ALL ON public.school_branches TO service_role;
ALTER TABLE public.school_branches ENABLE ROW LEVEL SECURITY;

-- 4. USER -> SCHOOLS MAPPING
CREATE TABLE public.user_schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, school_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_schools TO authenticated;
GRANT ALL ON public.user_schools TO service_role;
ALTER TABLE public.user_schools ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_active_school (
  user_id uuid PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_active_school TO authenticated;
GRANT ALL ON public.user_active_school TO service_role;
ALTER TABLE public.user_active_school ENABLE ROW LEVEL SECURITY;

-- 5. HELPERS
CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT school_id FROM public.user_active_school WHERE user_id = auth.uid()),
    (SELECT school_id FROM public.user_schools WHERE user_id = auth.uid() ORDER BY created_at LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_school(_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_schools WHERE user_id = auth.uid() AND school_id = _school_id
  ) OR public.has_role(auth.uid(), 'super_admin')
$$;

-- Policies (created AFTER helper functions exist)
CREATE POLICY "View schools authenticated" ON public.schools FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins manage schools" ON public.schools FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "School admins update own school" ON public.schools FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.user_belongs_to_school(id));

CREATE POLICY "View branches" ON public.school_branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage branches" ON public.school_branches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users view own school links" ON public.user_schools FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage school links" ON public.user_schools FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "User reads own active school" ON public.user_active_school FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "User sets own active school" ON public.user_active_school FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "User updates own active school" ON public.user_active_school FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 6. SEED DEFAULT SCHOOL FROM school_settings
INSERT INTO public.schools (name, slug, motto, address, email, phone, website, logo_url, secondary_logo_url, principal_name, principal_signature_url)
SELECT
  COALESCE(school_name, 'HisGrace International School'),
  'hisgrace',
  motto, address, email, phone, website, logo_url, secondary_logo_url, principal_name, principal_signature_url
FROM public.school_settings WHERE id = 1
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.schools (name, slug)
SELECT 'HisGrace International School', 'hisgrace'
WHERE NOT EXISTS (SELECT 1 FROM public.schools WHERE slug = 'hisgrace');

-- 7. ADD school_id TO TENANT TABLES + BACKFILL
DO $$
DECLARE
  default_school uuid;
  tbl text;
  tenant_tables text[] := ARRAY[
    'students','classes','subjects','sessions','terms','results',
    'attendance','attendance_daily','student_term_reports','teacher_assignments'
  ];
BEGIN
  SELECT id INTO default_school FROM public.schools WHERE slug = 'hisgrace';

  FOREACH tbl IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE', tbl);
    EXECUTE format('UPDATE public.%I SET school_id = %L WHERE school_id IS NULL', tbl, default_school);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN school_id SET NOT NULL', tbl);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_school_id ON public.%I(school_id)', tbl, tbl);
  END LOOP;

  INSERT INTO public.user_schools (user_id, school_id)
  SELECT DISTINCT ur.user_id, default_school FROM public.user_roles ur
  ON CONFLICT (user_id, school_id) DO NOTHING;

  INSERT INTO public.user_active_school (user_id, school_id)
  SELECT DISTINCT ur.user_id, default_school FROM public.user_roles ur
  ON CONFLICT (user_id) DO NOTHING;
END $$;

-- 8. REWRITE RLS WITH school_id SCOPING
DROP POLICY IF EXISTS "Admins manage students" ON public.students;
DROP POLICY IF EXISTS "Students view self" ON public.students;
DROP POLICY IF EXISTS "Teachers view students" ON public.students;
CREATE POLICY "Admins manage students" ON public.students FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id))
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id));
CREATE POLICY "Students view self" ON public.students FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Teachers view students in school" ON public.students FOR SELECT TO authenticated
  USING ((public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id));

DROP POLICY IF EXISTS "Admins manage classes" ON public.classes;
DROP POLICY IF EXISTS "View classes" ON public.classes;
CREATE POLICY "Admins manage classes" ON public.classes FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id))
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id));
CREATE POLICY "View classes in school" ON public.classes FOR SELECT TO authenticated USING (public.user_belongs_to_school(school_id));

DROP POLICY IF EXISTS "Admins manage subjects" ON public.subjects;
DROP POLICY IF EXISTS "View subjects" ON public.subjects;
CREATE POLICY "Admins manage subjects" ON public.subjects FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id))
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id));
CREATE POLICY "View subjects in school" ON public.subjects FOR SELECT TO authenticated USING (public.user_belongs_to_school(school_id));

DROP POLICY IF EXISTS "Admins manage sessions" ON public.sessions;
DROP POLICY IF EXISTS "View sessions" ON public.sessions;
CREATE POLICY "Admins manage sessions" ON public.sessions FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id))
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id));
CREATE POLICY "View sessions in school" ON public.sessions FOR SELECT TO authenticated USING (public.user_belongs_to_school(school_id));

DROP POLICY IF EXISTS "Admins manage terms" ON public.terms;
DROP POLICY IF EXISTS "View terms" ON public.terms;
CREATE POLICY "Admins manage terms" ON public.terms FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id))
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id));
CREATE POLICY "View terms in school" ON public.terms FOR SELECT TO authenticated USING (public.user_belongs_to_school(school_id));

DROP POLICY IF EXISTS "Admins manage results" ON public.results;
DROP POLICY IF EXISTS "Students view own results" ON public.results;
DROP POLICY IF EXISTS "Teachers manage assigned results" ON public.results;
CREATE POLICY "Admins manage results" ON public.results FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id))
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id));
CREATE POLICY "Students view own results" ON public.results FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = results.student_id AND s.user_id = auth.uid()));
CREATE POLICY "Teachers manage assigned results" ON public.results FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teacher_assignments ta WHERE ta.teacher_id = auth.uid() AND ta.subject_id = results.subject_id AND ta.class_id = results.class_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teacher_assignments ta WHERE ta.teacher_id = auth.uid() AND ta.subject_id = results.subject_id AND ta.class_id = results.class_id));

DROP POLICY IF EXISTS "Admins manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Students view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers manage attendance" ON public.attendance;
CREATE POLICY "Admins manage attendance" ON public.attendance FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id))
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id));
CREATE POLICY "Teachers manage attendance" ON public.attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'teacher') AND public.user_belongs_to_school(school_id))
  WITH CHECK (public.has_role(auth.uid(),'teacher') AND public.user_belongs_to_school(school_id));
CREATE POLICY "Students view own attendance" ON public.attendance FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = attendance.student_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins manage daily attendance" ON public.attendance_daily;
DROP POLICY IF EXISTS "Students view own daily attendance" ON public.attendance_daily;
DROP POLICY IF EXISTS "Teachers manage daily attendance" ON public.attendance_daily;
CREATE POLICY "Admins manage daily attendance" ON public.attendance_daily FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id))
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id));
CREATE POLICY "Teachers manage daily attendance" ON public.attendance_daily FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'teacher') AND public.user_belongs_to_school(school_id))
  WITH CHECK (public.has_role(auth.uid(),'teacher') AND public.user_belongs_to_school(school_id));
CREATE POLICY "Students view own daily attendance" ON public.attendance_daily FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = attendance_daily.student_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins manage term reports" ON public.student_term_reports;
DROP POLICY IF EXISTS "Students view own term reports" ON public.student_term_reports;
DROP POLICY IF EXISTS "Teachers manage term reports" ON public.student_term_reports;
CREATE POLICY "Admins manage term reports" ON public.student_term_reports FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id))
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id));
CREATE POLICY "Teachers manage term reports" ON public.student_term_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'teacher') AND public.user_belongs_to_school(school_id))
  WITH CHECK (public.has_role(auth.uid(),'teacher') AND public.user_belongs_to_school(school_id));
CREATE POLICY "Students view own term reports" ON public.student_term_reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_term_reports.student_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins manage assignments" ON public.teacher_assignments;
DROP POLICY IF EXISTS "Teachers view own assignments" ON public.teacher_assignments;
CREATE POLICY "Admins manage assignments" ON public.teacher_assignments FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id))
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) AND public.user_belongs_to_school(school_id));
CREATE POLICY "Teachers view own assignments" ON public.teacher_assignments FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 9. AUTO-LINK NEW SIGNUPS TO DEFAULT SCHOOL
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_school uuid;
  desired_role app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);

  desired_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, desired_role);

  SELECT COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'school_id','')::uuid,
    (SELECT id FROM public.schools WHERE slug = 'hisgrace' LIMIT 1)
  ) INTO target_school;

  IF target_school IS NOT NULL THEN
    INSERT INTO public.user_schools (user_id, school_id) VALUES (NEW.id, target_school) ON CONFLICT DO NOTHING;
    INSERT INTO public.user_active_school (user_id, school_id) VALUES (NEW.id, target_school) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
