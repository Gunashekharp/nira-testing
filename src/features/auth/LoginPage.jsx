import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input } from "../../components/ui/FormFields";
import { useDemoData } from "../../app/DemoDataProvider";
import { getRoleHomePath } from "../shared/selectors";

const roleCopy = {
  patient: {
    title: "Patient login",
    description: "Sign in with phone or email to book visits, manage your profile, and continue interviews."
  },
  doctor: {
    title: "Doctor login",
    description: "Sign in to review the queue, manage availability, and continue chart validation."
  },
  admin: {
    title: "Admin login",
    description: "Sign in to manage doctors, schedules, appointments, and clinic operations."
  }
};

export function LoginPage() {
  const { role } = useParams();
  const navigate = useNavigate();
  const { actions } = useDemoData();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!roleCopy[role]) {
    return <Navigate to="/auth" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await actions.auth.login({
        role,
        identifier: form.identifier,
        password: form.password
      });
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
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Enter password"
              />
            </Field>
            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div> : null}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Signing in..." : "Login"}
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
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
