import { useState } from "react";
import BookingHeader from "@/components/booking/BookingHeader";
import TeamMemberSelect, {
  type TeamMember,
} from "@/components/booking/TeamMemberSelect";
import DateTimePicker from "@/components/booking/DateTimePicker";
import BookingForm from "@/components/booking/BookingForm";
import BookingConfirmation from "@/components/booking/BookingConfirmation";

const TEAM_MEMBERS: TeamMember[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    role: "Team Lead",
    calendarType: "google",
    colorIndex: 0,
  },
  {
    id: "2",
    name: "Marcus Chen",
    role: "Senior Developer",
    calendarType: "outlook",
    colorIndex: 1,
  },
  {
    id: "3",
    name: "Priya Patel",
    role: "Product Manager",
    calendarType: "outlook",
    colorIndex: 2,
  },
  {
    id: "4",
    name: "Alex Rivera",
    role: "Design Lead",
    calendarType: "outlook",
    colorIndex: 3,
  },
];

type Step = "select-member" | "select-datetime" | "enter-details" | "confirmed";

const ALL_TEAM_MEMBER: TeamMember = {
  id: "all",
  name: "Any Team Member",
  role: "Next Available",
  calendarType: "google",
  colorIndex: 0,
};

const Index = () => {
  const [step, setStep] = useState<Step>("select-member");
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookerName, setBookerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);
    setBookerName(data.name);
    // Simulate API call — will be replaced with real calendar integration
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    setStep("confirmed");
  };

  const handleReset = () => {
    setStep("select-member");
    setSelectedMember(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setBookerName("");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <BookingHeader teamName="Book a Meeting" />

        <div className="mt-6">
          {step === "select-member" && (
            <TeamMemberSelect
              members={TEAM_MEMBERS}
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
                onReset={handleReset}
              />
            )}
        </div>

        {/* Powered by footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by Team Scheduler
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
