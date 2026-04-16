-- ============================================================
-- Full feature upgrade migration
-- Adds teams, profiles, event_types, availability, auth, etc.
-- Safe to run against the existing schema (uses IF NOT EXISTS / IF EXISTS guards)
-- ============================================================

-- 1. teams table (new)
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  claim_token UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow public read access on teams"
  ON public.teams FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Team admins can update their teams"
  ON public.teams FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_admins ta
      WHERE ta.team_id = teams.id AND ta.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Team owners can delete teams"
  ON public.teams FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_admins ta
      WHERE ta.team_id = teams.id AND ta.user_id = auth.uid() AND ta.role = 'owner'
    )
  );

-- 2. Add team_id and ical_url to existing team_members
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ical_url TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS html_link TEXT;

-- 3. Add cancellation and extra fields to existing bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancellation_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ics_uid TEXT,
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_type_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_cancellation_token_idx
  ON public.bookings (cancellation_token);

-- 4. profiles table (new)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  slug TEXT UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Anyone can view profiles"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER IF NOT EXISTS update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. team_admins table (new)
CREATE TABLE IF NOT EXISTS public.team_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, team_id)
);

ALTER TABLE public.team_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_admins WHERE user_id = _user_id AND team_id = _team_id
  );
$$;

CREATE POLICY IF NOT EXISTS "Users can view their own team associations"
  ON public.team_admins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can insert team associations for themselves"
  ON public.team_admins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Team owners can manage admins"
  ON public.team_admins FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_admins ta
      WHERE ta.team_id = team_admins.team_id AND ta.user_id = auth.uid() AND ta.role = 'owner'
    )
  );
CREATE POLICY IF NOT EXISTS "Team owners can update admins"
  ON public.team_admins FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_admins ta
      WHERE ta.team_id = team_admins.team_id AND ta.user_id = auth.uid() AND ta.role = 'owner'
    )
  );
CREATE POLICY IF NOT EXISTS "Users can leave teams"
  ON public.team_admins FOR DELETE USING (auth.uid() = user_id);

-- 6. event_types table (new)
CREATE TABLE IF NOT EXISTS public.event_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  location_type TEXT DEFAULT 'zoom',
  location_value TEXT,
  buffer_minutes INTEGER NOT NULL DEFAULT 0,
  min_notice_minutes INTEGER NOT NULL DEFAULT 240,
  max_days_advance INTEGER NOT NULL DEFAULT 60,
  assignment_strategy TEXT NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Anyone can view active event types"
  ON public.event_types FOR SELECT USING (is_active = true);
CREATE POLICY IF NOT EXISTS "Users can view own event types"
  ON public.event_types FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY IF NOT EXISTS "Users can insert own event types"
  ON public.event_types FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY IF NOT EXISTS "Users can update own event types"
  ON public.event_types FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY IF NOT EXISTS "Users can delete own event types"
  ON public.event_types FOR DELETE USING (auth.uid() = owner_user_id);

CREATE TRIGGER IF NOT EXISTS update_event_types_updated_at
  BEFORE UPDATE ON public.event_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add event_type_id FK now that the table exists
ALTER TABLE public.bookings
  ADD CONSTRAINT IF NOT EXISTS bookings_event_type_id_fkey
  FOREIGN KEY (event_type_id) REFERENCES public.event_types(id);

-- 7. availability_schedules table (new)
CREATE TABLE IF NOT EXISTS public.availability_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_of_week)
);

ALTER TABLE public.availability_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Anyone can view availability for booking"
  ON public.availability_schedules FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Users can insert own availability"
  ON public.availability_schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can update own availability"
  ON public.availability_schedules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can delete own availability"
  ON public.availability_schedules FOR DELETE USING (auth.uid() = user_id);

-- 8. availability_overrides table (new)
CREATE TABLE IF NOT EXISTS public.availability_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, override_date)
);

ALTER TABLE public.availability_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Anyone can view overrides for booking"
  ON public.availability_overrides FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Users can insert own overrides"
  ON public.availability_overrides FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can update own overrides"
  ON public.availability_overrides FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can delete own overrides"
  ON public.availability_overrides FOR DELETE USING (auth.uid() = user_id);

-- 9. google_calendar_tokens table (new)
CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  team_member_id UUID REFERENCES public.team_members(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_calendar_tokens_team_member_unique
  ON public.google_calendar_tokens(team_member_id) WHERE team_member_id IS NOT NULL;

CREATE POLICY IF NOT EXISTS "Users can view own tokens"
  ON public.google_calendar_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can insert own tokens"
  ON public.google_calendar_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can update own tokens"
  ON public.google_calendar_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can delete own tokens"
  ON public.google_calendar_tokens FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER IF NOT EXISTS update_google_calendar_tokens_updated_at
  BEFORE UPDATE ON public.google_calendar_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. routing_forms table (new)
CREATE TABLE IF NOT EXISTS public.routing_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  event_type_id UUID REFERENCES public.event_types(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  owner_user_id UUID,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  routing_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.routing_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Anyone can view active routing forms"
  ON public.routing_forms FOR SELECT USING (is_active = true);
CREATE POLICY IF NOT EXISTS "Owners can manage routing forms"
  ON public.routing_forms FOR ALL USING (auth.uid() = owner_user_id);

CREATE TRIGGER IF NOT EXISTS update_routing_forms_updated_at
  BEFORE UPDATE ON public.routing_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Update bookings RLS for personal booking flow
CREATE POLICY IF NOT EXISTS "Allow public read on bookings for availability"
  ON public.bookings FOR SELECT USING (true);
