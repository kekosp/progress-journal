import { MaintenanceCalendar } from '@/components/MaintenanceCalendar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NavLink } from '@/components/NavLink';
import { CalendarDays, ClipboardList } from 'lucide-react';

const CalendarPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-lg font-bold tracking-tight">Maintenance Calendar</h1>
              <p className="text-xs opacity-80">Plan & schedule maintenance activities</p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="px-4 py-4 max-w-lg mx-auto">
        <MaintenanceCalendar />
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-card border-t border-border px-4 py-2 z-20">
        <div className="max-w-lg mx-auto flex justify-around">
          <NavLink
            to="/"
            className="flex flex-col items-center gap-0.5 text-muted-foreground transition-colors"
            activeClassName="text-primary"
          >
            <ClipboardList className="w-5 h-5" />
            <span className="text-[10px] font-medium">Reports</span>
          </NavLink>
          <NavLink
            to="/calendar"
            className="flex flex-col items-center gap-0.5 text-muted-foreground transition-colors"
            activeClassName="text-primary"
          >
            <CalendarDays className="w-5 h-5" />
            <span className="text-[10px] font-medium">Calendar</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
};

export default CalendarPage;
