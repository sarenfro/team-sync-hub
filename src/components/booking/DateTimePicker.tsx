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

  After pasting, publish it. Let me know when it's live and we'll test.

✻ Brewed for 32s

❯ ok its live                                                                                                                

⏺ Test it — select Sarrah as the team member and pick today (April 1). Her calendar has events at 12:30pm, 1:00pm, 1:15pm,
  1:30pm, 2:00pm, 5:00pm, and 6:00pm. Those times should be blocked or reduced in the available slots.

  What do you see?

❯ i still see slots of 1pm, 1:30pm, 2:00pm                                                                                   

⏺ Let me check the exact secret name — when you saved it in Lovable, was it ICAL_SARRAH (uppercase) or ical_sarrah
  (lowercase)?

❯ ICAL_SARRAH                                                                                                                

⏺ Let me look at how the DateTimePicker calls the availability function to check if the date format is correct.

  Listed 1 directory (ctrl+o to expand)

⏺ Found the real problem. The DateTimePicker component has a hardcoded list of times and never calls the get-availability
  edge function at all. The edge function exists but nothing calls it.

  I need to update the component to actually fetch availability. Let me write that fix:

  Read 1 file (ctrl+o to expand)

⏺ Update(src/components/booking/DateTimePicker.tsx)
  ⎿  File must be read first

⏺ Reading 1 file… (ctrl+o to expand)
  ⎿  src/components/booking/DateTimePicker.tsx

