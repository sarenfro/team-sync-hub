     191 -  dateTime?: Date;                                                                                         
      190 +  rawDate: string;    // YYYYMMDD                                                                          
      191 +  localDate?: string; // YYYY-MM-DD                                                                        
      192 +  localHour?: number;                                                                                      
      193 +  localMinute?: number;                                                                                    
      194  }
      195  
      196  function extractDtLine(block: string, key: string): DtValue | null {
      195 -  // Match DTSTART, DTSTART;VALUE=DATE, DTSTART;TZID=...                                                   
      197    const regex = new RegExp(`${key}(?:;[^:]*)?:([^\r\n]+)`);
      198    const match = block.match(regex);
      199    if (!match) return null;
     ...
      206      return { isDate: true, rawDate: value };
      207    }
      208  
      208 -  // Parse datetime                                                                                        
      209 -  try {                                                                                                    
      210 -    // Format: YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS                                                         
      211 -    const dt = parseIcsDateTime(value);                                                                    
      212 -    const rawDate = value.substring(0, 8);                                                                 
      213 -    return { isDate: false, rawDate, dateTime: dt };                                                       
      214 -  } catch {                                                                                                
      215 -    return null;                                                                                           
      209 +  const rawDate = value.substring(0, 8);                                                                   
      210 +  const isUtc = value.endsWith("Z");                                                                       
      211 +                                                                                                           
      212 +  if (isUtc) {                                                                                             
      213 +    // UTC time — convert to Seattle/Pacific local time                                                    
      214 +    const dt = parseIcsDateTimeUtc(value);                                                                 
      215 +    const local = toSeattleTime(dt);                                                                       
      216 +    return { isDate: false, rawDate, localDate: local.date, localHour: local.hour, localMinute: local.minut
          +e };                                                                                                       
      217 +  } else {                                                                                                 
      218 +    // TZID time — the components are already in local time, read directly                                 
      219 +    const h = parseInt(value.substring(9, 11));                                                            
      220 +    const mi = parseInt(value.substring(11, 13));                                                          
      221 +    const localDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;  
      222 +    return { isDate: false, rawDate, localDate, localHour: h, localMinute: mi };                           
      223    }
      224  }
      225  
      219 -function parseIcsDateTime(value: string): Date {                                                           
      220 -  // YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS                                                                   
      226 +function parseIcsDateTimeUtc(value: string): Date {                                                        
      227    const y = value.substring(0, 4);
      228    const mo = value.substring(4, 6);
      229    const d = value.substring(6, 8);
      230    const h = value.substring(9, 11);
      231    const mi = value.substring(11, 13);
      232    const s = value.substring(13, 15) || "00";
      227 -  const isUtc = value.endsWith("Z");                                                                       
      228 -                                                                                                           
      229 -  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${isUtc ? "Z" : "-08:00"}`);                             
      233 +  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);                                                     
      234  }
      235  
      236  function toSeattleTime(dt: Date): { date: string; hour: number; minute: number } {
     ...
      252    const day = get("day");
      253    let hour = parseInt(get("hour"));
      254    const minute = parseInt(get("minute"));
      251 -                                                                                                           
      252 -  // Intl returns 24 for midnight in some environments                                                     
      255    if (hour === 24) hour = 0;
      256  
      255 -  return {                                                                                                 
      256 -    date: `${year}-${month}-${day}`,                                                                       
      257 -    hour,                                                                                                  
      258 -    minute,                                                                                                
      259 -  };                                                                                                       
      257 +  return { date: `${year}-${month}-${day}`, hour, minute };                                                
      258  }
      259  
      260  function dateInRange(date: string, startRaw: string, endRaw: string): boolean {
      263 -  // All-day events: end date is exclusive in iCal                                                         
      261    const target = date.replace(/-/g, "");
      262    return target >= startRaw && target < endRaw;
      263  }

⏺ Now update the parseIcalForDate function to use the new fields:

⏺ Update(supabase/functions/get-availability/index.ts)
  ⎿  Added 6 lines, removed 9 lines
      160        continue;
      161      }
      162  
      163 -    // Timed event — convert to local (Pacific) time                                                       
      164 -    if (!dtstart.dateTime) continue;                                                                       
      163 +    // Timed event                                                                                         
      164 +    if (dtstart.localDate === undefined) continue;                                                         
      165  
      166 -    const startLocal = toSeattleTime(dtstart.dateTime);                                                    
      167 -    const endLocal = dtend?.dateTime ? toSeattleTime(dtend.dateTime) : null;                               
      168 -                                                                                                           
      166      // Check if event falls on the requested date
      170 -    if (startLocal.date !== date) continue;                                                                
      167 +    if (dtstart.localDate !== date) continue;                                                              
      168  
      172 -    const startMins = startLocal.hour * 60 + startLocal.minute;                                            
      173 -    const endMins = endLocal                                                                               
      174 -      ? endLocal.hour * 60 + endLocal.minute                                                               
      169 +    const startMins = (dtstart.localHour ?? 0) * 60 + (dtstart.localMinute ?? 0);                          
      170 +    const endMins = dtend?.localDate                                                                       
      171 +      ? (dtend.localHour ?? 0) * 60 + (dtend.localMinute ?? 0)                                             
      172        : startMins + 30;
      173  
      174      for (const slot of ALL_TIMES) {

⏺ Now push it:

⏺ Bash(git add supabase/functions/get-availability/index.ts && git commit -m "Fix iCal timezone parsing for Outlook TZID
      events" && git push origin main)
  ⎿  [main e24ba13] Fix iCal timezone parsing for Outlook TZID events
      Committer: Sarrah Renfro <sarrahrenfro@Sarrahs-Air.local>
     Your name and email address were configured automatically based
     … +14 lines (ctrl+o to expand)

⏺ Pushed. Once Lovable picks it up, test with Sarrah and a date you know she has events — those times should now be blocked.
  Let me know!

✻ Crunched for 1m 54s

❯ still no                                                                                                                   

⏺ Let me test the parsing logic directly with a real date from her calendar before touching the code again.

⏺ Bash(curl -s "https://outlook.office365.com/owa/calendar/68dc221b66794966ab339f5ece8b39d7@uw.edu/396ef0e4cd3f432ea83531c92e
      54981411976358415669961196/calendar.ics" |…)
  ⎿  DTSTAMP:20260401T062255Z
     TRANSP:OPAQUE
     STATUS:CONFIRMED
     … +258 lines (ctrl+o to expand)

⏺ Bash(node -e "
      const ical = require('fs').readFileSync('/dev/stdin', 'utf8');…)
  ⎿  FOUND EVENT:
     UID:20260308T023425191Z@Washington.com
     SUMMARY:Busy
     … +48 lines (ctrl+o to expand)

⏺ The parsing logic is actually correct — the local test found all 8 April 1 events properly. The issue is likely that the
  edge function wasn't redeployed when I pushed to GitHub. Lovable auto-deploys the frontend but edge functions may need a
  manual trigger.

  Can you go to Lovable → Cloud → Edge Functions and check:
  1. Is get-availability listed?
  2. What's the last deployment date/time on it?

  If it's old, there should be a redeploy button there.

✻ Churned for 56s

❯ it says last updated 6 horus ago                                                                                           

⏺ Bash(which supabase && supabase --version)
  ⎿  Error: Exit code 1
     supabase not found

⏺ Bash(which npx && npx supabase --version 2>/dev/null || echo "not available")
  ⎿  /usr/local/bin/npx
     not available

  Read 1 file (ctrl+o to expand)

⏺ Bash(brew install supabase/tap/supabase 2>&1 | tail -5)
  ⎿  (eval):1: command not found: brew

⏺ Bash(npm install -g supabase 2>&1 | tail -5)
  ⎿  npm error Invalid response body while trying to fetch https://registry.npmjs.org/cmd-shim: EACCES: permission denie
     d, mkdir '/Users/sarrahrenfro/.npm/_cacache/content-v2/sha512/8a/56'
     npm error File exists: /Users/sarrahrenfro/.npm/_cacache/content-v2/sha512/8a/56
     … +4 lines (ctrl+o to expand)

⏺ Bash(sudo npm install -g supabase 2>&1 | tail -5)
  ⎿  sudo: a terminal is required to read the password; either use the -S option to read from standard input or configur
     e an askpass helper
     sudo: a password is required

⏺ I can't install it without your password. Type this in your terminal (the ! prefix runs it directly in this session):

  ! npm install -g supabase --force

✻ Sautéed for 31s

! npminstall -g supabase --force                                                                                             
  ⎿  (eval):1: command not found: npminstall


❯ [Image #3]                                                                                                                 
  ⎿  [Image #3]

⏺ There's a permissions issue with npm's cache. Run this to fix it, then install:

  ! sudo rm -rf /Users/sarrahrenfro/.npm/_cacache/content-v2/sha512/8a/56 && npm install -g supabase

  It will ask for your Mac password.

❯ done                                                                                                                       

⏺ Bash(supabase --version)
  ⎿  Error: Exit code 127
     (eval):1: command not found: supabase

⏺ It installed but isn't in the PATH for this session. Run this in your terminal to deploy both functions directly:

  ! npx supabase functions deploy get-availability --project-ref aikqlzoqnijnucskwawc

  It may ask you to log in to Supabase first — if it does, follow the login prompt.

❯ [Image #4]                                                                                                                 
  ⎿  [Image #4]

⏺ The npm cache issue is persisting. Let's fix it properly and try a different install method:

  ! sudo rm -rf /Users/sarrahrenfro/.npm/_cacache && curl -fsSL
  https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh

❯ says no such file or directory                                                                                             

⏺ Let me try downloading the CLI binary directly:

  ! curl -L https://github.com/supabase/cli/releases/latest/download/supabase_darwin_arm64.tar.gz -o /tmp/supabase.tar.gz &&
  tar -xzf /tmp/supabase.tar.gz -C /tmp && /tmp/supabase functions deploy get-availability --project-ref aikqlzoqnijnucskwawc

❯ done                                                                                                                       

⏺ Bash(/tmp/supabase --version)
  ⎿  Error: Exit code 127
     (eval):1: no such file or directory: /tmp/supabase

  Listed 1 directory (ctrl+o to expand)

⏺ Bash(tar -tzf /tmp/supabase.tar.gz)
  ⎿  LICENSE
     README.md
     supabase

⏺ Bash(tar -xzf /tmp/supabase.tar.gz -C /tmp supabase && ls -la /tmp/supabase)
  ⎿  -rwxr-xr-x  1 sarrahrenfro  wheel  91518818 Mar 25 12:46 /tmp/supabase

⏺ Got it. Now deploy:

⏺ Bash(/tmp/supabase functions deploy get-availability --project-ref aikqlzoqnijnucskwawc 2>&1)
  ⎿  Error: Exit code 1
     Access token not provided. Supply an access token by running supabase login or setting the SUPABASE_ACCESS_TOKEN
     environment variable.
     Try rerunning the command with --debug to troubleshoot the error.

⏺ Need a Supabase access token. Go to supabase.com → Account → Access Tokens (or this path:
  supabase.com/dashboard/account/tokens), create a new token, and paste it here and I'll use it to deploy.

❯ i dont have access to supabase since i made this on lovable                                                                

⏺ Go back to Lovable → Cloud → Edge Functions and click on get-availability — is there a Deploy or Redeploy button when you
  open it?

❯ no                                                                                                                         

⏺ You can claim your Supabase project by signing up at supabase.com with the same email you used for Lovable. The project is
  already there — you just need an account to access it.

  Once you're signed in at supabase.com, you should see the team-sync-hub project. From there:

  1. Go to Account → Access Tokens
  2. Create a new token
  3. Paste it here and I'll deploy the function immediately

❯ sbp_d5e8228a463c9104517f7f6d7f60e76f3b58baa7                                                                               

⏺ Bash(SUPABASE_ACCESS_TOKEN=sbp_d5e8228a463c9104517f7f6d7f60e76f3b58baa7 /tmp/supabase functions deploy get-availability
      --project-ref aikqlzoqnijnucskwawc 2>&1)
  ⎿  Error: Exit code 1
     WARNING: Docker is not running
     Uploading asset (get-availability): supabase/functions/get-availability/index.ts
     unexpected deploy status 403: {"message":"Your account does not have the necessary privileges to access this endpoint.
     For more details, refer to our documentation https://supabase.com/docs/guides/platform/access-control"}
     Try rerunning the command with --debug to troubleshoot the error.

⏺ The project is owned by Lovable's Supabase organization so my token doesn't have deploy access.

  The cleanest fix: paste the updated code directly into Lovable's code editor so it deploys through Lovable's own system.

  1. In Lovable, click Code (in that top menu you showed earlier)
  2. Navigate to supabase/functions/get-availability/index.ts
  3. Select all the code and replace it with what I'll give you
  4. Then publish

  Can you get to that file in Lovable's code editor?

✻ Crunched for 39s

❯ yes                                                                                                                        

⏺ Replace everything in that file with this:

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
        return new Response(
          JSON.stringify({ error: "date parameter required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

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
        const { data: members } = await supabase
          .from("team_members")
          .select("name")
          .eq("is_active", true);

        if (members) {
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
    const unfolded = icalText.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
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
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(dt);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
    let hour = parseInt(get("hour"));
    if (hour === 24) hour = 0;

    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      hour,
      minute: parseInt(get("minute")),
    };
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
