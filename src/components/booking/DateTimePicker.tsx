import { useState, useMemo } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
  getDay,
  addDays,
} from "date-fns";
import { ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TeamMember } from "./TeamMemberSelect";

interface DateTimePickerProps {
  member: TeamMember;
  onSelect: (date: Date, time: string) => void;
  onBack: () => void;
}

const AVAILABLE_TIMES = [
  "9:00am",
  "9:30am",
  "10:00am",
  "10:30am",
  "11:00am",
  "11:30am",
  "1:00pm",
  "1:30pm",
  "2:00pm",
  "2:30pm",
  "3:00pm",
  "3:30pm",
  "4:00pm",
  "4:30pm",
];

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const DateTimePicker = ({ member, onSelect, onBack }: DateTimePickerProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    const startDay = getDay(start);

    // Add padding days from previous month
    const paddingDays: (Date | null)[] = Array.from(
      { length: startDay },
      () => null
    );

    return [...paddingDays, ...days];
  }, [currentMonth]);

  const isDateAvailable = (date: Date) => {
    const day = getDay(date);
    return day !== 0 && day !== 6 && !isBefore(date, startOfDay(new Date()));
  };

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
              if (!day) {
                return <div key={`empty-${index}`} />;
              }

              const available = isDateAvailable(day);
              const selected = selectedDate && isSameDay(day, selectedDate);
              const today = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => available && setSelectedDate(day)}
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
          <div className="space-y-2">
            {AVAILABLE_TIMES.map((time) => (
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
        </div>
      )}
    </div>
  );
};

export default DateTimePicker;
