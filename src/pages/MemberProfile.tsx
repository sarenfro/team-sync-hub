import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Home, LogOut, Save } from "lucide-react";

interface MemberData {
  id: string;
  name: string;
  role: string;
  email: string;
  ical_url: string;
  zoom_meeting_id: string;
  zoom_passcode: string;
  meeting_duration: number;
}

const DURATION_OPTIONS = [15, 30, 45, 60];

const MemberProfile = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [allMembers, setAllMembers] = useState<{ id: string; name: string }[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [form, setForm] = useState<MemberData | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;

    const load = async () => {
      // Fetch all team members
      const { data: members } = await supabase
        .from("team_members")
        .select("id, name, role, email, ical_url, zoom_meeting_id, zoom_passcode, meeting_duration")
        .order("name");

      if (!members) { setLoadingProfile(false); return; }

      setAllMembers(members.map((m) => ({ id: m.id, name: m.name })));

      // Try to auto-match by email
      const match = members.find(
        (m) => m.email?.toLowerCase() === user.email?.toLowerCase()
      );

      if (match) {
        setSelectedMemberId(match.id);
        setForm({
          id: match.id,
          name: match.name ?? "",
          role: (match as any).role ?? "",
          email: match.email ?? user.email ?? "",
          ical_url: (match as any).ical_url ?? "",
          zoom_meeting_id: (match as any).zoom_meeting_id ?? "",
          zoom_passcode: (match as any).zoom_passcode ?? "",
          meeting_duration: (match as any).meeting_duration ?? 30,
        });
      }

      setLoadingProfile(false);
    };

    load();
  }, [user, authLoading]);

  const handleSelectMember = async (id: string) => {
    setSelectedMemberId(id);
    const { data } = await supabase
      .from("team_members")
      .select("id, name, role, email, ical_url, zoom_meeting_id, zoom_passcode, meeting_duration")
      .eq("id", id)
      .single();

    if (data) {
      setForm({
        id: data.id,
        name: data.name ?? "",
        role: (data as any).role ?? "",
        email: (data as any).email ?? user?.email ?? "",
        ical_url: (data as any).ical_url ?? "",
        zoom_meeting_id: (data as any).zoom_meeting_id ?? "",
        zoom_passcode: (data as any).zoom_passcode ?? "",
        meeting_duration: (data as any).meeting_duration ?? 30,
      });
    }
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    const { error } = await supabase
      .from("team_members")
      .update({
        name: form.name,
        role: form.role,
        email: form.email,
        ical_url: form.ical_url || null,
        zoom_meeting_id: form.zoom_meeting_id || null,
        zoom_passcode: form.zoom_passcode || null,
        meeting_duration: form.meeting_duration,
      } as any)
      .eq("id", form.id);

    if (error) {
      toast.error("Failed to save. Please try again.");
    } else {
      toast.success("Profile saved!");
    }
    setSaving(false);
  };

  if (authLoading || loadingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Home className="h-4 w-4" /> Home
          </Link>
          <button onClick={signOut} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Update your availability and meeting info for the booking page.
          </p>
        </div>

        {/* Member selector — shown if no auto-match */}
        {!form && (
          <div className="rounded-xl border border-border p-5 space-y-3">
            <p className="text-sm font-medium text-foreground">Which team member are you?</p>
            <div className="space-y-2">
              {allMembers.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleSelectMember(m.id)}
                  className="w-full text-left px-4 py-2.5 rounded-lg border border-border hover:border-booking-hero hover:bg-booking-hero-light transition-all text-sm font-medium text-foreground"
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Profile form */}
        {form && (
          <div className="rounded-xl border border-border p-6 space-y-5">

            {/* If they selected manually, allow switching */}
            {allMembers.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Team Member</label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => handleSelectMember(e.target.value)}
                  className="w-full text-sm border border-input rounded-md px-3 py-2 bg-background text-foreground"
                >
                  {allMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your full name"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Role / Title</label>
              <Input
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="e.g. VP of Finance"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="your@email.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Meeting Duration</label>
              <select
                value={form.meeting_duration}
                onChange={(e) => setForm({ ...form, meeting_duration: parseInt(e.target.value) })}
                className="w-full text-sm border border-input rounded-md px-3 py-2 bg-background text-foreground"
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d} minutes</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Calendar iCal URL</label>
              <Input
                value={form.ical_url}
                onChange={(e) => setForm({ ...form, ical_url: e.target.value })}
                placeholder="https://calendar.google.com/calendar/ical/..."
                className="text-xs font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Google Calendar: Settings → Integrate calendar → Secret address in iCal format
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Zoom Join Link</label>
              <Input
                value={form.zoom_meeting_id}
                onChange={(e) => setForm({ ...form, zoom_meeting_id: e.target.value })}
                placeholder="https://washington.zoom.us/j/..."
                className="text-xs font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Paste your full Zoom invite link (e.g. from your Zoom personal room or recurring meeting invite). This preserves the correct passcode encoding.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Zoom Passcode <span className="font-normal text-muted-foreground">(optional)</span></label>
              <Input
                value={form.zoom_passcode}
                onChange={(e) => setForm({ ...form, zoom_passcode: e.target.value })}
                placeholder="Only needed if not in the link above"
              />
            </div>

            <Button
              variant="booking"
              size="lg"
              className="w-full"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberProfile;
