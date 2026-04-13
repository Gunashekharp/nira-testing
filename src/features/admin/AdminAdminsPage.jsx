import { useState } from "react";
import { Shield, Mail, Phone, Building2 } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input } from "../../components/ui/FormFields";
import { useDemoData } from "../../app/DemoDataProvider";
import { getAdminWorkspace } from "../shared/selectors";

function emptyAdminForm() {
  return {
    fullName: "",
    phone: "",
    email: "",
    password: "Admin@123",
    clinicName: "NIRA Pilot Clinic"
  };
}

export function AdminAdminsPage() {
  const { state, actions } = useDemoData();
  const { admins } = getAdminWorkspace(state);
  const [form, setForm] = useState(emptyAdminForm());
  const [error, setError] = useState("");

  async function handleCreate(event) {
    event.preventDefault();
    setError("");

    try {
      await actions.admin.addAdmin(form);
      setForm(emptyAdminForm());
    } catch (issue) {
      setError(issue.message);
    }
  }

  return (
    <AppShell
      title="Admin management"
      subtitle="Create additional admin accounts and maintain visibility on active clinic operators."
      languageLabel="Admin UI in English"
    >
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          {/* Create Admin Card */}
          <Card className="shadow-elevated">
            <CardHeader
              eyebrow="Add admin"
              title="Create another admin"
              description="Use this when multiple team members need full admin access."
            />
            <form className="grid gap-4" onSubmit={handleCreate}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full name">
                  <Input required value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Enter full name" />
                </Field>
                <Field label="Phone">
                  <Input required value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+91 9xxxx xxxxx" />
                </Field>
                <Field label="Email">
                  <Input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="admin@clinic.local" />
                </Field>
                <Field label="Password">
                  <Input required value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
                </Field>
                <Field label="Clinic name" className="md:col-span-2">
                  <Input value={form.clinicName} onChange={(event) => setForm((current) => ({ ...current, clinicName: event.target.value }))} placeholder="NIRA Pilot Clinic" />
                </Field>
              </div>

              {error ? (
                <div className="rounded-xl border-l-4 border-l-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  <p className="font-semibold">Error</p>
                  <p className="text-xs mt-1">{error}</p>
                </div>
              ) : null}

              <Button type="submit" className="w-full">
                + Add admin account
              </Button>
            </form>
          </Card>

          {/* Admins List Card */}
          <Card className="shadow-elevated">
            <CardHeader
              eyebrow="Admin accounts"
              title={`Clinic admins (${admins.length})`}
              description="All admins have full access to doctor, appointment, and patient operations."
            />
            <div className="grid gap-3">
              {admins.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-line bg-surface/50 p-6 text-center">
                  <Shield className="mx-auto h-8 w-8 text-muted/40 mb-2" />
                  <p className="text-sm text-muted">No admin accounts yet. Create the first one above.</p>
                </div>
              ) : (
                admins.map((admin) => (
                  <div
                    key={admin.id}
                    className="group rounded-xl border border-line bg-white p-4 shadow-soft hover:shadow-md transition-all duration-200 hover:border-brand-tide/30"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-mint">
                          <Shield className="h-5 w-5 text-brand-tide" />
                        </div>
                        <div className="flex-1">
                          <div className="text-base font-semibold text-ink">{admin.fullName}</div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                            <Building2 className="h-3 w-3" />
                            {admin.clinicName || "NIRA Pilot Clinic"}
                          </div>
                        </div>
                      </div>
                      <Badge tone="success">Active</Badge>
                    </div>

                    <div className="mt-3 grid gap-2.5 md:grid-cols-2">
                      <div className="rounded-lg bg-surface/70 p-3 text-xs">
                        <div className="flex items-center gap-2 text-muted mb-1">
                          <Phone className="h-3 w-3" />
                          Phone
                        </div>
                        <div className="font-semibold text-ink">{admin.phone || "-"}</div>
                      </div>
                      <div className="rounded-lg bg-surface/70 p-3 text-xs">
                        <div className="flex items-center gap-2 text-muted mb-1">
                          <Mail className="h-3 w-3" />
                          Email
                        </div>
                        <div className="font-semibold text-ink break-all">{admin.email || "-"}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
