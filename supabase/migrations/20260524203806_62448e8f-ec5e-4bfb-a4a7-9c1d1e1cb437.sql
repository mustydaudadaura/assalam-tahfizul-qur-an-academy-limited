
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id ORDER BY
    CASE role WHEN 'admin' THEN 1 WHEN 'teacher' THEN 2 ELSE 3 END LIMIT 1
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View profiles authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile + default student role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student'));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ACADEMIC STRUCTURE ============
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View sessions" ON public.sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage sessions" ON public.sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, name)
);
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View terms" ON public.terms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage terms" ON public.terms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View classes" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage classes" ON public.classes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View subjects" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage subjects" ON public.subjects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ STUDENTS ============
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  admission_no TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  gender TEXT,
  date_of_birth DATE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  passport_url TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage students" ON public.students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers view students" ON public.students FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Students view self" ON public.students FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============ TEACHER ASSIGNMENTS ============
CREATE TABLE public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, subject_id, class_id)
);
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage assignments" ON public.teacher_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers view own assignments" ON public.teacher_assignments FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ RESULTS ============
CREATE OR REPLACE FUNCTION public.calc_grade(_total NUMERIC)
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE
    WHEN _total >= 70 THEN 'A'
    WHEN _total >= 60 THEN 'B'
    WHEN _total >= 50 THEN 'C'
    WHEN _total >= 45 THEN 'D'
    ELSE 'F'
  END
$$;

CREATE TABLE public.results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  ca1 NUMERIC(5,2) NOT NULL DEFAULT 0,
  ca2 NUMERIC(5,2) NOT NULL DEFAULT 0,
  exam NUMERIC(5,2) NOT NULL DEFAULT 0,
  total NUMERIC(5,2) GENERATED ALWAYS AS (ca1 + ca2 + exam) STORED,
  grade TEXT GENERATED ALWAYS AS (public.calc_grade(ca1 + ca2 + exam)) STORED,
  entered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, subject_id, session_id, term_id)
);
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage results" ON public.results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers manage assigned results" ON public.results FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teacher_assignments ta
    WHERE ta.teacher_id = auth.uid() AND ta.subject_id = results.subject_id AND ta.class_id = results.class_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teacher_assignments ta
    WHERE ta.teacher_id = auth.uid() AND ta.subject_id = results.subject_id AND ta.class_id = results.class_id));
CREATE POLICY "Students view own results" ON public.results FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = results.student_id AND s.user_id = auth.uid()));

-- ============ ATTENDANCE ============
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  present INT NOT NULL DEFAULT 0,
  absent INT NOT NULL DEFAULT 0,
  total_days INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, session_id, term_id)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage attendance" ON public.attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers manage attendance" ON public.attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Students view own attendance" ON public.attendance FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = attendance.student_id AND s.user_id = auth.uid()));

-- ============ SCHOOL SETTINGS ============
CREATE TABLE public.school_settings (
  id INT PRIMARY KEY DEFAULT 1,
  school_name TEXT NOT NULL DEFAULT 'HisGrace Academy',
  motto TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  principal_name TEXT,
  principal_signature_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO public.school_settings (id) VALUES (1);
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View settings" ON public.school_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.school_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public) VALUES
  ('logos','logos',true),
  ('passports','passports',true),
  ('signatures','signatures',true);

CREATE POLICY "Public read assets" ON storage.objects FOR SELECT TO public
  USING (bucket_id IN ('logos','passports','signatures'));
CREATE POLICY "Admins upload assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('logos','passports','signatures') AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update assets" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('logos','passports','signatures') AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete assets" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('logos','passports','signatures') AND public.has_role(auth.uid(), 'admin'));

-- ============ SEED ============
INSERT INTO public.sessions (name, is_current) VALUES ('2024/2025', true);
INSERT INTO public.terms (session_id, name, is_current)
  SELECT id, 'First Term', true FROM public.sessions WHERE name='2024/2025';
INSERT INTO public.terms (session_id, name)
  SELECT id, 'Second Term' FROM public.sessions WHERE name='2024/2025';
INSERT INTO public.terms (session_id, name)
  SELECT id, 'Third Term' FROM public.sessions WHERE name='2024/2025';

INSERT INTO public.classes (name, level) VALUES
  ('JSS 1','Junior'),('JSS 2','Junior'),('JSS 3','Junior'),
  ('SSS 1','Senior'),('SSS 2','Senior'),('SSS 3','Senior');

INSERT INTO public.subjects (name, code) VALUES
  ('Mathematics','MTH'),('English Language','ENG'),('Basic Science','BSC'),
  ('Social Studies','SOS'),('Civic Education','CVE'),('Computer Studies','CMP'),
  ('Agricultural Science','AGR'),('Christian Religious Studies','CRS');
