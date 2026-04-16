import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Copy, Check, Users, Calendar, Home } from "lucide-react";
import TeamAdminManager from "@/components/TeamAdminManager";

interface Member {
  id: string;
  name: string;
  email: string | null;
  ical_url: string | null;
  is_active: boolean;
  color_index: number;
  zoom_meeting_id: string | null;
  zoom_passcode: string | null;
}

const avatarColors = [
  "bg-booking-avatar-1",
  "bg-booking-avatar-2",
  "bg-booking-avatar-3",
  "bg-booking-avatar-4",
];

const Admin = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [icalInputs, setIcalInputs] = useState<Record<string, string>>({});
  const [savingIcal, setSavingIcal] = useState<Record<string, boolean>>({});
  const [zoomIdInputs, setZoomIdInputs] = useState<Record<string, string>>({});
  const [zoomPassInputs, setZoomPassInputs] = useState<Record<string, string>>({});
  const [savingZoom, setSavingZoom] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;

    const load = async () => {
      const { data: team } = await supabase
        .from("teams")
        .select("id, name")
        .eq("slug", slug!)
        .maybeSingle();
      if (!team) return;

      // Check if user is admin of this team
      const { data: adminCheck } = await supabase
        .from("team_admins")
        .select("id")
        .eq("user_id", user.id)
        .eq("team_id", team.id)
        .maybeSingle();

      if (!adminCheck) {
        setUnauthorized(true);
        return;
      }

      setTeamId(team.id);
      setTeamName(team.name);

      const { data: mData } = await supabase
        .from("team_members")
        .select("id, name, email, ical_url, is_active, color_index, zoom_meeting_id, zoom_passcode")
        .eq("team_id", team.id)
        .order("created_at");
      if (mData) {
        setMembers(mData as Member[]);
        const icalIn: Record<string, string> = {};
        const zoomIdIn: Record<string, string> = {};
        const zoomPassIn: Record<string, string> = {};
        mData.forEach((m) => {
          icalIn[m.id] = (m as any).ical_url ?? "";
          zoomIdIn[m.id] = (m as any).zoom_meeting_id ?? "";
          zoomPassIn[m.id] = (m as any).zoom_passcode ?? "";
        });
        setIcalInputs(icalIn);
        setZoomIdInputs(zoomIdIn);
        setZoomPassInputs(zoomPassIn);
      }
    };
    load();
  }, [slug, user, authLoading]);

  const bookingUrl = `${window.location.origin}/book/${slug}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveIcal = async (memberId: string) => {
    setSavingIcal((prev) => ({ ...prev, [memberId]: true }));
    await supabase
      .from("team_members")
      .update({ ical_url: icalInputs[memberId] || null })
      .eq("id", memberId);
    setSavingIcal((prev) => ({ ...prev, [memberId]: false }));
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, ical_url: icalInputs[memberId] || null } : m,
      ),
    );
  };

  const handleSaveZoom = async (memberId: string) => {
    setSavingZoom((prev) => ({ ...prev, [memberId]: true }));
    await supabase
      .from("team_members")
      .update({
        zoom_meeting_id: zoomIdInputs[memberId] || null,
        zoom_passcode: zoomPassInputs[memberId] || null,
      } as any)
      .eq("id", memberId);
    setSavingZoom((prev) => ({ ...prev, [memberId]: false }));
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? { ...m, zoom_meeting_id: zoomIdInputs[memberId] || null, zoom_passcode: zoomPassInputs[memberId] || null }
          : m,
      ),
    );
  };

  const handleToggleActive = async (memberId: string, current: boolean) => {
    await supabase
      .from("team_members")
      .update({ is_active: !current })
      .eq("id", memberId);
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, is_active: !current } : m)),
    );
  };

  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to manage this team.</p>
          <Button variant="booking" onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{teamName}</h1>
            <p className="text-sm text-muted-foreground">Admin Dashboard</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <Home className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
              My Teams
            </Button>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>

        {/* Booking link */}
        <div className="rounded-xl border border-border p-6 space-y-3">
          <h2 className="font-semibold text-foreground">Your Booking Page</h2>
          <div className="flex items-center gap-2">
            <Input value={bookingUrl} readOnly className="font-mono text-sm" />
            <Button variant="outline" size="icon" onClick={handleCopy} title="Copy link">
              {copied ? (
                <Check className="h-4 w-4 text-booking-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <Button asChild variant="booking-outline" size="sm">
            <a href={bookingUrl} target="_blank" rel="noreferrer">
              Open Booking Page
            </a>
          </Button>
        </div>

        {/* Team members */}
        <div className="rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Team Members
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link to={`/admin/${slug}/members`}>Manage Members</Link>
            </Button>
          </div>

          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-4 rounded-lg border border-border"
              >
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-primary-foreground ${avatarColors[member.color_index % avatarColors.length]}`}
                >
                  {member.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-foreground">{member.name}</span>
                    <Switch
                      checked={member.is_active}
                      onCheckedChange={() => handleToggleActive(member.id, member.is_active)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {member.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={icalInputs[member.id] ?? ""}
                      onChange={(e) =>
                        setIcalInputs((prev) => ({ ...prev, [member.id]: e.target.value }))
                      }
                      placeholder="Paste iCal URL here..."
                      className="text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSaveIcal(member.id)}
                      disabled={savingIcal[member.id]}
                    >
                      {savingIcal[member.id] ? "Saving..." : "Save"}
                    </Button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      value={zoomIdInputs[member.id] ?? ""}
                      onChange={(e) =>
                        setZoomIdInputs((prev) => ({ ...prev, [member.id]: e.target.value }))
                      }
                      placeholder="Zoom Meeting ID (e.g. 123 456 7890)"
                      className="text-xs"
                    />
                    <Input
                      value={zoomPassInputs[member.id] ?? ""}
                      onChange={(e) =>
                        setZoomPassInputs((prev) => ({ ...prev, [member.id]: e.target.value }))
                      }
                      placeholder="Passcode"
                      className="text-xs w-28"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSaveZoom(member.id)}
                      disabled={savingZoom[member.id]}
                    >
                      {savingZoom[member.id] ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Admins */}
        {teamId && user && <TeamAdminManager teamId={teamId} currentUserId={user.id} />}

        {/* Bookings */}
        <div className="rounded-xl border border-border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Upcoming Bookings
            </h2>
            <Button asChild variant="booking" size="sm">
              <Link to={`/admin/${slug}/bookings`}>View All Bookings</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            View and manage all scheduled meetings for your team.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Admin;
