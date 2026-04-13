import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { CalendarClock, ClipboardList, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input } from "../../components/ui/FormFields";
import { useDemoData } from "../../app/DemoDataProvider";
import { getRoleHomePath } from "../shared/selectors";
import { useTranslation } from "../../hooks/useTranslation";

const roleCopy = {
  patient: {
    title: "Patient login",
    description: "Sign in with phone or email to book visits, manage your profile, and continue interviews.",
    postLoginTitle: "After login, you can",
    postLoginItems: [
      { icon: CalendarClock, text: "Book live doctor slots in real time." },
      { icon: ClipboardList, text: "Track appointment status and interview handoff." },
      { icon: ShieldCheck, text: "View prescription and care updates securely." }
    ]
  },
  doctor: {
    title: "Doctor login",
    description: "Sign in to review the queue, manage availability, and continue chart validation."
  },
  nurse: {
    title: "Nurse login",
    description: "Sign in to record vitals, assist doctors, and coordinate patient care in the premium nurse workspace.",
    postLoginTitle: "Premium nurse portal includes",
    postLoginItems: [
      { icon: ShieldCheck, text: "Credential-completeness checks for safer role-based access." },
      { icon: ClipboardList, text: "Shift, ward, and emergency handoff readiness at a glance." },
      { icon: Sparkles, text: "Fast link to complete required nurse profile fields." }
    ]
  },
  admin: {
    title: "Admin login",
    description: "Sign in to manage doctors, schedules, appointments, and clinic operations."
  }
};

const demoCredentials = {
  patient: { identifier: "+91 98765 43210", password: "Patient@123" },
  doctor: { identifier: "farah.ali@nira.local", password: "Doctor@123" },
  nurse: { identifier: "nurse@nira.local", password: "Nurse@123" },
  admin: { identifier: "admin@nira.local", password: "Admin@123" }
};

export function LoginPage() {
  const { role } = useParams();
  const navigate = useNavigate();
  const { actions } = useDemoData();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(role === "patient");

  if (!roleCopy[role]) {
    return <Navigate to="/auth" replace />;
  }

  const canSubmit = form.identifier.trim() && form.password;

  function applyDemoCredentials() {
    if (!demoCredentials[role]) {
      return;
    }
    setForm(demoCredentials[role]);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) {
      setError("Enter both phone/email and password to continue.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await actions.auth.login({
        role,
        identifier: form.identifier.trim(),
        password: form.password
      });
      await actions.refresh();
      navigate(getRoleHomePath(role), { replace: true });
    } catch (issue) {
      setError(issue.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title={roleCopy[role].title} subtitle={roleCopy[role].description} languageLabel="Auth in English">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader
            eyebrow="Access"
            title={roleCopy[role].title}
            description="Use a phone number or email address. The role-specific route ensures the right workspace opens after sign-in."
          />
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="Phone or email">
              <Input
                value={form.identifier}
                onChange={(event) => setForm((current) => ({ ...current, identifier: event.target.value }))}
                placeholder={role === "patient" ? "+91 98765 43210 or patient@nira.local" : "name@nira.local or phone"}
                autoComplete={role === "patient" ? "username" : "email"}
                required
              />
            </Field>
            <Field label="Password" hint="Required">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                  className="pr-20"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted transition hover:bg-brand-mint hover:text-brand-midnight"
                  aria-label={showPassword ? "Hide secret text" : "Show secret text"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-line text-brand-sky focus:ring-brand-sky"
                checked={rememberDevice}
                onChange={(event) => setRememberDevice(event.target.checked)}
              />
              Keep me signed in on this device
            </label>
            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div> : null}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={submitting || !canSubmit}>
                {submitting ? "Signing in..." : "Login"}
              </Button>
              <Button type="button" variant="ghost" onClick={applyDemoCredentials}>
                Use demo credentials
              </Button>
              <Button asChild variant="secondary">
                <Link to="/auth">Back</Link>
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Need an account?"
            title="Create or reset your demo entry"
            description="Patient and doctor accounts can be created publicly. Admin signup is only shown when the clinic has no admin yet."
          />
          <div className="space-y-4">
            {role !== "admin" ? (
              <div className="rounded-[24px] border border-line bg-surface-2 p-5">
                <div className="text-base font-semibold text-ink">New {role} account</div>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Sign up with richer optional profile details now, then continue editing your profile after login.
                </p>
                <div className="mt-4">
                  <Button asChild variant="secondary">
                    <Link to={`/auth/signup/${role}`}>Sign up as {role}</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-line bg-surface-2 p-5 text-sm leading-6 text-muted">
                Admin signup is only available during first clinic setup. Use the auth home screen demo utility if you want to simulate that state.
              </div>
            )}
            {role === "patient" || role === "nurse" ? (
              <div className="rounded-[24px] border border-brand-sky/20 bg-brand-mint/40 p-5">
                <div className="flex items-center gap-2 text-base font-semibold text-ink">
                  <Sparkles className="h-4 w-4 text-brand-tide" />
                  {roleCopy[role].postLoginTitle}
                </div>
                <div className="mt-3 space-y-2.5">
                  {roleCopy[role].postLoginItems.map((item) => (
                    <div key={item.text} className="flex items-start gap-2 text-sm leading-6 text-muted">
                      <item.icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-tide" />
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
