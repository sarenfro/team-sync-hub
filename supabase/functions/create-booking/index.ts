import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.4/cors";

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
    let calendarType: string | null = null;
    let calendarId: string | null = null;

    if (body.team_member_id) {
      const { data: member } = await supabase
        .from("team_members")
        .select("calendar_type, calendar_id, name")
        .eq("id", body.team_member_id)
        .single();

      if (member) {
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
      start: {
        dateTime: startDateTime,
        timeZone: "UTC",
      },
      end: {
        dateTime: endDate.toISOString().replace("Z", ""),
        timeZone: "UTC",
      },
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
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (res.ok) {
      const data = await res.json();
      return data.id;
    } else {
      const errText = await res.text();
      console.error("Google Calendar API error:", errText);
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
      body: {
        contentType: "Text",
        content: booking.notes || "",
      },
      start: {
        dateTime: startDateTime,
        timeZone: "UTC",
      },
      end: {
        dateTime: endDate.toISOString().replace("Z", ""),
        timeZone: "UTC",
      },
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
        headers: {
          Authorization: `Bearer ${outlookToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (res.ok) {
      const data = await res.json();
      return data.id;
    } else {
      const errText = await res.text();
      console.error("Outlook Calendar API error:", errText);
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
