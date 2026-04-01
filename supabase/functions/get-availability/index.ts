❯ what does the old two blocks say                                            

⏺ Find this entire section (lines 84–109 in the current file):

      for (const member of membersToCheck) {
        const envKey = icalEnvKey(member.name);
        const icalUrl = Deno.env.get(envKey);
        console.log(`[debug] member="${member.name}" envKey="${envKey}"
  urlFound=${!!icalUrl}`);
        if (icalUrl) {
          const busy = await getIcalBusyTimes(icalUrl, date);
          console.log(`[debug] busy slots for ${member.name}:`, busy);
          busySetsPerMember.push(new Set(busy));
        }
      }

      // Build combined busy set: a slot is busy if ANY member is busy during
  it
      const icalBusyTimes = new Set<string>();
      for (const busySet of busySetsPerMember) {
        for (const slot of busySet) {
          icalBusyTimes.add(slot);
        }
      }

      const allBusy = new Set([...bookedTimes, ...icalBusyTimes]);
      const availableTimes = ALL_TIMES.filter((t) => !allBusy.has(t));

      return new Response(
        JSON.stringify({ available_times: availableTimes, date }),
        { status: 200, headers: { ...corsHeaders, "Content-Type":
  "application/json" } }
      );

  Replace it with the new block from my previous message.

❯ ok replaced                                                                 

⏺ Now save it in Lovable to trigger a redeploy. Once it's deployed (30-60
  seconds), open browser DevTools (right-click → Inspect → Network tab), then
  select Sabrina and pick a date. Find the get-availability request in the
  Network tab and click on it — share what the Response shows.

❯ I got a build error: install (--ignore-scripts) failed with exit status 1:  
s/namespaces/lovable-core-prod/repositories/sandbox-npm-cache/downloads/ai_lZ 
Qh1OI_PPzw0 - 429                                                             
                                                                              
error: GET https://europe-west4-npm.pkg.dev/artifacts-downloads/namespaces/lo 
vable-core-prod/repositories/sandbox-npm-cache/downloads/JeMStEmncyMQLNFp -   
429                                                                           
                                                                              
error: GET https://europe-west4-npm.pkg.dev/artifacts-downloads/namespaces/lo 
vable-core-prod/repositories/sandbox-npm-cache/downloads/CjOgT05cRrIfJuFG -   
429                                                                           
                                                                              
error: GET https://europe-west4-npm.pkg.dev/artifacts-downloads/namespaces/lo 
vable-core-prod/repositories/sandbox-npm-cache/downloads/7esYw6rDccyaqAex -   
429                                                                           
                                                                              
error: GET https://europe-west4-npm.pkg.dev/artifacts-downloads/namespaces/lo 
vable-core-prod/repositories/sandbox-npm-cache/downloads/EFfMM3nTi8sH4kso -   
429                                                                           
                                                                              
error: GET https://europe-west4-npm.pkg.dev/artifacts-downloads/namespaces/lo 
vable-core-prod/repositories/sandbox-npm-cache/downloads/sIRlEcF37WaGazsg -   
429                                                                           
                                                                              
error: GET https://europe-west4-npm.pkg.dev/artifacts-downloads/namespaces/lo 
vable-core-prod/repositories/sandbox-npm-cache/downloads/foljqmDAm4J8yWc9 -   
429                                                                           
                                                                              
error: GET https://europe-west4-npm.pkg.dev/artifacts-downloads/namespaces/lo 
vable-core-prod/repositories/sandbox-npm-cache/downloads/AaoCrGhbL_bdJkkQ -   
429                                                                           

⏺ That's a Lovable infrastructure error (429 = rate limited on their package
  registry) — nothing wrong with your code. Just wait a minute and try saving
  again.

❯ 0                                                                           

⏺ Try saving once more now — the rate limit should have cleared.

❯ response: {                                                                 
    "available_times": [                                                      
        "9:00am",                                                             
        "9:30am",                                                             
        "10:00am",                                                            
        "10:30am",                                                            
        "11:00am",                                                            
        "11:30am",                                                            
        "12:00pm",                                                            
        "12:30pm",                                                            
        "1:00pm",                                                             
        "1:30pm",                                                             
        "2:00pm",                                                             
        "2:30pm",                                                             
        "3:00pm",                                                             
        "3:30pm",                                                             
        "4:00pm",                                                             
        "4:30pm"                                                              
    ],                                                                        
    "date": "2026-04-09"                                                      
}                                                                             

