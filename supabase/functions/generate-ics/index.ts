const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ORGANIZER_EMAIL = "uwmbaacalendar@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { booker_name, booker_email, meeting_date, meeting_time, duration_minutes, team_member_name, notes } = await req.json();

    if (!booker_name || !booker_email || !meeting_date || !meeting_time) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startDt = parseToUTC(meeting_date, meeting_time);
    const endDt = new Date(startDt.getTime() + (duration_minutes || 30) * 60000);

    const uid = crypto.randomUUID();
    const now = formatICSDate(new Date());
    const start = formatICSDate(startDt);
    const end = formatICSDate(endDt);

    const summary = team_member_name
      ? `Meeting with ${team_member_name}`
      : "Team Meeting";

    const description = notes ? notes.replace(/\n/g, "\\n") : "";

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Team Scheduler//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `ORGANIZER;CN=Team Scheduler:mailto:${ORGANIZER_EMAIL}`,
      `ATTENDEE;CN=${booker_name};RSVP=TRUE:mailto:${booker_email}`,
      `ATTENDEE;CN=Team Calendar;RSVP=TRUE:mailto:${ORGANIZER_EMAIL}`,
      "STATUS:CONFIRMED",
      "SEQUENCE:0",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    return new Response(
      JSON.stringify({ ics, filename: `meeting-${meeting_date}.ics` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error generating ICS:", err);
    return new Response(
      JSON.stringify({ error: "Failed to generate calendar file" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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
