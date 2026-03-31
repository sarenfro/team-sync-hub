import { Clock, Video, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  calendarType: "google" | "outlook";
  colorIndex: number;
}

interface TeamMemberSelectProps {
  members: TeamMember[];
  onSelect: (member: TeamMember) => void;
  onSelectAll: () => void;
}

const avatarColors = [
  "bg-booking-avatar-1",
  "bg-booking-avatar-2",
  "bg-booking-avatar-3",
  "bg-booking-avatar-4",
];

const TeamMemberSelect = ({ members, onSelect, onSelectAll }: TeamMemberSelectProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Meet Our Team</h2>
        <p className="text-muted-foreground">
          Choose a team member to schedule a meeting with
        </p>
      </div>

      {/* Book with entire team button */}
      <button
        onClick={onSelectAll}
        className="group relative flex w-full items-center gap-4 rounded-xl border-2 border-booking-hero bg-booking-hero-light p-5 transition-all hover:shadow-lg hover:shadow-booking-hero/10"
      >
        <div className="flex -space-x-3">
          {members.map((member) => (
            <div
              key={member.id}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-primary-foreground ring-2 ring-background ${avatarColors[member.colorIndex % avatarColors.length]}`}
            >
              {member.name.split(" ").map((n) => n[0]).join("")}
            </div>
          ))}
        </div>
        <div className="text-left flex-1">
          <h3 className="font-semibold text-foreground group-hover:text-booking-hero transition-colors">
            Meet with Any Team Member
          </h3>
          <p className="text-sm text-muted-foreground">
            Book the next available slot across all {members.length} members
          </p>
        </div>
        <Users className="h-5 w-5 text-booking-hero" />
      </button>

      <div className="grid gap-4 sm:grid-cols-2">
        {members.map((member) => (
          <button
            key={member.id}
            onClick={() => onSelect(member)}
            className="group relative flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-left transition-all hover:border-booking-hero hover:shadow-lg hover:shadow-booking-hero/5"
          >
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-primary-foreground ${avatarColors[member.colorIndex % avatarColors.length]}`}
            >
              {member.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-semibold text-foreground group-hover:text-booking-hero transition-colors">
                {member.name}
              </h3>
              <p className="text-sm text-muted-foreground">{member.role}</p>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> 30 min
              </span>
              <span className="flex items-center gap-1">
                <Video className="h-3 w-3" /> Video call
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TeamMemberSelect;