⏺ Write(src/components/booking/DateTimePicker.tsx)
  ⎿  Added 80 lines, removed 44 lines
      1 -import { useState, useMemo } from "react";                                                                   
      1 +import { useState, useMemo, useEffect } from "react";                                                        
      2  import {
      3    format,
      4    addMonths,
     ...
       6    startOfMonth,
       7    endOfMonth,
       8    eachDayOfInterval,
       9 -  isSameMonth,                                                                                              
       9    isSameDay,
      10    isToday,
      11    isBefore,
      12    startOfDay,
      13    getDay,
      15 -  addDays,                                                                                                  
      14  } from "date-fns";
      15  import { ChevronLeft, ChevronRight, Globe } from "lucide-react";
      16  import { Button } from "@/components/ui/button";
      17 +import { supabase } from "@/integrations/supabase/client";                                                  
      18  import type { TeamMember } from "./TeamMemberSelect";
      19  
      20  interface DateTimePickerProps {
     ...
      23    onBack: () => void;
      24  }
      25  
      27 -const AVAILABLE_TIMES = [                                                                                   
      28 -  "9:00am",                                                                                                 
      29 -  "9:30am",                                                                                                 
      30 -  "10:00am",                                                                                                
      31 -  "10:30am",                                                                                                
      32 -  "11:00am",                                                                                                
      33 -  "11:30am",                                                                                                
      34 -  "1:00pm",                                                                                                 
      35 -  "1:30pm",                                                                                                 
      36 -  "2:00pm",                                                                                                 
      37 -  "2:30pm",                                                                                                 
      38 -  "3:00pm",                                                                                                 
      39 -  "3:30pm",                                                                                                 
      40 -  "4:00pm",                                                                                                 
      41 -  "4:30pm",                                                                                                 
      42 -];                                                                                                          
      43 -                                                                                                            
      26  const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      27  
      28  const DateTimePicker = ({ member, onSelect, onBack }: DateTimePickerProps) => {
      29    const [currentMonth, setCurrentMonth] = useState(new Date());
      30    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
      31    const [selectedTime, setSelectedTime] = useState<string | null>(null);
      32 +  const [availableTimes, setAvailableTimes] = useState<string[]>([]);                                       
      33 +  const [loadingTimes, setLoadingTimes] = useState(false);                                                  
      34  
      35    const calendarDays = useMemo(() => {
      36      const start = startOfMonth(currentMonth);
      37      const end = endOfMonth(currentMonth);
      38      const days = eachDayOfInterval({ start, end });
      39      const startDay = getDay(start);
      56 -                                                                                                            
      57 -    // Add padding days from previous month                                                                 
      58 -    const paddingDays: (Date | null)[] = Array.from(                                                        
      59 -      { length: startDay },                                                                                 
      60 -      () => null                                                                                            
      61 -    );                                                                                                      
      62 -                                                                                                            
      40 +    const paddingDays: (Date | null)[] = Array.from({ length: startDay }, () => null);                      
      41      return [...paddingDays, ...days];
      42    }, [currentMonth]);
      43  
     ...
       46      return day !== 0 && day !== 6 && !isBefore(date, startOfDay(new Date()));
       47    };
       48  
       49 +  useEffect(() => {                                                                                        
       50 +    if (!selectedDate) return;                                                                             
       51 +                                                                                                           
       52 +    const fetchAvailability = async () => {                                                                
       53 +      setLoadingTimes(true);                                                                               
       54 +      setAvailableTimes([]);                                                                               
       55 +                                                                                                           
       56 +      const dateStr = format(selectedDate, "yyyy-MM-dd");                                                  
       57 +      const memberId = member.id === "all" ? null : member.id;                                             
       58 +                                                                                                           
       59 +      try {                                                                                                
       60 +        const params = new URLSearchParams({ date: dateStr });                                             
       61 +        if (memberId) params.set("member_id", memberId);                                                   
       62 +                                                                                                           
       63 +        const { data, error } = await supabase.functions.invoke("get-availability", {                      
       64 +          method: "GET",                                                                                   
       65 +          headers: { "Content-Type": "application/json" },                                                 
       66 +          body: null,                                                                                      
       67 +        });                                                                                                
       68 +                                                                                                           
       69 +        // Use fetch directly since invoke doesn't support query params well                               
       70 +        const res = await fetch(                                                                           
       71 +          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-availability?${params.toString()}`,       
       72 +          {                                                                                                
       73 +            headers: {                                                                                     
       74 +              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,                                       
       75 +              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,                    
       76 +            },                                                                                             
       77 +          }                                                                                                
       78 +        );                                                                                                 
       79 +                                                                                                           
       80 +        if (res.ok) {                                                                                      
       81 +          const json = await res.json();                                                                   
       82 +          setAvailableTimes(json.available_times ?? []);                                                   
       83 +        } else {                                                                                           
       84 +          console.error("Failed to fetch availability:", await res.text());                                
       85 +          setAvailableTimes([]);                                                                           
       86 +        }                                                                                                  
       87 +      } catch (err) {                                                                                      
       88 +        console.error("Availability fetch error:", err);                                                   
       89 +        setAvailableTimes([]);                                                                             
       90 +      } finally {                                                                                          
       91 +        setLoadingTimes(false);                                                                            
       92 +      }                                                                                                    
       93 +    };                                                                                                     
       94 +                                                                                                           
       95 +    fetchAvailability();                                                                                   
       96 +  }, [selectedDate, member.id]);                                                                           
       97 +                                                                                                           
       98    const handleTimeSelect = (time: string) => {
       99      setSelectedTime(time);
      100      if (selectedDate) {
     ...
      181            {/* Calendar grid */}
      182            <div className="grid grid-cols-7 gap-1">
      183              {calendarDays.map((day, index) => {
      157 -              if (!day) {                                                                                  
      158 -                return <div key={`empty-${index}`} />;                                                     
      159 -              }                                                                                            
      184 +              if (!day) return <div key={`empty-${index}`} />;                                             
      185  
      186                const available = isDateAvailable(day);
      187                const selected = selectedDate && isSameDay(day, selectedDate);
     ...
      190                return (
      191                  <button
      192                    key={day.toISOString()}
      168 -                  onClick={() => available && setSelectedDate(day)}                                        
      193 +                  onClick={() => {                                                                         
      194 +                    if (available) {                                                                       
      195 +                      setSelectedDate(day);                                                                
      196 +                      setSelectedTime(null);                                                               
      197 +                    }                                                                                      
      198 +                  }}                                                                                       
      199                    disabled={!available}
      200                    className={`
      201                      relative h-10 w-full rounded-full text-sm font-medium transition-all
     ...
      226            <h4 className="text-sm font-semibold text-foreground">
      227              {format(selectedDate, "EEE, MMM d")}
      228            </h4>
      199 -          <div className="space-y-2">                                                                      
      200 -            {AVAILABLE_TIMES.map((time) => (                                                               
      201 -              <Button                                                                                      
      202 -                key={time}                                                                                 
      203 -                variant={selectedTime === time ? "booking-time-selected" : "booking-time"}                 
      204 -                size="sm"                                                                                  
      205 -                onClick={() => handleTimeSelect(time)}                                                     
      206 -                className="text-sm"                                                                        
      207 -              >                                                                                            
      208 -                {time}                                                                                     
      209 -              </Button>                                                                                    
      210 -            ))}                                                                                            
      211 -          </div>                                                                                           
      229 +          {loadingTimes ? (                                                                                
      230 +            <p className="text-sm text-muted-foreground">Loading...</p>                                    
      231 +          ) : availableTimes.length === 0 ? (                                                              
      232 +            <p className="text-sm text-muted-foreground">No available times.</p>                           
      233 +          ) : (                                                                                            
      234 +            <div className="space-y-2">                                                                    
      235 +              {availableTimes.map((time) => (                                                              
      236 +                <Button                                                                                    
      237 +                  key={time}                                                                               
      238 +                  variant={selectedTime === time ? "booking-time-selected" : "booking-time"}               
      239 +                  size="sm"                                                                                
      240 +                  onClick={() => handleTimeSelect(time)}                                                   
      241 +                  className="text-sm"                                                                      
      242 +                >                                                                                          
      243 +                  {time}                                                                                   
      244 +                </Button>                                                                                  
      245 +              ))}                                                                                          
      246 +            </div>                                                                                         
      247 +          )}                                                                                               
      248          </div>
      249        )}
      250      </div>

⏺ Bash(git add src/components/booking/DateTimePicker.tsx && git commit -m "Wire DateTimePicker to get-availability edge
      function" && git push origin main)
  ⎿  Error: Exit code 1
     [main f5a47c0] Wire DateTimePicker to get-availability edge function
      Committer: Sarrah Renfro <sarrahrenfro@Sarrahs-Air.local>
     Your name and email address were configured automatically based
     on your username and hostname. Please check that they are accurate.
     You can suppress this message by setting them explicitly. Run the
     following command and follow the instructions in your editor to edit
     your configuration file:

         git config --global --edit
     … +14 lines (ctrl+o to see all)

⏺ Bash(git pull --rebase origin main && git push origin main)
  ⎿  From https://github.com/sarenfro/team-sync-hub
      * branch            main       -> FETCH_HEAD
        e24ba13..bcea1f9  main       -> origin/main
     … +3 lines (ctrl+o to expand)

⏺ Pushed. Since this is a frontend change, Lovable should pick it up — go ahead and publish through Lovable now.

  This was the root cause: the time slots were never fetched from the calendar, just hardcoded. After publishing, select
  Sarrah and a date — it will show a "Loading..." state briefly, then only her actual free slots.

✻ Worked for 1m 28s

❯ still shows the same                                                                                                       

⏺ Did you publish through Lovable after I pushed? The GitHub push doesn't trigger Lovable to redeploy — you need to paste the
   updated code into Lovable's code editor like we did with the edge function.

  Go to Lovable → Code → src/components/booking/DateTimePicker.tsx, replace all the code with what I wrote, then publish.

❯ can you give me the code to paste                                                                                          

  Read 1 file (ctrl+o to expand)

⏺ Here it is:

  import { useState, useMemo, useEffect } from "react";
  import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameDay,
    isToday,
    isBefore,
    startOfDay,
    getDay,
  } from "date-fns";
  import { ChevronLeft, ChevronRight, Globe } from "lucide-react";
  import { Button } from "@/components/ui/button";
  import { supabase } from "@/integrations/supabase/client";
  import type { TeamMember } from "./TeamMemberSelect";

  interface DateTimePickerProps {
    member: TeamMember;
    onSelect: (date: Date, time: string) => void;
    onBack: () => void;
  }

  const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const DateTimePicker = ({ member, onSelect, onBack }: DateTimePickerProps) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [availableTimes, setAvailableTimes] = useState<string[]>([]);
    const [loadingTimes, setLoadingTimes] = useState(false);

    const calendarDays = useMemo(() => {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      const days = eachDayOfInterval({ start, end });
      const startDay = getDay(start);
      const paddingDays: (Date | null)[] = Array.from({ length: startDay }, () => null);
      return [...paddingDays, ...days];
    }, [currentMonth]);

    const isDateAvailable = (date: Date) => {
      const day = getDay(date);
      return day !== 0 && day !== 6 && !isBefore(date, startOfDay(new Date()));
    };

    useEffect(() => {
      if (!selectedDate) return;

      const fetchAvailability = async () => {
        setLoadingTimes(true);
        setAvailableTimes([]);

        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const memberId = member.id === "all" ? null : member.id;

        try {
          const params = new URLSearchParams({ date: dateStr });
          if (memberId) params.set("member_id", memberId);

          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-availability?${params.toString()}`,
            {
              headers: {
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
            }
          );

          if (res.ok) {
            const json = await res.json();
            setAvailableTimes(json.available_times ?? []);
          } else {
            console.error("Failed to fetch availability:", await res.text());
            setAvailableTimes([]);
          }
        } catch (err) {
          console.error("Availability fetch error:", err);
          setAvailableTimes([]);
        } finally {
          setLoadingTimes(false);
        }
      };

      fetchAvailability();
    }, [selectedDate, member.id]);

    const handleTimeSelect = (time: string) => {
      setSelectedTime(time);
      if (selectedDate) {
        onSelect(selectedDate, time);
      }
    };

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return (
      <div className="flex flex-col lg:flex-row gap-0 rounded-xl border border-border bg-card overflow-hidden">
        {/* Left panel - Member info */}
        <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-border p-6 space-y-4">
          <button
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{member.name}</p>
            <h2 className="text-xl font-bold text-foreground">30 Minute Meeting</h2>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-muted">
              🕐
            </span>
            30 min
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-muted">
              📹
            </span>
            Web conferencing details provided upon confirmation.
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{timezone}</span>
          </div>
        </div>

        {/* Center panel - Calendar */}
        <div className="flex-1 p-6 border-b lg:border-b-0">
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Select a Date & Time</h3>

            {/* Month navigation */}
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-foreground">
                {format(currentMonth, "MMMM yyyy")}
              </h4>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1">
              {DAY_NAMES.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} />;

                const available = isDateAvailable(day);
                const selected = selectedDate && isSameDay(day, selectedDate);
                const today = isToday(day);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => {
                      if (available) {
                        setSelectedDate(day);
                        setSelectedTime(null);
                      }
                    }}
                    disabled={!available}
                    className={`
                      relative h-10 w-full rounded-full text-sm font-medium transition-all
                      ${
                        selected
                          ? "bg-booking-selected text-booking-selected-foreground"
                          : available
                            ? "text-foreground hover:bg-booking-hover"
                            : "text-muted-foreground/40 cursor-not-allowed"
                      }
                      ${today && !selected ? "font-bold" : ""}
                    `}
                  >
                    {format(day, "d")}
                    {today && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-booking-hero" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right panel - Time slots */}
        {selectedDate && (
          <div className="w-full lg:w-48 p-6 space-y-3 max-h-[400px] overflow-y-auto">
            <h4 className="text-sm font-semibold text-foreground">
              {format(selectedDate, "EEE, MMM d")}
            </h4>
            {loadingTimes ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : availableTimes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No available times.</p>
            ) : (
              <div className="space-y-2">
                {availableTimes.map((time) => (
                  <Button
                    key={time}
                    variant={selectedTime === time ? "booking-time-selected" : "booking-time"}
                    size="sm"
                    onClick={() => handleTimeSelect(time)}
                    className="text-sm"
                  >
                    {time}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  export default DateTimePicker;
