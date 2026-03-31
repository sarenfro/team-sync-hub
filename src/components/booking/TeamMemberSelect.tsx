import { Clock, Video } from "lucide-react";

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
}

const avatarColors = [
  "bg-booking-avatar-1",
  "bg-booking-avatar-2",
  "bg-booking-avatar-3",
  "bg-booking-avatar-4",
];

const TeamMemberSelect = ({ members, onSelect }: TeamMemberSelectProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Meet Our Team</h2>
        <p className="text-muted-foreground">
          Choose a team member to schedule a meeting with
        </p>
      </div>

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
