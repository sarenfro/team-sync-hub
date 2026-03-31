import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import TeamMemberSelect, {
  type TeamMember,
} from "@/components/booking/TeamMemberSelect";
import DateTimePicker from "@/components/booking/DateTimePicker";
import BookingForm from "@/components/booking/BookingForm";
import BookingConfirmation from "@/components/booking/BookingConfirmation";

type Step = "select-member" | "select-datetime" | "enter-details" | "confirmed";

const ALL_TEAM_MEMBER: TeamMember = {
  id: "all",
  name: "Any Team Member",
  role: "Next Available",
  calendarType: "google",
  colorIndex: 0,
};

const Embed = () => {
  const [step, setStep] = useState<Step>("select-member");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookerName, setBookerName] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from("team_members")
        .select("*")
        .eq("is_active", true)
        .order("color_index");
      if (data) {
        setMembers(
          data.map((m) => ({
            id: m.id,
            name: m.name,
            role: m.role ?? "",
            calendarType: m.calendar_type as "google" | "outlook",
            colorIndex: m.color_index,
          }))
        );
      }
    };
    fetchMembers();
  }, []);

  const handleMemberSelect = (member: TeamMember) => {
    setSelectedMember(member);
    setStep("select-datetime");
  };

  const handleSelectAll = () => {
    setSelectedMember(ALL_TEAM_MEMBER);
    setStep("select-datetime");
  };

  const handleDateTimeSelect = (date: Date, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setStep("enter-details");
  };

  const handleFormSubmit = async (data: {
    name: string;
    email: string;
    notes: string;
  }) => {
    setBookerName(data.name);
    setBookerEmail(data.email);

    try {
      const memberId =
        selectedMember?.id === "all" ? null : selectedMember?.id;

      // Insert booking into database
      await supabase.from("bookings").insert({
        team_member_id: memberId,
        booker_name: data.name,
        booker_email: data.email,
        notes: data.notes || null,
        meeting_date: selectedDate!.toISOString().split("T")[0],
        meeting_time: selectedTime!,
        duration_minutes: 30,
      });

      // Call edge function to create calendar event
      await supabase.functions.invoke("create-booking", {
        body: {
          team_member_id: memberId,
          booker_name: data.name,
          booker_email: data.email,
          notes: data.notes,
          meeting_date: selectedDate!.toISOString().split("T")[0],
          meeting_time: selectedTime!,
          duration_minutes: 30,
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
    setSelectedMember(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setBookerName("");
    setBookerEmail("");
  };

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="mx-auto max-w-4xl">
        {step === "select-member" && (
          <TeamMemberSelect
            members={members}
            onSelect={handleMemberSelect}
            onSelectAll={handleSelectAll}
          />
        )}

        {step === "select-datetime" && selectedMember && (
          <DateTimePicker
            member={selectedMember}
            onSelect={handleDateTimeSelect}
            onBack={() => setStep("select-member")}
          />
        )}

        {step === "enter-details" &&
          selectedMember &&
          selectedDate &&
          selectedTime && (
            <BookingForm
              member={selectedMember}
              date={selectedDate}
              time={selectedTime}
              onSubmit={handleFormSubmit}
              onBack={() => setStep("select-datetime")}
              isSubmitting={isSubmitting}
            />
          )}

        {step === "confirmed" &&
          selectedMember &&
          selectedDate &&
          selectedTime && (
            <BookingConfirmation
              member={selectedMember}
              date={selectedDate}
              time={selectedTime}
              bookerName={bookerName}
              bookerEmail={bookerEmail}
              onReset={handleReset}
            />
          )}
      </div>
    </div>
  );
};

export default Embed;
