import { NavLink } from "react-router-dom";
import {
  Activity,
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  User2,
  Wrench,
  LogOut,
  Menu,
  X,
  FlaskConical,
  TestTube
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { NotificationBell } from "../ui/NotificationBell";
import { NiraLogo, NiraLogoMini } from "../ui/NiraLogo";
import { ProfileAvatar } from "../ui/ProfileAvatar";
import { cn } from "../../lib/utils";
import { useDemoData } from "../../app/DemoDataProvider";
import { getCurrentProfile } from "../../features/shared/selectors";

function getProfilePath(role) {
  if (!role) {
    return "/auth";
  }

  return `/${role}/profile`;
}

function getNavLinks(role) {
  if (role === "patient") {
    return [
      { to: "/patient", label: "Home", icon: Activity },
      { to: "/patient/appointments", label: "Appointments", icon: ClipboardList },
      { to: "/patient/booking", label: "Booking", icon: CalendarClock },
      { to: "/patient/prescriptions", label: "Prescriptions", icon: ShieldCheck },
      { to: "/patient/tests", label: "Tests", icon: TestTube },
      { to: "/patient/lab-reports", label: "Lab Reports", icon: FlaskConical },
      { to: "/patient/profile", label: "Profile", icon: User2 }
    ];
  }

  if (role === "doctor") {
    return [
      { to: "/doctor", label: "Dashboard", icon: LayoutDashboard },
      { to: "/doctor/availability", label: "Availability", icon: CalendarClock },
      { to: "/doctor/lab-reports", label: "Lab Reports", icon: FlaskConical },
      { to: "/doctor/tools", label: "AI Assist", icon: Wrench },
      { to: "/doctor/profile", label: "Profile", icon: User2 }
    ];
  }

  if (role === "nurse") {
    return [
      { to: "/nurse", label: "Dashboard", icon: LayoutDashboard },
      { to: "/nurse/tools", label: "AI Assist", icon: Wrench },
      { to: "/nurse/profile", label: "Profile", icon: User2 }
    ];
  }

  if (role === "admin") {
    return [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { to: "/admin/admins", label: "Admins", icon: ShieldCheck },
      { to: "/admin/doctors", label: "Doctors", icon: Activity },
      { to: "/admin/appointments", label: "Appointments", icon: CalendarClock },
      { to: "/admin/patients", label: "Patients", icon: User2 },
      { to: "/admin/profile", label: "Profile", icon: User2 }
    ];
  }

  return [{ to: "/auth", label: "Auth", icon: Sparkles }];
}

export function AppShell({ title, subtitle, actions, children }) {
  const { state, actions: appActions } = useDemoData();
  const profile = state ? getCurrentProfile(state) : null;
  const role = state?.session?.role || null;
  const profilePath = getProfilePath(role);
  const isDoctor = role === "doctor";
  const navLinks = getNavLinks(role);
  const [mobileOpen, setMobileOpen] = useState(false);
  const notifications = useMemo(() => {
    const all = (state?.notifications?.allIds || []).map((id) => state.notifications.byId[id]).filter(Boolean);
    const sessionUserId = state?.session?.userId;
    if (!sessionUserId) {
      return all.sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));
    }
    return all
      .filter((n) => n.userId === sessionUserId)
      .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));
  }, [state?.notifications, state?.session?.userId]);

  useEffect(() => {
    if (!state?.session?.isAuthenticated) {
      setMobileOpen(false);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      appActions.refresh();
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [appActions, state?.session?.isAuthenticated]);

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onEscape = (event) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", onEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [mobileOpen]);

  return (
    <div className="app-shell min-h-screen">
      <div className="app-shell-ambient" aria-hidden>
        <div className="app-shell-orb orb-one" />
        <div className="app-shell-orb orb-two" />
        <div className="app-shell-orb orb-three" />
      </div>
      {/* Top navigation bar */}
      <header className="sticky top-0 z-40 border-b border-line/50 backdrop-blur-2xl" style={{ background: "rgba(248,249,252,0.85)" }}>
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 px-3 py-3 sm:px-6 lg:px-8">
          {/* Logo */}
          <NavLink to="/" className="flex items-center">
            <NiraLogo className="h-9" />
          </NavLink>

          <div aria-hidden className="hidden lg:block" />

          {/* Right section */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Notifications bell */}
            {state?.session?.isAuthenticated ? (
              <NotificationBell
                notifications={notifications}
                role={role}
                onMarkAsRead={(notificationId) => appActions.notifications.markAsRead(notificationId)}
              />
            ) : null}

            {/* Profile chip */}
            {profile ? (
              <NavLink
                to={profilePath}
                className="hidden items-center gap-2 rounded-xl border border-line/50 bg-white/60 px-3 py-1.5 transition hover:bg-white md:flex"
                title="Go to profile"
              >
                <ProfileAvatar
                  name={profile.fullName}
                  photo={profile.profilePhoto}
                  size="sm"
                  tone="solid"
                />
                <span className="text-[12px] font-semibold text-ink">{profile.fullName}</span>
              </NavLink>
            ) : null}

            {/* Logout */}
            {state?.session?.isAuthenticated ? (
              isDoctor ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => appActions.auth.logout()}
                  className="hidden rounded-full px-4 lg:inline-flex"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              ) : (
                <button
                  onClick={() => appActions.auth.logout()}
                  className="hidden h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-muted transition hover:bg-red-50 hover:text-brand-coral sm:flex"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )
            ) : null}

            {/* Mobile toggle */}
            {state?.session?.isAuthenticated ? (
              <button
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-ink sm:h-10 sm:w-10"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            ) : null}
          </div>
        </div>

        {/* Mobile side drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px]"
                onClick={() => setMobileOpen(false)}
                aria-label="Close side menu backdrop"
              />

              <motion.aside
                initial={{ x: "-100%", opacity: 0.6 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "-100%", opacity: 0.6 }}
                transition={{ type: "spring", stiffness: 340, damping: 34, mass: 0.9 }}
                className="fixed left-0 top-0 z-50 flex h-dvh w-[min(86vw,340px)] flex-col border-r border-line/40 bg-[linear-gradient(180deg,rgba(248,250,255,0.98),rgba(239,245,252,0.98))] shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-label="Mobile navigation"
              >
                <div className="flex items-center justify-between border-b border-line/40 px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <NiraLogoMini className="h-8" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Menu</div>
                      <div className="text-sm font-semibold text-ink">Quick navigation</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-ink transition hover:bg-white"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Close side menu"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {profile ? (
                    <NavLink to={profilePath} onClick={() => setMobileOpen(false)} className="mb-4 flex items-center gap-2.5 rounded-xl border border-line/50 bg-white/70 px-3 py-2.5 transition hover:bg-white" title="Go to profile">
                      <ProfileAvatar
                        name={profile.fullName}
                        photo={profile.profilePhoto}
                        size="sm"
                        tone="solid"
                        className="h-7 w-7 text-[11px]"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink">{profile.fullName}</div>
                        <div className="text-[11px] capitalize text-muted">{state?.session?.role || "user"}</div>
                      </div>
                    </NavLink>
                  ) : null}

                  <nav className="space-y-1.5">
                    {navLinks.map((link) => (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.to.split("/").length <= 2}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition",
                            isActive
                              ? "bg-brand-midnight text-white shadow-md"
                              : "border border-transparent text-muted hover:border-line/60 hover:bg-white hover:text-ink"
                          )
                        }
                      >
                        <link.icon className="h-4 w-4" />
                        {link.label}
                      </NavLink>
                    ))}
                  </nav>
                </div>

                {state?.session?.isAuthenticated ? (
                  <div className="border-t border-line/40 p-4">
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-start border border-red-100 bg-red-50 text-brand-coral hover:bg-red-100"
                      onClick={() => {
                        setMobileOpen(false);
                        appActions.auth.logout();
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                ) : null}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </header>

      {/* Page content */}
      <div className="relative z-10 mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <main className="min-w-0 pb-28 sm:pb-24 lg:pb-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:gap-4"
          >
            <div>
              <div className="page-header-eyebrow mb-3">
                <Sparkles className="h-3 w-3" />
                {state?.session?.role ? `${state.session.role} workspace` : "NIRA Platform"}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl lg:text-4xl">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted sm:text-base">{subtitle}</p>
            </div>
            {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">{actions}</div> : null}
          </motion.div>
          {children}
        </main>
      </div>

    </div>
  );
}

export function FloatingAccent({ className }) {
  return (
    <div className={cn("pointer-events-none absolute -z-10 rounded-full bg-cyan-200/60 blur-3xl", className)} />
  );
}
