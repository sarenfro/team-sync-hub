import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALL_TIMES = [
  "9:00am", "9:30am", "10:00am", "10:30am",
  "11:00am", "11:30am", "12:00pm", "12:30pm",
  "1:00pm", "1:30pm", "2:00pm", "2:30pm",
  "3:00pm", "3:30pm", "4:00pm", "4:30pm",
];

// Derive secret name from first name, e.g. "Sarrah Renfro" -> "ICAL_SARRAH"
function icalSecretName(memberName: string): string {
  const firstName = memberName.split(" ")[0].toUpperCase();
  return `ICAL_${firstName}`;
}

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
    const bookedTimes = new Set((existingBookings || []).map((b) => b.meeting_time));

    // Get iCal busy times for the member(s)
    const icalBusyTimes: string[] = [];

    if (memberId && memberId !== "all") {
      const { data: member } = await supabase
        .from("team_members")
        .select("name")
        .eq("id", memberId)
        .single();

      if (member) {
        const secretName = icalSecretName(member.name);
        const icalUrl = Deno.env.get(secretName);
        if (icalUrl) {
          const busy = await getIcalBusyTimes(icalUrl, date);
          icalBusyTimes.push(...busy);
        }
      }
    } else {
      // "Any team member" — a slot is only available if at least one member is free
      // Collect all members and find slots where anyone is available
      const { data: members } = await supabase
        .from("team_members")
        .select("name")
        .eq("is_active", true);

      if (members) {
        // For each slot, check if every member is busy — only block if all are busy
        const memberBusySets: Set<string>[] = [];

        for (const member of members) {
          const secretName = icalSecretName(member.name);
          const icalUrl = Deno.env.get(secretName);
          if (icalUrl) {
            const busy = await getIcalBusyTimes(icalUrl, date);
            memberBusySets.push(new Set(busy));
          }
        }

        if (memberBusySets.length > 0) {
          for (const slot of ALL_TIMES) {
            const allBusy = memberBusySets.every((s) => s.has(slot));
            if (allBusy) icalBusyTimes.push(slot);
          }
        }
      }
    }

    const busySet = new Set([...bookedTimes, ...icalBusyTimes]);
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

async function getIcalBusyTimes(icalUrl: string, date: string): Promise<string[]> {
  try {
    const res = await fetch(icalUrl);
    if (!res.ok) {
      console.error("Failed to fetch iCal:", res.status);
      return [];
    }
    const text = await res.text();
    return parseIcalForDate(text, date);
  } catch (err) {
    console.error("iCal fetch error:", err);
    return [];
  }
}

function parseIcalForDate(icalText: string, date: string): string[] {
  const busy: string[] = [];

  // Unfold lines (iCal wraps long lines with \r\n + space)
  const unfolded = icalText.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");

  // Extract all VEVENT blocks
  const eventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match;

  while ((match = eventRegex.exec(unfolded)) !== null) {
    const block = match[1];

    const dtstart = extractDtLine(block, "DTSTART");
    const dtend = extractDtLine(block, "DTEND");

    if (!dtstart) continue;

    // All-day event (VALUE=DATE): DTSTART;VALUE=DATE:YYYYMMDD
    if (dtstart.isDate) {
      const endDate = dtend?.rawDate ?? dtstart.rawDate;
      if (dateInRange(date, dtstart.rawDate, endDate)) {
        return ALL_TIMES; // entire day is blocked
      }
      continue;
    }

    // Timed event
    if (dtstart.localDate === undefined) continue;

    // Check if event falls on the requested date
    if (dtstart.localDate !== date) continue;

    const startMins = (dtstart.localHour ?? 0) * 60 + (dtstart.localMinute ?? 0);
    const endMins = dtend?.localDate
      ? (dtend.localHour ?? 0) * 60 + (dtend.localMinute ?? 0)
      : startMins + 30;

    for (const slot of ALL_TIMES) {
      const slotMins = slotToMinutes(slot);
      if (slotMins >= startMins && slotMins < endMins) {
        busy.push(slot);
      }
    }
  }

  return busy;
}

interface DtValue {
  isDate: boolean;
  rawDate: string;    // YYYYMMDD
  localDate?: string; // YYYY-MM-DD
  localHour?: number;
  localMinute?: number;
}

function extractDtLine(block: string, key: string): DtValue | null {
  const regex = new RegExp(`${key}(?:;[^:]*)?:([^\r\n]+)`);
  const match = block.match(regex);
  if (!match) return null;

  const value = match[1].trim();
  const paramStr = block.match(new RegExp(`${key}([^:]*):`))?.[1] ?? "";

  // All-day (date only)
  if (paramStr.includes("VALUE=DATE") || /^\d{8}$/.test(value)) {
    return { isDate: true, rawDate: value };
  }

  const rawDate = value.substring(0, 8);
  const isUtc = value.endsWith("Z");

  if (isUtc) {
    // UTC time — convert to Seattle/Pacific local time
    const dt = parseIcsDateTimeUtc(value);
    const local = toSeattleTime(dt);
    return { isDate: false, rawDate, localDate: local.date, localHour: local.hour, localMinute: local.minute };
  } else {
    // TZID time — the components are already in local time, read directly
    const h = parseInt(value.substring(9, 11));
    const mi = parseInt(value.substring(11, 13));
    const localDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
    return { isDate: false, rawDate, localDate, localHour: h, localMinute: mi };
  }
}

function parseIcsDateTimeUtc(value: string): Date {
  const y = value.substring(0, 4);
  const mo = value.substring(4, 6);
  const d = value.substring(6, 8);
  const h = value.substring(9, 11);
  const mi = value.substring(11, 13);
  const s = value.substring(13, 15) || "00";
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
}

function toSeattleTime(dt: Date): { date: string; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(dt);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  let hour = parseInt(get("hour"));
  const minute = parseInt(get("minute"));
  if (hour === 24) hour = 0;

  return { date: `${year}-${month}-${day}`, hour, minute };
}

function dateInRange(date: string, startRaw: string, endRaw: string): boolean {
  const target = date.replace(/-/g, "");
  return target >= startRaw && target < endRaw;
}

function slotToMinutes(slot: string): number {
  const match = slot.match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
  if (!match) return 0;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const period = match[3].toLowerCase();
  if (period === "pm" && h !== 12) h += 12;
  if (period === "am" && h === 12) h = 0;
  return h * 60 + m;
}
