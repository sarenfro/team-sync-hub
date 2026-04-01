import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BookingRequest {
  team_member_id: string | null;
  booker_name: string;
  booker_email: string;
  notes?: string;
  meeting_date: string;
  meeting_time: string;
  duration_minutes: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: BookingRequest = await req.json();

    if (!body.booker_name || !body.booker_email || !body.meeting_date || !body.meeting_time) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get team member details if specific member selected
    let memberName: string | null = null;
    let memberEmail: string | null = null;
    let calendarType: string | null = null;
    let calendarId: string | null = null;

    if (body.team_member_id) {
      const { data: member } = await supabase
        .from("team_members")
        .select("calendar_type, calendar_id, name")
        .eq("id", body.team_member_id)
        .single();

      if (member) {
        memberName = member.name;
        memberEmail = member.calendar_id;
        calendarType = member.calendar_type;
        calendarId = member.calendar_id;
      }
    } else {
      // "Any team member" — pick first available
      const { data: members } = await supabase
        .from("team_members")
        .select("id, calendar_type, calendar_id, name")
        .eq("is_active", true)
        .order("color_index")
        .limit(1);

      if (members && members.length > 0) {
        body.team_member_id = members[0].id;
        memberName = members[0].name;
        memberEmail = members[0].calendar_id;
        calendarType = members[0].calendar_type;
        calendarId = members[0].calendar_id;
      }
    }

    let calendarEventId: string | null = null;

    // Create calendar event based on calendar type
    if (calendarId) {
      if (calendarType === "google") {
        calendarEventId = await createGoogleCalendarEvent(body, calendarId);
      } else if (calendarType === "outlook") {
        calendarEventId = await createOutlookCalendarEvent(body, calendarId);
      }
    }

    // Save booking to database
    const { data: booking, error } = await supabase.from("bookings").insert({
      team_member_id: body.team_member_id,
      booker_name: body.booker_name,
      booker_email: body.booker_email,
      notes: body.notes || null,
      meeting_date: body.meeting_date,
      meeting_time: body.meeting_time,
      duration_minutes: body.duration_minutes,
      calendar_event_id: calendarEventId,
      status: "confirmed",
    }).select().single();

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to save booking" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send ICS email to team member
    if (memberEmail) {
      await sendIcsEmail({
        toEmail: memberEmail,
        toName: memberName ?? "Team Member",
        bookerName: body.booker_name,
        bookerEmail: body.booker_email,
        meetingDate: body.meeting_date,
        meetingTime: body.meeting_time,
        durationMinutes: body.duration_minutes,
        notes: body.notes,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        booking_id: booking.id,
        calendar_event_created: !!calendarEventId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendIcsEmail(params: {
  toEmail: string;
  toName: string;
  bookerName: string;
  bookerEmail: string;
  meetingDate: string;
  meetingTime: string;
  durationMinutes: number;
  notes?: string;
}): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? Deno.env.get("resend_api_key");
  if (!resendApiKey) {
    console.warn("RESEND_API_KEY not configured — skipping ICS email");
    return;
  }

  const ics = generateIcs(params);
  const icsBase64 = btoa(ics);

  const formattedDate = new Date(params.meetingDate + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const emailBody = {
    from: "Team Sync Hub <onboarding@resend.dev>",
    to: [params.toEmail],
    subject: `New booking: ${params.bookerName} — ${formattedDate} at ${params.meetingTime}`,
    html: `
      <p>Hi ${params.toName},</p>
      <p>You have a new meeting booking:</p>
      <ul>
        <li><strong>Who:</strong> ${params.bookerName} (${params.bookerEmail})</li>
        <li><strong>When:</strong> ${formattedDate} at ${params.meetingTime}</li>
        <li><strong>Duration:</strong> ${params.durationMinutes} minutes</li>
        ${params.notes ? `<li><strong>Notes:</strong> ${params.notes}</li>` : ""}
      </ul>
      <p>The .ics file is attached — open it to add this meeting to your calendar.</p>
    `,
    attachments: [
      {
        filename: `meeting-${params.meetingDate}.ics`,
        content: icsBase64,
      },
    ],
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Resend API error:", errText);
  }
}

function generateIcs(params: {
  bookerName: string;
  bookerEmail: string;
  toName: string;
  toEmail: string;
  meetingDate: string;
  meetingTime: string;
  durationMinutes: number;
  notes?: string;
}): string {
  const startDt = parseToUTC(params.meetingDate, params.meetingTime);
  const endDt = new Date(startDt.getTime() + params.durationMinutes * 60000);

  const uid = crypto.randomUUID();
  const now = formatICSDate(new Date());
  const start = formatICSDate(startDt);
  const end = formatICSDate(endDt);
  const description = params.notes ? params.notes.replace(/\n/g, "\\n") : "";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Team Sync Hub//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:Meeting with ${params.bookerName}`,
    `DESCRIPTION:${description}`,
    `ORGANIZER;CN=Team Sync Hub:mailto:onboarding@resend.dev`,
    `ATTENDEE;CN=${params.toName};RSVP=TRUE:mailto:${params.toEmail}`,
    `ATTENDEE;CN=${params.bookerName};RSVP=TRUE:mailto:${params.bookerEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function parseToUTC(dateStr: string, time12: string): Date {
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return new Date(`${dateStr}T09:00:00Z`);

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toLowerCase();

  if (period === "pm" && hours !== 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;

  return new Date(`${dateStr}T${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00Z`);
}

function formatICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

async function createGoogleCalendarEvent(
  booking: BookingRequest,
  calendarId: string
): Promise<string | null> {
  const googleToken = Deno.env.get("GOOGLE_CALENDAR_ACCESS_TOKEN");
  if (!googleToken) {
    console.warn("Google Calendar access token not configured");
    return null;
  }

  try {
    const startDateTime = `${booking.meeting_date}T${convertTo24Hour(booking.meeting_time)}:00`;
    const endDate = new Date(`${startDateTime}`);
    endDate.setMinutes(endDate.getMinutes() + booking.duration_minutes);

    const event = {
      summary: `Meeting with ${booking.booker_name}`,
      description: booking.notes || "",
      start: { dateTime: startDateTime, timeZone: "UTC" },
      end: { dateTime: endDate.toISOString().replace("Z", ""), timeZone: "UTC" },
      attendees: [{ email: booking.booker_email }],
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${googleToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(event),
      }
    );

    if (res.ok) {
      const data = await res.json();
      return data.id;
    } else {
      console.error("Google Calendar API error:", await res.text());
      return null;
    }
  } catch (err) {
    console.error("Google Calendar creation failed:", err);
    return null;
  }
}

async function createOutlookCalendarEvent(
  booking: BookingRequest,
  calendarId: string
): Promise<string | null> {
  const outlookToken = Deno.env.get("OUTLOOK_CALENDAR_ACCESS_TOKEN");
  if (!outlookToken) {
    console.warn("Outlook Calendar access token not configured");
    return null;
  }

  try {
    const startDateTime = `${booking.meeting_date}T${convertTo24Hour(booking.meeting_time)}:00`;
    const endDate = new Date(`${startDateTime}`);
    endDate.setMinutes(endDate.getMinutes() + booking.duration_minutes);

    const event = {
      subject: `Meeting with ${booking.booker_name}`,
      body: { contentType: "Text", content: booking.notes || "" },
      start: { dateTime: startDateTime, timeZone: "UTC" },
      end: { dateTime: endDate.toISOString().replace("Z", ""), timeZone: "UTC" },
      attendees: [
        {
          emailAddress: { address: booking.booker_email, name: booking.booker_name },
          type: "required",
        },
      ],
      isOnlineMeeting: true,
      onlineMeetingProvider: "teamsForBusiness",
    };

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${outlookToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(event),
      }
    );

    if (res.ok) {
      const data = await res.json();
      return data.id;
    } else {
      console.error("Outlook Calendar API error:", await res.text());
      return null;
    }
  } catch (err) {
    console.error("Outlook Calendar creation failed:", err);
    return null;
  }
}

function convertTo24Hour(time12: string): string {
  const match = time12.match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
  if (!match) return "09:00";

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toLowerCase();

  if (period === "pm" && hours !== 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, "0")}:${minutes}`;
}
