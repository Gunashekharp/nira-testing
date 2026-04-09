import { Link } from "react-router-dom";
import { ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import { AppShell, FloatingAccent } from "../../components/layout/AppShell";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { useDemoData } from "../../app/DemoDataProvider";
import { hasAdminAccount } from "../shared/selectors";

const roles = [
  {
    role: "patient",
    icon: UserRound,
    title: "Patient access",
    description: "Book visits, complete the AI interview, manage profile details, and revisit prescriptions."
  },
  {
    role: "doctor",
    icon: Stethoscope,
    title: "Doctor access",
    description: "Review the queue, edit APCI drafts, manage availability, and approve prescriptions."
  },
  {
    role: "admin",
    icon: ShieldCheck,
    title: "Admin access",
    description: "Approve doctors, maintain schedules, oversee appointments, and manage clinic operations."
  }
];

export function AuthGatewayPage() {
  const { state, actions } = useDemoData();
  const adminExists = hasAdminAccount(state);

  return (
    <AppShell
      title="Role-based clinic access"
      subtitle="Choose how you want to enter NIRA. This frontend demo now behaves like a real role-based clinic product while staying fully local and backend-free."
      languageLabel="Auth in English"
    >
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-[32px] bg-brand-midnight p-8 text-white shadow-panel">
          <FloatingAccent className="-left-10 top-8 h-48 w-48 animate-float" />
          <FloatingAccent className="bottom-0 right-0 h-52 w-52 bg-amber-200/60" />
          <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-4">
              <div className="pill border-white/15 bg-white/10 text-white">Frontend-only role auth</div>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
                One clinic, three workspaces, one continuous care flow.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-white/80 sm:text-base">
                Patients can sign up with richer but optional profile details, doctors can self-register and wait for approval, and admins can operate the clinic from one place.
              </p>
            </div>
            <div className="grid gap-3">
              <div className="rounded-[24px] border border-white/15 bg-white/10 p-5">
                <div className="section-title text-white/70">Demo credentials</div>
                <div className="mt-3 space-y-2 text-sm text-white/80">
                  <div>Admin: `admin@nira.local / Admin@123`</div>
                  <div>Doctor: `nisha.mehra@nira.local / Doctor@123`</div>
                  <div>Patient: `+91 98765 43210 / Patient@123`</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {roles.map((entry) => {
            const Icon = entry.icon;
            return (
              <Card key={entry.role}>
                <CardHeader
                  eyebrow={entry.role.toUpperCase()}
                  title={entry.title}
                  description={entry.description}
                />
                <div className="space-y-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-brand-mint text-brand-midnight">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild>
                      <Link to={`/auth/login/${entry.role}`}>Login</Link>
                    </Button>
                    {entry.role !== "admin" || !adminExists ? (
                      <Button asChild variant="secondary">
                        <Link to={`/auth/signup/${entry.role}`}>Sign up</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader
            eyebrow="Demo utilities"
            title="Reset local state"
            description="Use these only while demoing. They refresh the frontend-only local data model without touching the codebase."
          />
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => actions.dev.resetDemo("default")}>
              Reset full demo
            </Button>
            <Button variant="secondary" onClick={() => actions.dev.resetDemo("first-admin")}>
              First admin setup
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
