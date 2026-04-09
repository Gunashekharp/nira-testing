import { NavLink } from "react-router-dom";
import {
  Activity,
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  Languages,
  ShieldCheck,
  Sparkles,
  User2
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { useDemoData } from "../../app/DemoDataProvider";
import { getCurrentProfile } from "../../features/shared/selectors";

function getNavLinks(role) {
  if (role === "patient") {
    return [
      { to: "/patient", label: "Home", icon: Activity },
      { to: "/patient/appointments", label: "Appointments", icon: ClipboardList },
      { to: "/patient/booking", label: "Booking", icon: CalendarClock },
      { to: "/patient/prescriptions", label: "Prescriptions", icon: ShieldCheck },
      { to: "/patient/profile", label: "Profile", icon: User2 }
    ];
  }

  if (role === "doctor") {
    return [
      { to: "/doctor", label: "Dashboard", icon: LayoutDashboard },
      { to: "/doctor/availability", label: "Availability", icon: CalendarClock },
      { to: "/doctor/profile", label: "Profile", icon: User2 }
    ];
  }

  if (role === "admin") {
    return [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { to: "/admin/doctors", label: "Doctors", icon: Activity },
      { to: "/admin/appointments", label: "Appointments", icon: CalendarClock },
      { to: "/admin/patients", label: "Patients", icon: User2 },
      { to: "/admin/profile", label: "Profile", icon: ShieldCheck }
    ];
  }

  return [{ to: "/auth", label: "Auth", icon: Sparkles }];
}

export function AppShell({ title, subtitle, actions, children, languageLabel = "English / Hindi" }) {
  const { state, actions: appActions } = useDemoData();
  const profile = state ? getCurrentProfile(state) : null;
  const navLinks = getNavLinks(state?.session?.role || null);

  return (
    <div className="min-h-screen bg-hero-glow">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-surface/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-midnight text-white shadow-soft">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-tide">NIRA MVP</div>
              <div className="text-lg font-semibold tracking-tight text-ink">
                Networked Intelligence for Real-time Ambulatory Care
              </div>
            </div>
          </div>

          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition duration-200",
                    isActive
                      ? "bg-brand-midnight text-white shadow-soft"
                      : "bg-white/80 text-ink shadow-soft hover:bg-white"
                  )
                }
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-2 text-sm font-medium text-muted shadow-soft md:flex">
              <Languages className="h-4 w-4 text-brand-tide" />
              {languageLabel}
            </div>
            {profile ? (
              <div className="hidden rounded-full border border-white/60 bg-white/70 px-4 py-2 text-sm font-semibold text-ink shadow-soft md:block">
                {profile.fullName}
              </div>
            ) : null}
            {state?.session?.isAuthenticated ? (
              <Button variant="secondary" size="sm" onClick={() => appActions.auth.logout()}>
                Logout
              </Button>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <div className="section-title">Frontend-Only Clinical Demo</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted sm:text-base">{subtitle}</p>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </motion.div>
        {children}
      </main>
    </div>
  );
}

export function FloatingAccent({ className }) {
  return (
    <div className={cn("pointer-events-none absolute -z-10 rounded-full bg-cyan-200/60 blur-3xl", className)} />
  );
}