⏺ The debug field is missing from the response — the new code didn't deploy
  (the build error likely blocked it). Try saving in Lovable again, wait for a
   successful deploy, then retest.

❯ i got this: {                                                               
    "available_times": [                                                      
        "9:00am",                                                             
        "9:30am",                                                             
        "10:00am",                                                            
        "10:30am",                                                            
        "11:00am",                                                            
        "11:30am",                                                            
        "12:00pm",                                                            
        "12:30pm",                                                            
        "1:00pm",                                                             
        "1:30pm",                                                             
        "2:00pm",                                                             
        "2:30pm",                                                             
        "3:00pm",                                                             
        "3:30pm",                                                             
        "4:00pm",                                                             
        "4:30pm"                                                              
    ],                                                                        
    "date": "2026-04-16"                                                      
}                                                                             

⏺ Still no debug field — the edge function isn't updating. Let me test the
  iCal URL directly from here to see if the issue is the URL itself.

⏺ Bash(curl -s "https://outlook.office365.com/owa/calendar/eda19835f4d345ad908
      d52e12076f1ed@uw.edu/13287380fb4540ce90627453f96821db1567262881906726884
      5/calendar.ics" |…)
  ⎿  BEGIN:VCALENDAR
     METHOD:PUBLISH
     PRODID:Microsoft Exchange Server 2010
     … +58 lines (ctrl+o to expand)

⏺ Good news — the URL is accessible and works. Now let me check if Sabrina
  actually has events on the dates you tested (Apr 9, Apr 16):

⏺ Bash(curl -s "https://outlook.office365.com/owa/calendar/eda19835f4d345ad908
      d52e12076f1ed@uw.edu/13287380fb4540ce90627453f96821db1567262881906726884
      5/calendar.ics" |…)
  ⎿  DTSTART;TZID=Pacific Standard Time:20260409T103000
     DTEND;TZID=Pacific Standard Time:20260409T120000
     DTSTART;TZID=Pacific Standard Time:20260415T084500
     … +5 lines (ctrl+o to expand)

⏺ The iCal URL works and Sabrina has events on Apr 9 (10:30am–12pm) and Apr
  15/16. So the parsing should work — the most likely issue is the secret
  isn't actually reaching the edge function.

  The build errors may have been blocking edge function deployments entirely.
  Let's bypass Lovable and deploy directly from the Supabase dashboard:

  1. Go to your Supabase dashboard → Edge Functions (left sidebar)
  2. Click get-availability
  3. Look for an Edit or Deploy option

  Can you see those options there?

✻ Cooked for 2m 6s

❯ [Image #4]                                                                  
  ⎿  [Image #4]

⏺ Key finding: "Last updated 14 hours ago" — none of our Lovable saves
  triggered a redeployment. The function is still running the original version
   without our changes or the new secrets.

  Click "View code" — that should let us edit and deploy directly from the
  Supabase dashboard, bypassing Lovable's broken build pipeline.

❯ is this code in the file correct: import { createClient } from              
"https://esm.sh/@supabase/supabase-js@2.49.4";                                
                                                                              
const corsHeaders = {                                                         
  "Access-Control-Allow-Origin": "*",                                         
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey,      
content-type",                                                                
};                                                                            
                                                                              
const ALL_TIMES = [                                                           
  "9:00am",                                                                   
  "9:30am",                                                                   
  "10:00am",                                                                  
  "10:30am",                                                                  
  "11:00am",                                                                  
  "11:30am",                                                                  
  "12:00pm",                                                                  
  "12:30pm",                                                                  
  "1:00pm",                                                                   
  "1:30pm",                                                                   
  "2:00pm",                                                                   
  "2:30pm",                                                                   
  "3:00pm",                                                                   
  "3:30pm",                                                                   
  "4:00pm",                                                                   
  "4:30pm",                                                                   
];                                                                            
                                                                              
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
    const date = url.searchParams.get("date");                                
                                                                              
    if (!date) {                                                              
      return new Response(JSON.stringify({ error: "date parameter required"   
}), {                                                                         
        status: 400,                                                          
        headers: { ...corsHeaders, "Content-Type": "application/json" },      
      });                                                                     
    }                                                                         
                                                                              
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!,              
Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);                                  
                                                                              
    let query = supabase                                                      
      .from("bookings")                                                       
      .select("meeting_time, team_member_id")                                 
      .eq("meeting_date", date)                                               
      .eq("status", "confirmed");                                             
                                                                              
    if (memberId && memberId !== "all") {                                     
      query = query.eq("team_member_id", memberId);                           
    }                                                                         
                                                                              
    const { data: existingBookings } = await query;                           
    const bookedTimes = new Set((existingBookings || []).map((b) =>           
b.meeting_time));                                                             
                                                                              
    const icalBusyTimes: string[] = [];                                       
                                                                              
    if (memberId && memberId !== "all") {                                     
      const { data: member } = await                                          
supabase.from("team_members").select("name").eq("id", memberId).single();     
                                                                              
      if (member) {                                                           
        const secretName = icalSecretName(member.name);                       
        const icalUrl = Deno.env.get(secretName);                             
        if (icalUrl) {                                                        
          const busy = await getIcalBusyTimes(icalUrl, date);                 
          icalBusyTimes.push(...busy);                                        
        }                                                                     
      }                                                                       
    } else {                                                                  
      const { data: members } = await                                         
supabase.from("team_members").select("name").eq("is_active", true);           
                                                                              
      if (members) {                                                          
        const memberBusySets: Set<string>[] = [];                             
        const debugInfo: Record<string, unknown>[] = [];                      
                                                                              
        for (const member of membersToCheck) {                                
          const envKey = icalEnvKey(member.name);                             
          const icalUrl = Deno.env.get(envKey);                               
          const entry: Record<string, unknown> = { member: member.name,       
envKey, urlFound: !!icalUrl };                                                
          if (icalUrl) {                                                      
            const busy = await getIcalBusyTimes(icalUrl, date);               
            entry.busySlots = busy;                                           
            busySetsPerMember.push(new Set(busy));                            
          }                                                                   
          debugInfo.push(entry);                                              
        }                                                                     
        // Build combined busy set: a slot is busy if ANY member is busy      
during it                                                                     
        const icalBusyTimes = new Set<string>();                              
        for (const busySet of busySetsPerMember) {                            
          for (const slot of busySet) {                                       
            icalBusyTimes.add(slot);                                          
          }                                                                   
        }                                                                     
                                                                              
        const allBusy = new Set([...bookedTimes, ...icalBusyTimes]);          
        const availableTimes = ALL_TIMES.filter((t) => !allBusy.has(t));      
                                                                              
        return new Response(JSON.stringify({ available_times: availableTimes, 
 date, debug: debugInfo }), {                                                 
          status: 200,                                                        
          headers: { ...corsHeaders, "Content-Type": "application/json" },    
        });                                                                   
                                                                              
        // Build combined busy set: a slot is busy if ANY member is busy      
during                                                                        
        it;                                                                   
        const icalBusyTimes = new Set<string>();                              
        for (const busySet of busySetsPerMember) {                            
          for (const slot of busySet) {                                       
            icalBusyTimes.add(slot);                                          
          }                                                                   
        }                                                                     
                                                                              
        const allBusy = new Set([...bookedTimes, ...icalBusyTimes]);          
        const availableTimes = ALL_TIMES.filter((t) => !allBusy.has(t));      
                                                                              
        return new Response(JSON.stringify({ available_times: availableTimes, 
 date, debug: debugInfo }), {                                                 
          status: 200,                                                        
          headers: { ...corsHeaders, "Content-Type": "application/json" },    
        });                                                                   
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
                                                                              
    return new Response(JSON.stringify({ available_times: availableTimes,     
date }), {                                                                    
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
                                                                              
async function getIcalBusyTimes(icalUrl: string, date: string):               
Promise<string[]> {                                                           
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
  const unfolded = icalText.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g,     
"");                                                                          
  const eventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;                     
  let match;                                                                  
                                                                              
  while ((match = eventRegex.exec(unfolded)) !== null) {                      
    const block = match[1];                                                   
    const dtstart = extractDtLine(block, "DTSTART");                          
    const dtend = extractDtLine(block, "DTEND");                              
                                                                              
    if (!dtstart) continue;                                                   
                                                                              
    if (dtstart.isDate) {                                                     
      const endDate = dtend?.rawDate ?? dtstart.rawDate;                      
      if (dateInRange(date, dtstart.rawDate, endDate)) {                      
        return ALL_TIMES;                                                     
      }                                                                       
      continue;                                                               
    }                                                                         
                                                                              
    if (dtstart.localDate === undefined) continue;                            
    if (dtstart.localDate !== date) continue;                                 
                                                                              
    const startMins = (dtstart.localHour ?? 0) * 60 + (dtstart.localMinute ?? 
 0);                                                                          
    const endMins = dtend?.localDate ? (dtend.localHour ?? 0) * 60 +          
(dtend.localMinute ?? 0) : startMins + 30;                                    
                                                                              
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
  rawDate: string;                                                            
  localDate?: string;                                                         
  localHour?: number;                                                         
  localMinute?: number;                                                       
}                                                                             
                                                                              
function extractDtLine(block: string, key: string): DtValue | null {          
  const regex = new RegExp(`${key}(?:;[^:]*)?:([^\r\n]+)`);                   
  const match = block.match(regex);                                           
  if (!match) return null;                                                    
                                                                              
  const value = match[1].trim();                                              
  const paramStr = block.match(new RegExp(`${key}([^:]*):`))?.[1] ?? "";      
                                                                              
  if (paramStr.includes("VALUE=DATE") || /^\d{8}$/.test(value)) {             
    return { isDate: true, rawDate: value };                                  
  }                                                                           
                                                                              
  const rawDate = value.substring(0, 8);                                      
  const isUtc = value.endsWith("Z");                                          
                                                                              
  if (isUtc) {                                                                
    const dt = parseIcsDateTimeUtc(value);                                    
    const local = toSeattleTime(dt);                                          
    return { isDate: false, rawDate, localDate: local.date, localHour:        
local.hour, localMinute: local.minute };                                      
  } else {                                                                    
    const h = parseInt(value.substring(9, 11));                               
    const mi = parseInt(value.substring(11, 13));                             
    const localDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4,      
6)}-${rawDate.substring(6, 8)}`;                                              
    return { isDate: false, rawDate, localDate, localHour: h, localMinute: mi 
 };                                                                           
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
                                                                              
function toSeattleTime(dt: Date): { date: string; hour: number; minute:       
number } {                                                                    
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
  const get = (type: string) => parts.find((p) => p.type === type)?.value ??  
"00";                                                                         
  let hour = parseInt(get("hour"));                                           
  if (hour === 24) hour = 0;                                                  
                                                                              
  return {                                                                    
    date: `${get("year")}-${get("month")}-${get("day")}`,                     
    hour,                                                                     
    minute: parseInt(get("minute")),                                          
  };                                                                          
}                                                                             
                                                                              
function dateInRange(date: string, startRaw: string, endRaw: string): boolean 
 {                                                                            
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
                                                                              
//redeploy                                                                    
                                                                              

⏺ No — that code is broken. It has mixed-up versions, undefined variables
  (membersToCheck, icalEnvKey, busySetsPerMember), and duplicate blocks. This
  happened from the partial edits getting mixed together in Lovable.

  Since you have the Supabase "View code" editor open, replace the entire file
   with this clean version. This is the correct multi-member code with debug
  output:

  Read 1 file (ctrl+o to expand)

⏺ Select all the text in the Supabase "View code" editor and replace it with
  exactly this:

  import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey,
  content-type',
  };

  const ALL_TIMES = [
    "9:00am", "9:30am", "10:00am", "10:30am",
    "11:00am", "11:30am", "12:00pm", "12:30pm",
    "1:00pm", "1:30pm", "2:00pm", "2:30pm",
    "3:00pm", "3:30pm", "4:00pm", "4:30pm",
  ];

  function icalEnvKey(memberName: string): string {
    return `ICAL_${memberName.split(" ")[0].toUpperCase()}`;
  }

  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      const url = new URL(req.url);
      const date = url.searchParams.get("date");

      const memberIdsParam = url.searchParams.get("member_ids") ??
  url.searchParams.get("member_id");
      const memberIds = memberIdsParam
        ? memberIdsParam.split(",").map((id) => id.trim()).filter(Boolean)
        : [];

      if (!date) {
        return new Response(
          JSON.stringify({ error: "date parameter required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type":
  "application/json" } }
        );
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      let bookingQuery = supabase
        .from("bookings")
        .select("meeting_time, team_member_id")
        .eq("meeting_date", date)
        .eq("status", "confirmed");

      if (memberIds.length === 1) {
        bookingQuery = bookingQuery.eq("team_member_id", memberIds[0]);
      } else if (memberIds.length > 1) {
        bookingQuery = bookingQuery.in("team_member_id", memberIds);
      }

      const { data: existingBookings } = await bookingQuery;
      const bookedTimes = new Set((existingBookings || []).map((b) =>
  b.meeting_time));

      let membersToCheck: { name: string }[] = [];

      if (memberIds.length > 0) {
        const { data } = await supabase
          .from("team_members")
          .select("name")
          .in("id", memberIds);
        membersToCheck = data ?? [];
      } else {
        const { data } = await supabase
          .from("team_members")
          .select("name")
          .eq("is_active", true);
        membersToCheck = data ?? [];
      }

      const busySetsPerMember: Set<string>[] = [];
      const debugInfo: Record<string, unknown>[] = [];

      for (const member of membersToCheck) {
        const envKey = icalEnvKey(member.name);
        const icalUrl = Deno.env.get(envKey);
        const entry: Record<string, unknown> = { member: member.name, envKey,
  urlFound: !!icalUrl };
        if (icalUrl) {
          const busy = await getIcalBusyTimes(icalUrl, date);
          entry.busySlots = busy;
          busySetsPerMember.push(new Set(busy));
        }
        debugInfo.push(entry);
      }

      const icalBusyTimes = new Set<string>();
      for (const busySet of busySetsPerMember) {
        for (const slot of busySet) {
          icalBusyTimes.add(slot);
        }
      }

      const allBusy = new Set([...bookedTimes, ...icalBusyTimes]);
      const availableTimes = ALL_TIMES.filter((t) => !allBusy.has(t));

      return new Response(
        JSON.stringify({ available_times: availableTimes, date, debug:
  debugInfo }),
        { status: 200, headers: { ...corsHeaders, "Content-Type":
  "application/json" } }
      );
    } catch (err) {
      console.error("Error:", err);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type":
  "application/json" } }
      );
    }
  });

  async function getIcalBusyTimes(icalUrl: string, date: string):
  Promise<string[]> {
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
    const unfolded = icalText.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g,
  "");
    const eventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
    let match;

    while ((match = eventRegex.exec(unfolded)) !== null) {
      const block = match[1];
      const dtstart = extractDtLine(block, "DTSTART");
      const dtend = extractDtLine(block, "DTEND");

      if (!dtstart) continue;

      if (dtstart.isDate) {
        const endDate = dtend?.rawDate ?? dtstart.rawDate;
        if (dateInRange(date, dtstart.rawDate, endDate)) {
          return ALL_TIMES;
        }
        continue;
      }

      if (dtstart.localDate === undefined) continue;
      if (dtstart.localDate !== date) continue;

      const startMins = (dtstart.localHour ?? 0) * 60 + (dtstart.localMinute
  ?? 0);
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
    rawDate: string;
    localDate?: string;
    localHour?: number;
    localMinute?: number;
  }

  function extractDtLine(block: string, key: string): DtValue | null {
    const regex = new RegExp(`${key}(?:;[^:]*)?:([^\r\n]+)`);
    const match = block.match(regex);
    if (!match) return null;

    const value = match[1].trim();
    const paramStr = block.match(new RegExp(`${key}([^:]*):`))?.[1] ?? "";

    if (paramStr.includes("VALUE=DATE") || /^\d{8}$/.test(value)) {
      return { isDate: true, rawDate: value };
    }

    const rawDate = value.substring(0, 8);
    const isUtc = value.endsWith("Z");

    if (isUtc) {
      const dt = parseIcsDateTimeUtc(value);
      const local = toSeattleTime(dt);
      return { isDate: false, rawDate, localDate: local.date, localHour:
  local.hour, localMinute: local.minute };
    } else {
      const h = parseInt(value.substring(9, 11));
      const mi = parseInt(value.substring(11, 13));
      const localDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4,
  6)}-${rawDate.substring(6, 8)}`;
      return { isDate: false, rawDate, localDate, localHour: h, localMinute:
  mi };
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

  function toSeattleTime(dt: Date): { date: string; hour: number; minute:
  number } {
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
    const get = (type: string) => parts.find((p) => p.type === type)?.value ??
   "00";
    let hour = parseInt(get("hour"));
    if (hour === 24) hour = 0;

    return { date: `${get("year")}-${get("month")}-${get("day")}`, hour,
  minute: parseInt(get("minute")) };
  }

  function dateInRange(date: string, startRaw: string, endRaw: string):
  boolean {
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
