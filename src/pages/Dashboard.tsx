import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Calendar, Clock, Link2, GitFork, Users, Trash2, DoorOpen } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface TeamWithRole {
  team_id: string;
  role: string;
  team: { id: string; name: string; slug: string } | null;
}

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [teams, setTeams] = useState<TeamWithRole[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [pendingDeleteTeam, setPendingDeleteTeam] = useState<{ id: string; name: string } | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [pendingLeaveTeam, setPendingLeaveTeam] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("slug")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.slug) {
        navigate("/onboarding");
        return;
      }

      const { data } = await supabase
        .from("team_admins")
        .select("team_id, role, team:team_id(id, name, slug)")
        .eq("user_id", user.id);
      if (data) setTeams(data as unknown as TeamWithRole[]);
      setLoadingTeams(false);
    };
    loadData();
  }, [user, navigate]);

  const reloadTeams = async () => {
    const { data } = await supabase
      .from("team_admins")
      .select("team_id, role, team:team_id(id, name, slug)")
      .eq("user_id", user!.id);
    if (data) setTeams(data as unknown as TeamWithRole[]);
  };

  const handleDeleteTeam = async (teamId: string) => {
    const { error } = await supabase.from("teams").delete().eq("id", teamId);
    if (error) {
      toast({ title: "Error", description: "Failed to delete team", variant: "destructive" });
    } else {
      toast({ title: "Team deleted" });
      await reloadTeams();
    }
  };

  const handleLeaveTeam = async (teamId: string) => {
    const { error } = await supabase
      .from("team_admins")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", user!.id);
    if (error) {
      toast({ title: "Error", description: "Failed to leave team", variant: "destructive" });
    } else {
      toast({ title: "Left team" });
      await reloadTeams();
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-1" /> Sign Out
          </Button>
        </div>

        {/* Personal event types */}
        <div className="rounded-xl border border-border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" /> My Event Types
            </h2>
            <Button asChild variant="booking" size="sm">
              <Link to="/event-types">Manage</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Create and manage your personal meeting types with Zoom links.
          </p>
        </div>

        {/* Availability */}
        <div className="rounded-xl border border-border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Availability
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link to="/availability">Set Hours</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure your weekly working hours for bookings.
          </p>
        </div>

        {/* Integrations */}
        <div className="rounded-xl border border-border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Integrations
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link to="/integrations">Manage</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Connect Google Calendar to automatically block busy times.
          </p>
        </div>

        {/* Routing Forms */}
        <div className="rounded-xl border border-border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <GitFork className="h-4 w-4" /> Routing Forms
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link to="/routing-forms">Manage</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Pre-booking questions that route to the right event type.
          </p>
        </div>

        {/* Teams you admin */}
        {!loadingTeams && teams.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Teams
            </h2>
            {teams.map((t) => (
              <div
                key={t.team_id}
                className="flex items-center justify-between rounded-xl border border-border p-5 hover:bg-accent/50 transition-colors"
              >
                <Link to={`/admin/${t.team?.slug}`} className="flex-1">
                  <p className="font-medium text-foreground">{t.team?.name}</p>
                  <p className="text-sm text-muted-foreground">/book/{t.team?.slug}</p>
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-booking-hero-light text-booking-hero font-medium capitalize">
                    {t.role}
                  </span>
                  {t.role === "owner" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        setPendingDeleteTeam({ id: t.team_id, name: t.team?.name || "" });
                        setDeleteStep(1);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        setPendingLeaveTeam({ id: t.team_id, name: t.team?.name || "" });
                      }}
                    >
                      <DoorOpen className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Two-step delete confirmation */}
        <AlertDialog
          open={pendingDeleteTeam !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPendingDeleteTeam(null);
              setDeleteStep(1);
            }
          }}
        >
          <AlertDialogContent>
            {deleteStep === 1 ? (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete "{pendingDeleteTeam?.name}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this team, all its members, bookings, and event types. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); setDeleteStep(2); }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            ) : (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Once deleted, all data is gone forever.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (pendingDeleteTeam) handleDeleteTeam(pendingDeleteTeam.id);
                      setPendingDeleteTeam(null);
                      setDeleteStep(1);
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Delete Permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            )}
          </AlertDialogContent>
        </AlertDialog>

        {/* Leave team confirmation */}
        <AlertDialog
          open={pendingLeaveTeam !== null}
          onOpenChange={(open) => { if (!open) setPendingLeaveTeam(null); }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave "{pendingLeaveTeam?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                You will no longer have access to manage this team.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingLeaveTeam) handleLeaveTeam(pendingLeaveTeam.id);
                  setPendingLeaveTeam(null);
                }}
              >
                Leave Team
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Dashboard;
