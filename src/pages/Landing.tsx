import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users, Calendar, Lock } from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center space-y-10">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-foreground">MBAA EC Team Scheduling</h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Book meetings with the MBAA Executive Committee. Select a member and find a time that works.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5 text-left">
          <div className="space-y-2 p-5 rounded-xl border border-border">
            <Users className="h-6 w-6 text-booking-hero" />
            <h3 className="font-semibold text-foreground">Team Profiles</h3>
            <p className="text-sm text-muted-foreground">
              See all EC members and their available meeting times.
            </p>
          </div>
          <div className="space-y-2 p-5 rounded-xl border border-border">
            <Calendar className="h-6 w-6 text-booking-hero" />
            <h3 className="font-semibold text-foreground">Smart Scheduling</h3>
            <p className="text-sm text-muted-foreground">
              Real-time availability checks against each member's calendar.
            </p>
          </div>
          <div className="space-y-2 p-5 rounded-xl border border-border">
            <Lock className="h-6 w-6 text-booking-hero" />
            <h3 className="font-semibold text-foreground">Zoom Included</h3>
            <p className="text-sm text-muted-foreground">
              Every confirmed booking includes a Zoom link automatically.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="booking" size="lg">
            <Link to="/">Book a Meeting</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/auth">EC Member Login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Landing;
