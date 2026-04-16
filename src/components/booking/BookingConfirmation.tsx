import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Calendar, Clock, User, Video, Download, ExternalLink, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { TeamMember } from "./TeamMemberSelect";

interface BookingConfirmationProps {
  members: TeamMember[];
  date: Date;
  time: string;
  bookerName: string;
  bookerEmail: string;
  cancellationToken?: string | null;
  onReset: () => void;
}

function formatMemberNames(members: TeamMember[]): string {
  if (members.length === 0) return "";
  if (members.length === 1) return members[0].name;
  const firsts = members.map((m) => m.name.split(" ")[0]);
  return firsts.slice(0, -1).join(", ") + " & " + firsts[firsts.length - 1];
}

interface ZoomInfo {
  name: string;
  url: string;
  meetingId?: string;
  passcode?: string;
}

function formatMeetingId(raw: string): string {
  // Strip non-digits then format as "XXX XXX XXXX" or "XXXX XXXX XXXX"
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 11) return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  // fallback: group into chunks of 3
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

function getZoomInfos(members: TeamMember[]): ZoomInfo[] {
  return members
    .filter((m) => m.zoomMeetingId || (m.calendarId && m.calendarId.endsWith("@uw.edu")))
    .map((m) => {
      const firstName = m.name.split(" ")[0];
      if (m.zoomMeetingId) {
        const digits = m.zoomMeetingId.replace(/\D/g, "");
        const url = `https://washington.zoom.us/j/${digits}${m.zoomPasscode ? `?pwd=${encodeURIComponent(m.zoomPasscode)}` : ""}`;
        return {
          name: firstName,
          url,
          meetingId: formatMeetingId(m.zoomMeetingId),
          passcode: m.zoomPasscode,
        };
      }
      // fallback: personal room from UW email
      const uwnetid = m.calendarId!.split("@")[0];
      return { name: firstName, url: `https://washington.zoom.us/my/${uwnetid}` };
    });
}

const BookingConfirmation = ({ members, date, time, bookerName, bookerEmail, onReset }: BookingConfirmationProps) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const meetingDate = format(date, "yyyy-MM-dd");
  const memberLabel = formatMemberNames(members);
  const zoomInfos = getZoomInfos(members);
  const meetingTitle = `Meeting with ${memberLabel}`;
  const duration = Math.max(...members.map((m) => m.meetingDuration));

  const handleDownloadICS = async () => {
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ics", {
        body: {
          booker_name: bookerName,
          booker_email: bookerEmail,
          meeting_date: meetingDate,
          meeting_time: time,
          duration_minutes: duration,
          team_member_name: memberLabel,
        },
      });

      if (error) throw error;

      const blob = new Blob([data.ics], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || "meeting.ics";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download .ics:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const getGoogleCalendarUrl = () => {
    const startDt = parseDateTime(meetingDate, time);
    const endDt = new Date(startDt.getTime() + duration * 60000);
    const fmt = (d: Date) =>
      d
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: meetingTitle,
      dates: `${fmt(startDt)}/${fmt(endDt)}`,
      details: `Booked by ${bookerName} (${bookerEmail})`,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const getOutlookCalendarUrl = () => {
    const startDt = parseDateTime(meetingDate, time);
    const endDt = new Date(startDt.getTime() + duration * 60000);
    const params = new URLSearchParams({
      path: "/calendar/action/compose",
      rru: "addevent",
      subject: meetingTitle,
      startdt: startDt.toISOString(),
      enddt: endDt.toISOString(),
      body: `Booked by ${bookerName} (${bookerEmail})`,
    });
    return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
  };

  return (
    <div className="max-w-lg mx-auto text-center space-y-8">
      <div className="space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-booking-success/10">
          <CheckCircle2 className="h-10 w-10 text-booking-success" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">You are scheduled</h2>
          <p className="text-muted-foreground">Add this meeting to your calendar using the options below.</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 text-left space-y-4">
        <h3 className="font-semibold text-foreground">{duration} Minute Meeting</h3>

        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 flex-shrink-0 text-booking-hero" />
            <span>{memberLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 flex-shrink-0 text-booking-hero" />
            <span>{format(date, "EEEE, MMMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 flex-shrink-0 text-booking-hero" />
            <span>{time} ({duration} minutes)</span>
          </div>
          {zoomInfos.length > 0 && (
            <div className="flex items-start gap-3">
              <Video className="h-4 w-4 flex-shrink-0 text-booking-hero mt-0.5" />
              <div className="space-y-3">
                {zoomInfos.map((z) => (
                  <div key={z.url} className="space-y-1">
                    <a
                      href={z.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block font-medium text-booking-hero underline hover:opacity-80"
                    >
                      {zoomInfos.length > 1 ? `Join ${z.name}'s Zoom` : "Join Zoom Meeting"}
                    </a>
                    {z.meetingId && (
                      <p className="text-xs text-muted-foreground">
                        Meeting ID: <span className="font-mono">{z.meetingId}</span>
                      </p>
                    )}
                    {z.passcode && (
                      <p className="text-xs text-muted-foreground">
                        Passcode: <span className="font-mono">{z.passcode}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Add to your calendar</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(getGoogleCalendarUrl(), "_blank")}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Google Calendar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(getOutlookCalendarUrl(), "_blank")}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Outlook Calendar
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadICS} disabled={isDownloading} className="gap-2">
            <Download className="h-4 w-4" />
            {isDownloading ? "Downloading..." : "Download .ics"}
          </Button>
        </div>
      </div>

      <Button variant="booking-outline" onClick={onReset}>
        Schedule another meeting
      </Button>
    </div>
  );
};

function parseDateTime(dateStr: string, time12: string): Date {
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return new Date(`${dateStr}T09:00:00Z`);

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toLowerCase();

  if (period === "pm" && hours !== 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;

  return new Date(`${dateStr}T${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00Z`);
}

export default BookingConfirmation;
