import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BookingRequest {
  team_member_ids: string[];
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

    let memberIds: string[] = body.team_member_ids ?? [];

    if (memberIds.length === 0) {
      const { data: members } = await supabase
        .from("team_members")
        .select("id")
        .eq("is_active", true)
        .order("color_index")
        .limit(1);
      if (members && members.length > 0) {
        memberIds = [members[0].id];
      }
    }

    if (memberIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "No team members available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: memberRows } = await supabase
      .from("team_members")
      .select("id, name, calendar_type, calendar_id")
      .in("id", memberIds);

    const members = memberRows ?? [];

    const bookingInserts = members.map((m) => ({
      team_member_id: m.id,
      booker_name: body.booker_name,
      booker_email: body.booker_email,
      notes: body.notes || null,
      meeting_date: body.meeting_date,
      meeting_time: body.meeting_time,
      duration_minutes: body.duration_minutes,
      status: "confirmed",
    }));

    const { error: insertError } = await supabase.from("bookings").insert(bookingInserts);

    if (insertError) {
      console.error("Database error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save booking" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send ICS email to each team member
    for (const member of members) {
      if (member.calendar_id) {
        await sendIcsEmail({
          toEmail: member.calendar_id,
          toName: member.name,
          bookerName: body.booker_name,
          bookerEmail: body.booker_email,
          meetingDate: body.meeting_date,
          meetingTime: body.meeting_time,
          durationMinutes: body.duration_minutes,
          notes: body.notes,
        });
      }
    }

    // Send confirmation email to the booker
    const memberNames = members.map((m) => m.name.split(" ")[0]).join(" & ");
    await sendIcsEmail({
      toEmail: body.booker_email,
      toName: body.booker_name,
      bookerName: memberNames,
      bookerEmail: "",
      meetingDate: body.meeting_date,
      meetingTime: body.meeting_time,
      durationMinutes: body.duration_minutes,
      notes: body.notes,
      isBookerConfirmation: true,
    });

    return new Response(
      JSON.stringify({ success: true }),
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
  isBookerConfirmation?: boolean;
}): Promise<void> {
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoApiKey) {
    console.warn("BREVO_API_KEY not configured — skipping email");
    return;
  }

  const ics = generateIcs(params);
  const icsBase64 = btoa(ics);

  const formattedDate = new Date(params.meetingDate + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const subject = params.isBookerConfirmation
    ? `Your meeting is confirmed — ${formattedDate} at ${params.meetingTime}`
    : `New booking: ${params.bookerName} — ${formattedDate} at ${params.meetingTime}`;

  const html = params.isBookerConfirmation
    ? `
      <h2>Hi ${params.toName},</h2>
      <p>Your meeting has been confirmed!</p>
      <div>
        <p><strong>With:</strong> ${params.bookerName}</p>
        <p><strong>When:</strong> ${formattedDate} at ${params.meetingTime}</p>
        <p><strong>Duration:</strong> ${params.durationMinutes} minutes</p>
        ${params.notes ? `<p><strong>Notes:</strong> ${params.notes}</p>` : ""}
      </div>
      <p>The .ics file is attached — open it to add this meeting to your calendar.</p>
    `
    : `
      <h2>Hi ${params.toName},</h2>
      <p>You have a new meeting booking:</p>
      <div>
        <p><strong>Who:</strong> ${params.bookerName} (${params.bookerEmail})</p>
        <p><strong>When:</strong> ${formattedDate} at ${params.meetingTime}</p>
        <p><strong>Duration:</strong> ${params.durationMinutes} minutes</p>
        ${params.notes ? `<p><strong>Notes:</strong> ${params.notes}</p>` : ""}
      </div>
      <p>The .ics file is attached — open it to add this meeting to your calendar.</p>
    `;

  const emailBody = {
    sender: { name: "MBAA EC", email: "mbaa@uw.edu" },
    to: [{ email: params.toEmail, name: params.toName }],
    subject,
    htmlContent: html,
    attachment: [
      {
        name: `meeting-${params.meetingDate}.ics`,
        content: icsBase64,
      },
    ],
  };

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Brevo API error:", errText);
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
    "PRODID:-//MBAA EC//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:Meeting with ${params.bookerName}`,
    `DESCRIPTION:${description}`,
    `ORGANIZER;CN=MBAA EC:mailto:mbaa@uw.edu`,
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
