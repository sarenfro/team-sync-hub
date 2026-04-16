-- Add Zoom Personal Meeting Room fields to team_members
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT,
  ADD COLUMN IF NOT EXISTS zoom_passcode TEXT;
