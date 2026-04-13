import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../components/ui/FormFields";
import { useDemoData } from "../../app/DemoDataProvider";
import { getRoleHomePath } from "../shared/selectors";

const signupCopy = {
  patient: {
    title: "Patient signup",
    description: "Create a patient account with optional profile details now, then complete or edit them after login."
  },
  doctor: {
    title: "Doctor signup",
    description: "Create a doctor account. Public doctor signup enters a pending-approval state until an admin reviews it."
  },
  admin: {
    title: "First admin signup",
    description: "Bootstrap the clinic admin only when no admin account exists yet."
  }
};

function initialForm(role) {
  if (role === "patient") {
    return {
      fullName: "",
      phone: "",
      email: "",
      password: "",
      preferredLanguage: "en",
      age: "",
      gender: "",
      city: "",
      abhaNumber: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      notes: ""
    };
  }

  if (role === "doctor") {
    return {
      fullName: "",
      phone: "",
      email: "",
      password: "",
      specialty: "",
      licenseNumber: "",
      clinic: "NIRA Pilot Clinic",
      bio: "",
      gender: ""
    };
  }

  return {
    fullName: "",
    clinicName: "NIRA Pilot Clinic",
    phone: "",
    email: "",
    password: ""
  };
}

export function SignupPage() {
  const { role } = useParams();
  const navigate = useNavigate();
  const { actions } = useDemoData();
  const [form, setForm] = useState(() => initialForm(role));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const copy = useMemo(() => signupCopy[role], [role]);

  if (!copy) {
    return <Navigate to="/auth" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (role === "patient") {
        await actions.auth.signupPatient(form);
      }

      if (role === "doctor") {
        await actions.auth.signupDoctor(form);
      }

      if (role === "admin") {
        await actions.auth.signupAdmin(form);
      }

      await actions.refresh();
      navigate(getRoleHomePath(role), { replace: true });
    } catch (issue) {
      setError(issue.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title={copy.title} subtitle={copy.description} languageLabel="Auth in English">
      <div className="mx-auto max-w-5xl">
        <Card>
          <CardHeader
            eyebrow="Signup"
            title={copy.title}
            description="Only a few fields are required to get started. Everything else can be added later from your profile."
          />
          <form className="grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full name">
                <Input
                  required
                  value={form.fullName}
                  onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                />
              </Field>
              <Field label="Phone">
                <Input
                  required
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                />
              </Field>
              <Field label="Email">
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />
              </Field>
              <Field label="Password">
                <Input
                  required
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                />
              </Field>
            </div>

            {role === "patient" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Age">
                  <Input
                    type="number"
                    value={form.age}
                    onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))}
                  />
                </Field>
                <Field label="Gender">
                  <Select
                    value={form.gender}
                    onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                  >
                    <option value="">Prefer not to say</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </Select>
                </Field>
                <Field label="City">
                  <Input
                    value={form.city}
                    onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                  />
                </Field>
                <Field label="ABHA number">
                  <Input
                    value={form.abhaNumber}
                    onChange={(event) => setForm((current) => ({ ...current, abhaNumber: event.target.value }))}
                  />
                </Field>
                <Field label="Emergency contact name">
                  <Input
                    value={form.emergencyContactName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, emergencyContactName: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Emergency contact phone">
                  <Input
                    value={form.emergencyContactPhone}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, emergencyContactPhone: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Notes">
                  <Textarea
                    value={form.notes}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  />
                </Field>
              </div>
            ) : null}

            {role === "doctor" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Specialty">
                  <Input
                    required
                    value={form.specialty}
                    onChange={(event) => setForm((current) => ({ ...current, specialty: event.target.value }))}
                  />
                </Field>
                <Field label="License number">
                  <Input
                    required
                    value={form.licenseNumber}
                    onChange={(event) => setForm((current) => ({ ...current, licenseNumber: event.target.value }))}
                  />
                </Field>
                <Field label="Clinic">
                  <Input
                    value={form.clinic}
                    onChange={(event) => setForm((current) => ({ ...current, clinic: event.target.value }))}
                  />
                </Field>
                <Field label="Gender">
                  <Select
                    value={form.gender}
                    onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                  >
                    <option value="">Prefer not to say</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </Select>
                </Field>
                <Field label="Bio" className="md:col-span-2">
                  <Textarea
                    value={form.bio}
                    onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                  />
                </Field>
              </div>
            ) : null}

            {role === "admin" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Clinic name">
                  <Input
                    value={form.clinicName}
                    onChange={(event) => setForm((current) => ({ ...current, clinicName: event.target.value }))}
                  />
                </Field>
              </div>
            ) : null}

            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div> : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating account..." : "Create account"}
              </Button>
              <Button asChild variant="secondary">
                <Link to={`/auth/login/${role}`}>Back to login</Link>
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
