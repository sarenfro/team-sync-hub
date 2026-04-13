import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SLOT_TIMES = [
  "9:00am", "9:30am", "10:00am", "10:30am",
  "11:00am", "11:30am", "12:00pm", "12:30pm",
  "1:00pm", "1:30pm", "2:00pm", "2:30pm",
  "3:00pm", "3:30pm", "4:00pm", "4:30pm",
];

function icalEnvKey(memberName: string): string {
  return `ICAL_${memberName.split(" ")[0].toUpperCase()}`;
}

interface BusyBlock {
  member_id: string;
  member_name: string;
  color_index: number;
  time: string;
  source: "booking" | "ical";
  title?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");

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

    // Get all active team members
    const { data: members } = await supabase
      .from("team_members")
      .select("id, name, color_index")
      .eq("is_active", true)
      .order("color_index");

    if (!members || members.length === 0) {
      return new Response(
        JSON.stringify({ blocks: [], members: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get bookings for this date
    const { data: bookings } = await supabase
      .from("bookings")
      .select("meeting_time, team_member_id, booker_name")
      .eq("meeting_date", date)
      .eq("status", "confirmed");

    const blocks: BusyBlock[] = [];

    // Add booking blocks
    for (const booking of bookings || []) {
      const member = members.find((m) => m.id === booking.team_member_id);
      if (member) {
        blocks.push({
          member_id: member.id,
          member_name: member.name,
          color_index: member.color_index,
          time: booking.meeting_time,
          source: "booking",
          title: `Meeting with ${booking.booker_name}`,
        });
      }
    }

    // Add iCal blocks per member
    for (const member of members) {
      const envKey = icalEnvKey(member.name);
      const icalUrl = Deno.env.get(envKey);
      if (!icalUrl) continue;

      try {
        const res = await fetch(icalUrl);
        if (!res.ok) continue;
        const text = await res.text();
        const icalBlocks = parseIcalForDate(text, date);
        for (const ib of icalBlocks) {
          blocks.push({
            member_id: member.id,
            member_name: member.name,
            color_index: member.color_index,
            time: ib.time,
            source: "ical",
            title: ib.title,
          });
        }
      } catch (err) {
        console.error(`iCal fetch error for ${member.name}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        blocks,
        members: members.map((m) => ({ id: m.id, name: m.name, color_index: m.color_index })),
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

interface IcalBlock { time: string; title: string; }

function parseIcalForDate(icalText: string, date: string): IcalBlock[] {
  const results: IcalBlock[] = [];
  const unfolded = icalText.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const eventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match;

  while ((match = eventRegex.exec(unfolded)) !== null) {
    const block = match[1];

    // Skip events marked as "Free" (TRANSP:TRANSPARENT)
    if (/TRANSP:\s*TRANSPARENT/i.test(block)) continue;

    const dtstart = extractDtLine(block, "DTSTART");
    const dtend = extractDtLine(block, "DTEND");
    const summary = block.match(/SUMMARY:([^\r\n]+)/)?.[1]?.trim() ?? "Busy";

    if (!dtstart) continue;

    if (dtstart.isDate) {
      const endDate = dtend?.rawDate ?? dtstart.rawDate;
      if (dateInRange(date, dtstart.rawDate, endDate)) {
        return SLOT_TIMES.map((t) => ({ time: t, title: summary }));
      }
      continue;
    }

    if (dtstart.localDate === undefined) continue;

    const hasRrule = /RRULE:/i.test(block);
    const matchesDate = hasRrule
      ? doesRecurOnDate(block, date, dtstart)
      : dtstart.localDate === date;

    if (!matchesDate) continue;

    const startMins = (dtstart.localHour ?? 0) * 60 + (dtstart.localMinute ?? 0);
    const endMins = dtend?.localDate
      ? (dtend.localHour ?? 0) * 60 + (dtend.localMinute ?? 0)
      : startMins + 30;

    for (const slot of SLOT_TIMES) {
      const slotMins = slotToMinutes(slot);
      if (slotMins < endMins && slotMins + 30 > startMins) {
        results.push({ time: slot, title: summary });
      }
    }
  }

  return results;
}

// ---- iCal helpers (same as get-availability) ----

interface DtValue {
  isDate: boolean;
  rawDate: string;
  localDate?: string;
  localHour?: number;
  localMinute?: number;
}

function extractDtLine(block: string, key: string): DtValue | null {
  const regex = new RegExp(`${key}(?:;[^:]*)?:([^\r\n]+)`);
  const m = block.match(regex);
  if (!m) return null;
  const value = m[1].trim();
  const paramStr = block.match(new RegExp(`${key}([^:]*):`))?.[1] ?? "";

  if (paramStr.includes("VALUE=DATE") || /^\d{8}$/.test(value)) {
    return { isDate: true, rawDate: value };
  }

  const rawDate = value.substring(0, 8);
  const isUtc = value.endsWith("Z");

  if (isUtc) {
    const dt = parseIcsDateTimeUtc(value);
    const local = toSeattleTime(dt);
    return { isDate: false, rawDate, localDate: local.date, localHour: local.hour, localMinute: local.minute };
  } else {
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
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = formatter.formatToParts(dt);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  let hour = parseInt(get("hour"));
  if (hour === 24) hour = 0;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour, minute: parseInt(get("minute")) };
}

function doesRecurOnDate(block: string, date: string, dtstart: DtValue): boolean {
  const rruleLine = block.match(/RRULE:([^\r\n]+)/)?.[1];
  if (!rruleLine || !dtstart.localDate) return false;
  if (date < dtstart.localDate) return false;

  const parts: Record<string, string> = {};
  for (const part of rruleLine.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) parts[part.substring(0, eq)] = part.substring(eq + 1);
  }

  const freq = parts["FREQ"];
  const interval = parseInt(parts["INTERVAL"] || "1");
  const byday = parts["BYDAY"] ? parts["BYDAY"].split(",") : [];

  if (parts["UNTIL"]) {
    const u = parts["UNTIL"];
    let untilDate: string;
    if (u.endsWith("Z")) {
      const local = toSeattleTime(parseIcsDateTimeUtc(u));
      untilDate = local.date;
    } else {
      untilDate = `${u.substring(0, 4)}-${u.substring(4, 6)}-${u.substring(6, 8)}`;
    }
    if (date > untilDate) return false;
  }

  const DAY_NAMES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const MS_PER_DAY = 86400000;
  const targetDate = new Date(date + "T12:00:00Z");
  const startDate = new Date(dtstart.localDate + "T12:00:00Z");
  const targetDOW = targetDate.getUTCDay();

  if (freq === "WEEKLY") {
    if (!byday.includes(DAY_NAMES[targetDOW])) return false;
    const startWeekMs = startDate.getTime() - startDate.getUTCDay() * MS_PER_DAY;
    const targetWeekMs = targetDate.getTime() - targetDate.getUTCDay() * MS_PER_DAY;
    const weeksDiff = Math.round((targetWeekMs - startWeekMs) / (7 * MS_PER_DAY));
    return weeksDiff >= 0 && weeksDiff % interval === 0;
  }
  if (freq === "DAILY") {
    const daysDiff = Math.round((targetDate.getTime() - startDate.getTime()) / MS_PER_DAY);
    return daysDiff >= 0 && daysDiff % interval === 0;
  }
  if (freq === "MONTHLY") {
    const monthsDiff =
      (targetDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
      (targetDate.getUTCMonth() - startDate.getUTCMonth());
    if (monthsDiff < 0 || monthsDiff % interval !== 0) return false;
    if (byday.length > 0) {
      for (const byDayStr of byday) {
        const m = byDayStr.match(/^(-?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/);
        if (!m) continue;
        const n = m[1] ? parseInt(m[1]) : null;
        const dayIndex = DAY_NAMES.indexOf(m[2]);
        if (targetDOW !== dayIndex) continue;
        if (n === null) return true;
        const targetDay = targetDate.getUTCDate();
        if (n > 0) return targetDay >= (n - 1) * 7 + 1 && targetDay <= n * 7;
        const lastDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 0)).getUTCDate();
        const daysFromEnd = lastDay - targetDay;
        const absN = Math.abs(n);
        return daysFromEnd >= (absN - 1) * 7 && daysFromEnd < absN * 7;
      }
      return false;
    }
    if (parts["BYMONTHDAY"]) {
      return targetDate.getUTCDate() === parseInt(parts["BYMONTHDAY"]);
    }
  }
  if (freq === "YEARLY") {
    const yearsDiff = targetDate.getUTCFullYear() - startDate.getUTCFullYear();
    return yearsDiff >= 0 && yearsDiff % interval === 0 &&
      targetDate.getUTCMonth() === startDate.getUTCMonth() &&
      targetDate.getUTCDate() === startDate.getUTCDate();
  }
  return false;
}

function dateInRange(date: string, startRaw: string, endRaw: string): boolean {
  const target = date.replace(/-/g, "");
  return target >= startRaw && target < endRaw;
}

function slotToMinutes(slot: string): number {
  const m = slot.match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
  if (!m) return 0;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const period = m[3].toLowerCase();
  if (period === "pm" && h !== 12) h += 12;
  if (period === "am" && h === 12) h = 0;
  return h * 60 + min;
}
