import { useState, useEffect, useMemo } from "react";
import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks, getDay } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BusyBlock {
  member_id: string;
  member_name: string;
  color_index: number;
  time: string;
  source: "booking" | "ical";
  title?: string;
}

interface ScheduleMember {
  id: string;
  name: string;
  color_index: number;
}

const SLOT_TIMES = [
  "9:00am", "9:30am", "10:00am", "10:30am",
  "11:00am", "11:30am", "12:00pm", "12:30pm",
  "1:00pm", "1:30pm", "2:00pm", "2:30pm",
  "3:00pm", "3:30pm", "4:00pm", "4:30pm",
];

const AVATAR_COLORS = [
  "hsl(214, 100%, 50%)",
  "hsl(262, 80%, 55%)",
  "hsl(340, 75%, 55%)",
  "hsl(25, 90%, 55%)",
];

const AVATAR_BG_CLASSES = [
  "bg-booking-avatar-1",
  "bg-booking-avatar-2",
  "bg-booking-avatar-3",
  "bg-booking-avatar-4",
];

function getColor(colorIndex: number) {
  return AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
}

function getBgClass(colorIndex: number) {
  return AVATAR_BG_CLASSES[colorIndex % AVATAR_BG_CLASSES.length];
}

interface ScheduleViewProps {
  onBack: () => void;
}

type ViewMode = "daily" | "weekly";

