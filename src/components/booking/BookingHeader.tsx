import { Calendar, Home } from "lucide-react";

interface BookingHeaderProps {
  teamName?: string;
  showHome?: boolean;
  onHome?: () => void;
}

const BookingHeader = ({ teamName = "Our Team", showHome = false, onHome }: BookingHeaderProps) => {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-booking-hero">
          <Calendar className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold text-foreground">{teamName}</span>
      </div>
      {showHome && (
        <button
          onClick={onHome}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Home className="h-4 w-4" /> Home
        </button>
      )}
    </div>
  );
};

export default BookingHeader;
