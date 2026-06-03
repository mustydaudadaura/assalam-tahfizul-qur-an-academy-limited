-- Subscriptions
CREATE TABLE IF NOT EXISTS public.school_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'trial', -- trial | starter | standard | premium | enterprise
  status text NOT NULL DEFAULT 'active', -- active | past_due | suspended | cancelled | expired
  billing_cycle text NOT NULL DEFAULT 'monthly', -- monthly | yearly
  price_ngn numeric NOT NULL DEFAULT 0,
  seats integer NOT NULL DEFAULT 100,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  trial_ends_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_subscriptions TO authenticated;
GRANT ALL ON public.school_subscriptions TO service_role;

ALTER TABLE public.school_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage subscriptions"
  ON public.school_subscriptions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "School admins view own subscription"
  ON public.school_subscriptions FOR SELECT TO authenticated
  USING (user_belongs_to_school(school_id));

-- helper
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT has_role(auth.uid(), 'super_admin')
$$;

-- promote a user (by email) to super_admin. Only callable by an existing super_admin,
-- OR by anyone if no super_admin exists yet (bootstrap).
CREATE OR REPLACE FUNCTION public.promote_to_super_admin(_email text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  target_uid uuid;
  has_any_super boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'super_admin') INTO has_any_super;
  IF has_any_super AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can promote others';
  END IF;

  SELECT id INTO target_uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF target_uid IS NULL THEN RAISE EXCEPTION 'User with email % not found', _email; END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (target_uid, 'super_admin')
    ON CONFLICT DO NOTHING;
  RETURN target_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_to_super_admin(text) TO authenticated;

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_subs_touch ON public.school_subscriptions;
CREATE TRIGGER trg_subs_touch BEFORE UPDATE ON public.school_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Backfill: give every existing school a trial subscription
INSERT INTO public.school_subscriptions (school_id, plan, status)
SELECT id, 'trial', 'active' FROM public.schools
ON CONFLICT (school_id) DO NOTHING;