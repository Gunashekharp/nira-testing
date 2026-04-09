import { useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../components/ui/FormFields";
import { useDemoData } from "../../app/DemoDataProvider";
import { getCurrentProfile, getCurrentUser } from "./selectors";

const copy = {
  patient: {
    title: "Patient profile",
    subtitle: "Complete or edit your personal details at any time. None of these optional details are forced during signup."
  },
  doctor: {
    title: "Doctor profile",
    subtitle: "Manage your visible doctor profile details here. Availability stays in the dedicated schedule workspace."
  },
  admin: {
    title: "Admin profile",
    subtitle: "Keep the clinic admin identity and contact details current for demos and handoff."
  }
};

function buildForm(role, profile, user) {
  if (role === "patient") {
    return {
      fullName: profile.fullName || "",
      phone: user.phone || "",
      email: user.email || "",
      preferredLanguage: profile.preferredLanguage || "en",
      age: profile.age ?? "",
      gender: profile.gender || "",
      city: profile.city || "",
      abhaNumber: profile.abhaNumber || "",
      emergencyContactName: profile.emergencyContactName || "",
      emergencyContactPhone: profile.emergencyContactPhone || "",
      notes: profile.notes || ""
    };
  }

  if (role === "doctor") {
    return {
      fullName: profile.fullName || "",
      phone: user.phone || "",
      email: user.email || "",
      specialty: profile.specialty || "",
      clinic: profile.clinic || "",
      licenseNumber: profile.licenseNumber || "",
      bio: profile.bio || "",
      gender: profile.gender || ""
    };
  }

  return {
    fullName: profile.fullName || "",
    phone: user.phone || "",
    email: user.email || "",
    clinicName: profile.clinicName || ""
  };
}

export function ProfilePage() {
  const { state, actions } = useDemoData();
  const user = getCurrentUser(state);
  const profile = getCurrentProfile(state);
  const [form, setForm] = useState(() => buildForm(user.role, profile, user));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(buildForm(user.role, profile, user));
  }, [user.id, profile.id]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");

    try {
      await actions.auth.updateCurrentProfile(form);
      setSaved(true);
    } catch (issue) {
      setError(issue.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title={copy[user.role].title} subtitle={copy[user.role].subtitle} languageLabel="Profile in English / Hindi">
      <Card className="mx-auto max-w-5xl">
        <CardHeader
          eyebrow="Editable profile"
          title={profile.fullName}
          description="You can update these details after signup without leaving the frontend demo flow."
        />
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name">
              <Input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            </Field>
            <Field label="Email">
              <Input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </Field>
            {user.role === "patient" ? (
              <Field label="Preferred language">
                <Select
                  value={form.preferredLanguage}
                  onChange={(event) => setForm((current) => ({ ...current, preferredLanguage: event.target.value }))}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                </Select>
              </Field>
            ) : null}
            {user.role === "patient" ? (
              <>
                <Field label="Age">
                  <Input value={form.age} onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))} />
                </Field>
                <Field label="Gender">
                  <Select value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}>
                    <option value="">Prefer not to say</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </Select>
                </Field>
                <Field label="City">
                  <Input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
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
                <Field label="Notes" className="md:col-span-2">
                  <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                </Field>
              </>
            ) : null}
            {user.role === "doctor" ? (
              <>
                <Field label="Specialty">
                  <Input value={form.specialty} onChange={(event) => setForm((current) => ({ ...current, specialty: event.target.value }))} />
                </Field>
                <Field label="Clinic">
                  <Input value={form.clinic} onChange={(event) => setForm((current) => ({ ...current, clinic: event.target.value }))} />
                </Field>
                <Field label="License number">
                  <Input
                    value={form.licenseNumber}
                    onChange={(event) => setForm((current) => ({ ...current, licenseNumber: event.target.value }))}
                  />
                </Field>
                <Field label="Gender">
                  <Select value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}>
                    <option value="">Prefer not to say</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </Select>
                </Field>
                <Field label="Bio" className="md:col-span-2">
                  <Textarea value={form.bio} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} />
                </Field>
              </>
            ) : null}
            {user.role === "admin" ? (
              <Field label="Clinic name">
                <Input
                  value={form.clinicName}
                  onChange={(event) => setForm((current) => ({ ...current, clinicName: event.target.value }))}
                />
              </Field>
            ) : null}
          </div>

          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div> : null}
          {saved ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Profile saved locally.</div> : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </form>
      </Card>
    </AppShell>
  );
}
