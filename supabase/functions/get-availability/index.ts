import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const memberId = url.searchParams.get("member_id");
    const date = url.searchParams.get("date"); // YYYY-MM-DD

    if (!date) {
      return new Response(
        JSON.stringify({ error: "date parameter required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get existing bookings for that date
    let query = supabase
      .from("bookings")
      .select("meeting_time, team_member_id")
      .eq("meeting_date", date)
      .eq("status", "confirmed");

    if (memberId && memberId !== "all") {
      query = query.eq("team_member_id", memberId);
    }

    const { data: existingBookings } = await query;

    const ALL_TIMES = [
      "9:00am", "9:30am", "10:00am", "10:30am",
      "11:00am", "11:30am", "1:00pm", "1:30pm",
      "2:00pm", "2:30pm", "3:00pm", "3:30pm",
      "4:00pm", "4:30pm",
    ];

    const bookedTimes = new Set(
      (existingBookings || []).map((b) => b.meeting_time)
    );

    // Also check Google/Outlook calendar free/busy if tokens are configured
    let calendarBusyTimes: string[] = [];
    if (memberId && memberId !== "all") {
      const { data: member } = await supabase
        .from("team_members")
        .select("calendar_type, calendar_id")
        .eq("id", memberId)
        .single();

      if (member?.calendar_id) {
        if (member.calendar_type === "google") {
          calendarBusyTimes = await getGoogleBusyTimes(member.calendar_id, date);
        } else if (member.calendar_type === "outlook") {
          calendarBusyTimes = await getOutlookBusyTimes(member.calendar_id, date);
        }
      }
    }

    const busySet = new Set([...bookedTimes, ...calendarBusyTimes]);
    const availableTimes = ALL_TIMES.filter((t) => !busySet.has(t));

    return new Response(
      JSON.stringify({ available_times: availableTimes, date }),
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

async function getGoogleBusyTimes(calendarId: string, date: string): Promise<string[]> {
  const token = Deno.env.get("GOOGLE_CALENDAR_ACCESS_TOKEN");
  if (!token) return [];

  try {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/freeBusy",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin: `${date}T00:00:00Z`,
          timeMax: `${date}T23:59:59Z`,
          items: [{ id: calendarId }],
        }),
      }
    );

    if (!res.ok) {
      await res.text();
      return [];
    }

    const data = await res.json();
    const busySlots = data.calendars?.[calendarId]?.busy || [];
    return busySlots.flatMap((slot: { start: string; end: string }) =>
      getTimeSlotsInRange(slot.start, slot.end)
    );
  } catch {
    return [];
  }
}

async function getOutlookBusyTimes(userId: string, date: string): Promise<string[]> {
  const token = Deno.env.get("OUTLOOK_CALENDAR_ACCESS_TOKEN");
  if (!token) return [];

  try {
    const res = await fetch(
      "https://graph.microsoft.com/v1.0/me/calendar/getSchedule",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schedules: [userId],
          startTime: { dateTime: `${date}T00:00:00`, timeZone: "UTC" },
          endTime: { dateTime: `${date}T23:59:59`, timeZone: "UTC" },
          availabilityViewInterval: 30,
        }),
      }
    );

    if (!res.ok) {
      await res.text();
      return [];
    }

    const data = await res.json();
    const schedule = data.value?.[0];
    if (!schedule?.scheduleItems) return [];

    return schedule.scheduleItems.flatMap(
      (item: { start: { dateTime: string }; end: { dateTime: string } }) =>
        getTimeSlotsInRange(item.start.dateTime, item.end.dateTime)
    );
  } catch {
    return [];
  }
}

function getTimeSlotsInRange(startISO: string, endISO: string): string[] {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const slots: string[] = [];

  const ALL_TIMES = [
    "9:00am", "9:30am", "10:00am", "10:30am",
    "11:00am", "11:30am", "1:00pm", "1:30pm",
    "2:00pm", "2:30pm", "3:00pm", "3:30pm",
    "4:00pm", "4:30pm",
  ];

  for (const time of ALL_TIMES) {
    const [h, m] = convertTo24Hour(time).split(":").map(Number);
    const slotDate = new Date(start);
    slotDate.setUTCHours(h, m, 0, 0);
    if (slotDate >= start && slotDate < end) {
      slots.push(time);
    }
  }
  return slots;
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
