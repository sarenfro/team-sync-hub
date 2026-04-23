-- Allow team members to update their own row (matched by email to auth user)
CREATE POLICY "Team members can update own profile"
  ON public.team_members FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Allow team admins to update any member in their team
CREATE POLICY "Team admins can update team members"
  ON public.team_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_admins ta
      WHERE ta.team_id = team_members.team_id AND ta.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_admins ta
      WHERE ta.team_id = team_members.team_id AND ta.user_id = auth.uid()
    )
  );
