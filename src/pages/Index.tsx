import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import BookingHeader from "@/components/booking/BookingHeader";
import TeamMemberSelect, { type TeamMember } from "@/components/booking/TeamMemberSelect";
import DateTimePicker from "@/components/booking/DateTimePicker";
import BookingForm from "@/components/booking/BookingForm";
import BookingConfirmation from "@/components/booking/BookingConfirmation";
import ScheduleView from "@/components/booking/ScheduleView";
import { Calendar, CalendarCheck } from "lucide-react";

type Step = "select-member" | "select-datetime" | "enter-details" | "confirmed";
type PageView = "booking" | "schedule";
const Index = () => {
  const [pageView, setPageView] = useState<PageView>("booking");
  const [step, setStep] = useState<Step>("select-member");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<TeamMember[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookerName, setBookerName] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase.from("team_members").select("*").eq("is_active", true).order("color_index");
      if (data) {
        setMembers(
          data.map((m) => ({
            id: m.id,
            name: m.name,
            role: m.role ?? "",
            calendarType: m.calendar_type as "google" | "outlook",
            colorIndex: m.color_index,
            calendarId: m.calendar_id ?? undefined,
            zoomMeetingId: m.zoom_meeting_id ?? undefined,
            zoomPasscode: m.zoom_passcode ?? undefined,
            meetingDuration: m.meeting_duration ?? 30,
          })),
        );
      }
    };
    fetchMembers();
  }, []);

  const handleMemberToggle = (member: TeamMember) => {
    setSelectedMembers((prev) =>
      prev.some((m) => m.id === member.id) ? prev.filter((m) => m.id !== member.id) : [...prev, member],
    );
  };

  const handleSelectAll = () => {
    setSelectedMembers(members);
    setStep("select-datetime");
  };

  const handleConfirmSelection = () => {
    setStep("select-datetime");
  };

  const handleDateTimeSelect = (date: Date, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setStep("enter-details");
  };

  const handleFormSubmit = async (data: { name: string; email: string; notes: string }) => {
    setIsSubmitting(true);
    setBookerName(data.name);
    setBookerEmail(data.email);

    try {
      const effectiveDuration = Math.max(...selectedMembers.map((m) => m.meetingDuration));
      await supabase.functions.invoke("create-booking", {
        body: {
          team_member_ids: selectedMembers.map((m) => m.id),
          booker_name: data.name,
          booker_email: data.email,
          notes: data.notes,
          meeting_date: selectedDate!.toISOString().split("T")[0],
          meeting_time: selectedTime!,
          duration_minutes: effectiveDuration,
        },
      });

      setStep("confirmed");
    } catch (err) {
      console.error("Booking failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep("select-member");
    setSelectedMembers([]);
    setSelectedDate(null);
    setSelectedTime(null);
    setBookerName("");
    setBookerEmail("");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <BookingHeader teamName="Book a Meeting" />

        {/* View toggle tabs */}
        <div className="mt-4 flex justify-center">
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setPageView("booking")}
              className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                pageView === "booking"
                  ? "bg-booking-hero text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarCheck className="h-4 w-4" /> Book
            </button>
            <button
              onClick={() => setPageView("schedule")}
              className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                pageView === "schedule"
                  ? "bg-booking-hero text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="h-4 w-4" /> Schedule
            </button>
          </div>
        </div>

        <div className="mt-6">
          {pageView === "schedule" ? (
            <ScheduleView onBack={() => setPageView("booking")} />
          ) : (
            <>
              {step === "select-member" && (
                <TeamMemberSelect
                  members={members}
                  selectedIds={selectedMembers.map((m) => m.id)}
                  onToggle={handleMemberToggle}
                  onSelectAll={handleSelectAll}
                  onConfirm={handleConfirmSelection}
                />
              )}

              {step === "select-datetime" && selectedMembers.length > 0 && (
                <DateTimePicker
                  members={selectedMembers}
                  onSelect={handleDateTimeSelect}
                  onBack={() => setStep("select-member")}
                />
              )}

              {step === "enter-details" && selectedMembers.length > 0 && selectedDate && selectedTime && (
                <BookingForm
                  members={selectedMembers}
                  date={selectedDate}
                  time={selectedTime}
                  onSubmit={handleFormSubmit}
                  onBack={() => setStep("select-datetime")}
                  isSubmitting={isSubmitting}
                />
              )}

              {step === "confirmed" && selectedMembers.length > 0 && selectedDate && selectedTime && (
                <BookingConfirmation
                  members={selectedMembers}
                  date={selectedDate}
                  time={selectedTime}
                  bookerName={bookerName}
                  bookerEmail={bookerEmail}
                  onReset={handleReset}
                />
              )}
            </>
          )}
        </div>

        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground">Powered by Team Scheduler</p>
        </div>
      </div>
    </div>
  );
};

export default Index;

//redeploy
