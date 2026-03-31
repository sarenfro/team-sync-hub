import { format } from "date-fns";
import { CheckCircle2, Calendar, Clock, User, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TeamMember } from "./TeamMemberSelect";

interface BookingConfirmationProps {
  member: TeamMember;
  date: Date;
  time: string;
  bookerName: string;
  onReset: () => void;
}

const BookingConfirmation = ({
  member,
  date,
  time,
  bookerName,
  onReset,
}: BookingConfirmationProps) => {
  return (
    <div className="max-w-lg mx-auto text-center space-y-8">
      <div className="space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-booking-success/10">
          <CheckCircle2 className="h-10 w-10 text-booking-success" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">You are scheduled</h2>
          <p className="text-muted-foreground">
            A calendar invitation has been sent to your email address.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 text-left space-y-4">
        <h3 className="font-semibold text-foreground">30 Minute Meeting</h3>

        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 flex-shrink-0 text-booking-hero" />
            <span>{member.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 flex-shrink-0 text-booking-hero" />
            <span>
              {format(date, "h:mm a")} - {format(date, "EEEE, MMMM d, yyyy")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 flex-shrink-0 text-booking-hero" />
            <span>{time} (30 minutes)</span>
          </div>
          <div className="flex items-center gap-3">
            <Video className="h-4 w-4 flex-shrink-0 text-booking-hero" />
            <span>Web conferencing details in your calendar invite</span>
          </div>
        </div>
      </div>

      <Button variant="booking-outline" onClick={onReset}>
        Schedule another meeting
      </Button>
    </div>
  );
};

export default BookingConfirmation;
