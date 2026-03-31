
-- Create team_members table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  calendar_type TEXT NOT NULL CHECK (calendar_type IN ('google', 'outlook')),
  calendar_id TEXT, -- email or calendar ID for API calls
  color_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_member_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  booker_name TEXT NOT NULL,
  booker_email TEXT NOT NULL,
  notes TEXT,
  meeting_date DATE NOT NULL,
  meeting_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  calendar_event_id TEXT, -- ID from Google/Outlook after creation
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'pending')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Team members are publicly readable (for the booking page)
CREATE POLICY "Team members are publicly viewable"
  ON public.team_members FOR SELECT USING (true);

-- Bookings can be created by anyone (public booking form)
CREATE POLICY "Anyone can create a booking"
  ON public.bookings FOR INSERT WITH CHECK (true);

-- Bookings are viewable only via edge functions (no direct public read)
CREATE POLICY "Bookings readable by service role only"
  ON public.bookings FOR SELECT USING (false);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed team members
INSERT INTO public.team_members (name, role, calendar_type, calendar_id, color_index) VALUES
  ('Sarah Johnson', 'Team Lead', 'google', NULL, 0),
  ('Marcus Chen', 'Senior Developer', 'outlook', NULL, 1),
  ('Priya Patel', 'Product Manager', 'outlook', NULL, 2),
  ('Alex Rivera', 'Design Lead', 'outlook', NULL, 3);
