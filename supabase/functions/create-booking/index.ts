import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingRequest {
  team_member_ids: string[];
  booker_name: string;
  booker_email: string;
  notes?: string;
  meeting_date: string;
  meeting_time: string;
  duration_minutes: number;
  app_url?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: BookingRequest = await req.json();

    if (!body.booker_name || !body.booker_email || !body.meeting_date || !body.meeting_time) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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
      return new Response(JSON.stringify({ error: "No team members available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: memberRows } = await supabase
      .from("team_members")
      .select("id, name, calendar_type, calendar_id, color_index")
      .in("id", memberIds);

    const members = memberRows ?? [];

    const cancellationToken = crypto.randomUUID();
    const appUrl = Deno.env.get("APP_URL") || body.app_url || "";
    const cancelUrl = appUrl ? `${appUrl}/cancel?token=${cancellationToken}` : "";

    const bookingInserts = members.map((m) => ({
      team_member_id: m.id,
      booker_name: body.booker_name,
      booker_email: body.booker_email,
      notes: body.notes || null,
      meeting_date: body.meeting_date,
      meeting_time: body.meeting_time,
      duration_minutes: body.duration_minutes,
      status: "confirmed",
      cancellation_token: cancellationToken,
    }));

    const { error: insertError } = await supabase.from("bookings").insert(bookingInserts);

    if (insertError) {
      console.error("Database error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save booking" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build zoom links for all members
    const zoomLinks = members
      .filter((m) => m.calendar_id && m.calendar_id.endsWith("@uw.edu"))
      .map((m) => {
        const uwnetid = m.calendar_id!.split("@")[0];
        return { name: m.name.split(" ")[0], url: `https://washington.zoom.us/my/${uwnetid}` };
      });

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
          zoomLinks,
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
      zoomLinks,
      cancelUrl,
    });

    return new Response(JSON.stringify({ success: true, cancellation_token: cancellationToken }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
  zoomLinks?: { name: string; url: string }[];
  cancelUrl?: string;
}): Promise<void> {
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoApiKey) {
    console.warn("BREVO_API_KEY not configured — skipping email");
    return;
  }

  const ics = generateIcs({ ...params, zoomLinks: params.zoomLinks });
  const icsBase64 = btoa(ics);

  const formattedDate = new Date(params.meetingDate + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const zoomHtml =
    params.zoomLinks && params.zoomLinks.length > 0
      ? `<p><strong>Zoom:</strong> ${params.zoomLinks
          .map((z) => `<a href="${z.url}">${params.zoomLinks!.length > 1 ? `${z.name}'s Zoom` : "Join via Zoom"}</a>`)
          .join(" | ")}</p>`
      : "";

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
        ${zoomHtml}
        ${params.notes ? `<p><strong>Notes:</strong> ${params.notes}</p>` : ""}
      </div>
      <p>The .ics file is attached — open it to add this meeting to your calendar.</p>
      ${params.cancelUrl ? `<p style="margin-top:16px;font-size:13px;color:#666;">Need to cancel? <a href="${params.cancelUrl}" style="color:#cc0000;">Cancel this meeting</a></p>` : ""}
    `
    : `
      <h2>Hi ${params.toName},</h2>
      <p>You have a new meeting booking:</p>
      <div>
        <p><strong>Who:</strong> ${params.bookerName} (${params.bookerEmail})</p>
        <p><strong>When:</strong> ${formattedDate} at ${params.meetingTime}</p>
        <p><strong>Duration:</strong> ${params.durationMinutes} minutes</p>
        ${zoomHtml}
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
  zoomLinks?: { name: string; url: string }[];
}): string {
  const { hours: startH, minutes: startM } = parse12To24(params.meetingTime);
  const endTotalMins = startH * 60 + startM + params.durationMinutes;
  const endH = Math.floor(endTotalMins / 60);
  const endM = endTotalMins % 60;

  const dateCompact = params.meetingDate.replace(/-/g, "");
  const start = `${dateCompact}T${pad(startH)}${pad(startM)}00`;
  const end = `${dateCompact}T${pad(endH)}${pad(endM)}00`;

  const uid = crypto.randomUUID();
  const now = formatICSDate(new Date());
  const zoomUrl = params.zoomLinks && params.zoomLinks.length > 0 ? params.zoomLinks[0].url : "";
  const descParts = [];
  if (zoomUrl) descParts.push(`Zoom: ${zoomUrl}`);
  if (params.notes) descParts.push(params.notes);
  const description = descParts.join("\\n").replace(/\n/g, "\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MBAA EC//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VTIMEZONE",
    "TZID:America/Los_Angeles",
    "BEGIN:STANDARD",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "TZOFFSETFROM:-0700",
    "TZOFFSETTO:-0800",
    "TZNAME:PST",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "TZOFFSETFROM:-0800",
    "TZOFFSETTO:-0700",
    "TZNAME:PDT",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=America/Los_Angeles:${start}`,
    `DTEND;TZID=America/Los_Angeles:${end}`,
    `SUMMARY:Meeting with ${params.bookerName}`,
    `DESCRIPTION:${description}`,
    ...(zoomUrl ? [`LOCATION:${zoomUrl}`] : []),
    `ORGANIZER;CN=MBAA EC:mailto:mbaa@uw.edu`,
    `ATTENDEE;CN=${params.toName};RSVP=TRUE:mailto:${params.toEmail}`,
    `ATTENDEE;CN=${params.bookerName};RSVP=TRUE:mailto:${params.bookerEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function parse12To24(time12: string): { hours: number; minutes: number } {
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return { hours: 9, minutes: 0 };
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toLowerCase();
  if (period === "pm" && hours !== 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;
  return { hours, minutes };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatICSDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}