const ScheduleView = ({ onBack }: ScheduleViewProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [blocks, setBlocks] = useState<BusyBlock[]>([]);
  const [members, setMembers] = useState<ScheduleMember[]>([]);
  const [loading, setLoading] = useState(false);

  // For weekly view, get Monday-Friday dates
  const weekDates = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
    return Array.from({ length: 5 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const datesToFetch = viewMode === "daily" ? [currentDate] : weekDates;

  useEffect(() => {
    const fetchSchedule = async () => {
      setLoading(true);
      try {
        const allBlocks: BusyBlock[] = [];
        let fetchedMembers: ScheduleMember[] = [];

        const results = await Promise.all(
          datesToFetch.map(async (d) => {
            const dateStr = format(d, "yyyy-MM-dd");
            const params = new URLSearchParams({ date: dateStr });
            const res = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-schedule?${params.toString()}`,
              {
                headers: {
                  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                },
              }
            );
            if (!res.ok) return { blocks: [], members: [], date: dateStr };
            const json = await res.json();
            return { blocks: json.blocks ?? [], members: json.members ?? [], date: dateStr };
          })
        );

        for (const r of results) {
          for (const b of r.blocks) {
            allBlocks.push({ ...b, _date: r.date } as BusyBlock & { _date: string });
          }
          if (r.members.length > 0) fetchedMembers = r.members;
        }

        setBlocks(allBlocks);
        setMembers(fetchedMembers);
      } catch (err) {
        console.error("Schedule fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [currentDate, viewMode]);

  const navigate = (direction: number) => {
    if (viewMode === "daily") {
      setCurrentDate((d) => (direction > 0 ? addDays(d, 1) : subDays(d, 1)));
    } else {
      setCurrentDate((d) => (direction > 0 ? addWeeks(d, 1) : subWeeks(d, 1)));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  const headerLabel =
    viewMode === "daily"
      ? format(currentDate, "EEEE, MMMM d, yyyy")
      : `${format(weekDates[0], "MMM d")} – ${format(weekDates[4], "MMM d, yyyy")}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Booking
        </button>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <div className="flex border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode("daily")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1 ${
                viewMode === "daily"
                  ? "bg-booking-hero text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" /> Day
            </button>
            <button
              onClick={() => setViewMode("weekly")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1 ${
                viewMode === "weekly"
                  ? "bg-booking-hero text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Week
            </button>
          </div>
        </div>
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-lg font-semibold text-foreground min-w-[240px] text-center">{headerLabel}</h3>
        <button
          onClick={() => navigate(1)}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 justify-center">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-1.5 text-sm">
            <div
              className={`h-3 w-3 rounded-full ${getBgClass(m.color_index)}`}
            />
            <span className="text-foreground">{m.name.split(" ")[0]}</span>
          </div>
        ))}
      </div>

      {/* Schedule grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading schedule...</div>
      ) : viewMode === "daily" ? (
        <DailyGrid
          date={currentDate}
          blocks={blocks}
          members={members}
        />
      ) : (
        <WeeklyGrid
          weekDates={weekDates}
          blocks={blocks as (BusyBlock & { _date?: string })[]}
          members={members}
        />
      )}

      <div className="text-center text-xs text-muted-foreground">
        All times in Pacific Time (PT)
      </div>
    </div>
  );
};

// ---- Daily Grid ----

function DailyGrid({
  date,
  blocks,
  members,
}: {
  date: Date;
  blocks: BusyBlock[];
  members: ScheduleMember[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header row with member names */}
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `80px repeat(${members.length}, 1fr)` }}>
        <div className="p-2 text-xs font-medium text-muted-foreground border-r border-border" />
        {members.map((m) => (
          <div key={m.id} className="p-2 text-center border-r border-border last:border-r-0">
            <div
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-primary-foreground ${getBgClass(m.color_index)}`}
            >
              {m.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{m.name.split(" ")[0]}</p>
          </div>
        ))}
      </div>

      {/* Time rows */}
      {SLOT_TIMES.map((time) => (
        <div
          key={time}
          className="grid border-b border-border last:border-b-0"
          style={{ gridTemplateColumns: `80px repeat(${members.length}, 1fr)` }}
        >
          <div className="p-2 text-xs text-muted-foreground border-r border-border flex items-center justify-end pr-3">
            {time}
          </div>
          {members.map((m) => {
            const block = blocks.find((b) => b.member_id === m.id && b.time === time);
            return (
              <div
                key={m.id}
                className="p-1 border-r border-border last:border-r-0 min-h-[40px] flex items-center justify-center"
              >
                {block && (
                  <div
                    className="w-full rounded px-2 py-1 text-xs font-medium truncate"
                    style={{
                      backgroundColor: `${getColor(m.color_index)}20`,
                      color: getColor(m.color_index),
                      borderLeft: `3px solid ${getColor(m.color_index)}`,
                    }}
                    title={block.title}
                  >
                    {block.title ?? "Busy"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---- Weekly Grid ----

function WeeklyGrid({
  weekDates,
  blocks,
  members,
}: {
  weekDates: Date[];
  blocks: (BusyBlock & { _date?: string })[];
  members: ScheduleMember[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Header row with day names */}
        <div className="grid border-b border-border" style={{ gridTemplateColumns: `80px repeat(5, 1fr)` }}>
          <div className="p-2 text-xs font-medium text-muted-foreground border-r border-border" />
          {weekDates.map((d) => (
            <div key={d.toISOString()} className="p-2 text-center border-r border-border last:border-r-0">
              <p className="text-xs font-medium text-muted-foreground">{format(d, "EEE")}</p>
              <p className="text-sm font-semibold text-foreground">{format(d, "d")}</p>
            </div>
          ))}
        </div>

        {/* Time rows */}
        {SLOT_TIMES.map((time) => (
          <div
            key={time}
            className="grid border-b border-border last:border-b-0"
            style={{ gridTemplateColumns: `80px repeat(5, 1fr)` }}
          >
            <div className="p-1 text-xs text-muted-foreground border-r border-border flex items-center justify-end pr-2">
              {time}
            </div>
            {weekDates.map((d) => {
              const dateStr = format(d, "yyyy-MM-dd");
              const dayBlocks = blocks.filter(
                (b) => (b as any)._date === dateStr && b.time === time
              );
              return (
                <div
                  key={d.toISOString()}
                  className="p-0.5 border-r border-border last:border-r-0 min-h-[36px]"
                >
                  <div className="flex gap-0.5 flex-wrap">
                    {dayBlocks.map((b, i) => (
                      <div
                        key={`${b.member_id}-${i}`}
                        className="rounded px-1 py-0.5 text-[10px] font-medium truncate flex-1 min-w-0"
                        style={{
                          backgroundColor: `${getColor(b.color_index)}20`,
                          color: getColor(b.color_index),
                          borderLeft: `2px solid ${getColor(b.color_index)}`,
                        }}
                        title={`${b.member_name}: ${b.title ?? "Busy"}`}
                      >
                        {b.member_name.split(" ")[0][0]}{b.member_name.split(" ").length > 1 ? b.member_name.split(" ")[1][0] : ""}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ScheduleView;
