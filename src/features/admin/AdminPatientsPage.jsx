import { useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../components/ui/FormFields";
import { useDemoData } from "../../app/DemoDataProvider";
import { getAdminWorkspace } from "../shared/selectors";

function emptyPatientForm() {
  return {
    fullName: "",
    phone: "",
    email: "",
    password: "Patient@123",
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

function buildEditForm(patient) {
  return {
    fullName: patient.fullName || "",
    phone: patient.phone || "",
    email: patient.email || "",
    preferredLanguage: patient.preferredLanguage || "en",
    age: patient.age ?? "",
    gender: patient.gender || "",
    city: patient.city || "",
    abhaNumber: patient.abhaNumber || "",
    emergencyContactName: patient.emergencyContactName || "",
    emergencyContactPhone: patient.emergencyContactPhone || "",
    notes: patient.notes || ""
  };
}

function toneForStatus(status) {
  if (status === "archived") return "danger";
  if (status === "inactive") return "warning";
  return "success";
}

export function AdminPatientsPage() {
  const { state, actions } = useDemoData();
  const { patients } = getAdminWorkspace(state);
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id || "");
  const [createForm, setCreateForm] = useState(emptyPatientForm());
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) || null;
  const [editForm, setEditForm] = useState(() => (selectedPatient ? buildEditForm(selectedPatient) : null));

  useEffect(() => {
    if (selectedPatient) {
      setEditForm(buildEditForm(selectedPatient));
    }
  }, [selectedPatientId, selectedPatient?.userStatus, selectedPatient?.fullName]);

  async function handleCreate(event) {
    event.preventDefault();
    await actions.admin.addPatient(createForm);
    setCreateForm(emptyPatientForm());
  }

  async function handleUpdate(event) {
    event.preventDefault();
    await actions.admin.updatePatient(selectedPatientId, editForm);
  }

  return (
    <AppShell
      title="Patient management"
      subtitle="Create, edit, archive, and restore patient records while preserving linked appointments, prescriptions, and lab history."
      languageLabel="Admin UI in English"
    >
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader
              eyebrow="Add patient"
              title="Create patient account"
              description="Use the same richer patient profile model already supported in signup and profile editing."
            />
            <form className="grid gap-4" onSubmit={handleCreate}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full name">
                  <Input value={createForm.fullName} onChange={(event) => setCreateForm((current) => ({ ...current, fullName: event.target.value }))} />
                </Field>
                <Field label="Phone">
                  <Input value={createForm.phone} onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))} />
                </Field>
                <Field label="Email">
                  <Input value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} />
                </Field>
                <Field label="Password">
                  <Input value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} />
                </Field>
                <Field label="Preferred language">
                  <Select value={createForm.preferredLanguage} onChange={(event) => setCreateForm((current) => ({ ...current, preferredLanguage: event.target.value }))}>
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                  </Select>
                </Field>
                <Field label="Age">
                  <Input value={createForm.age} onChange={(event) => setCreateForm((current) => ({ ...current, age: event.target.value }))} />
                </Field>
                <Field label="Gender">
                  <Select value={createForm.gender} onChange={(event) => setCreateForm((current) => ({ ...current, gender: event.target.value }))}>
                    <option value="">Prefer not to say</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </Select>
                </Field>
                <Field label="City">
                  <Input value={createForm.city} onChange={(event) => setCreateForm((current) => ({ ...current, city: event.target.value }))} />
                </Field>
                <Field label="ABHA number">
                  <Input value={createForm.abhaNumber} onChange={(event) => setCreateForm((current) => ({ ...current, abhaNumber: event.target.value }))} />
                </Field>
                <Field label="Emergency contact name">
                  <Input value={createForm.emergencyContactName} onChange={(event) => setCreateForm((current) => ({ ...current, emergencyContactName: event.target.value }))} />
                </Field>
                <Field label="Emergency contact phone">
                  <Input value={createForm.emergencyContactPhone} onChange={(event) => setCreateForm((current) => ({ ...current, emergencyContactPhone: event.target.value }))} />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))} />
              </Field>
              <Button type="submit">Add patient</Button>
            </form>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Directory"
              title="Clinic patients"
              description="Select a patient to edit details or archive the account without deleting historical records."
            />
            <div className="space-y-3">
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => setSelectedPatientId(patient.id)}
                  className={`w-full rounded-[22px] border p-4 text-left transition ${
                    selectedPatientId === patient.id ? "border-cyan-300 bg-brand-mint" : "border-line bg-surface-2 hover:bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-ink">{patient.fullName}</div>
                      <div className="mt-1 text-xs text-muted">
                        {patient.phone || "-"} | {patient.city || "City optional"}
                      </div>
                    </div>
                    <Badge tone={toneForStatus(patient.userStatus)}>{patient.userStatus}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone="info">{patient.appointmentCount} appointments</Badge>
                    <Badge tone={patient.labOrderCount ? "warning" : "neutral"}>{patient.labOrderCount} lab orders</Badge>
                    {patient.abhaNumber ? <Badge tone="success">ABHA linked</Badge> : <Badge tone="neutral">ABHA optional</Badge>}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {selectedPatient && editForm ? (
          <Card>
            <CardHeader
              eyebrow="Edit patient"
              title={selectedPatient.fullName}
              description="Changes update the shared patient record, while archive and restore only change access status."
            />
            <form className="grid gap-5" onSubmit={handleUpdate}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full name">
                  <Input value={editForm.fullName} onChange={(event) => setEditForm((current) => ({ ...current, fullName: event.target.value }))} />
                </Field>
                <Field label="Phone">
                  <Input value={editForm.phone} onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))} />
                </Field>
                <Field label="Email">
                  <Input value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} />
                </Field>
                <Field label="Preferred language">
                  <Select value={editForm.preferredLanguage} onChange={(event) => setEditForm((current) => ({ ...current, preferredLanguage: event.target.value }))}>
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                  </Select>
                </Field>
                <Field label="Age">
                  <Input value={editForm.age} onChange={(event) => setEditForm((current) => ({ ...current, age: event.target.value }))} />
                </Field>
                <Field label="Gender">
                  <Select value={editForm.gender} onChange={(event) => setEditForm((current) => ({ ...current, gender: event.target.value }))}>
                    <option value="">Prefer not to say</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </Select>
                </Field>
                <Field label="City">
                  <Input value={editForm.city} onChange={(event) => setEditForm((current) => ({ ...current, city: event.target.value }))} />
                </Field>
                <Field label="ABHA number">
                  <Input value={editForm.abhaNumber} onChange={(event) => setEditForm((current) => ({ ...current, abhaNumber: event.target.value }))} />
                </Field>
                <Field label="Emergency contact name">
                  <Input value={editForm.emergencyContactName} onChange={(event) => setEditForm((current) => ({ ...current, emergencyContactName: event.target.value }))} />
                </Field>
                <Field label="Emergency contact phone">
                  <Input value={editForm.emergencyContactPhone} onChange={(event) => setEditForm((current) => ({ ...current, emergencyContactPhone: event.target.value }))} />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea value={editForm.notes} onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} />
              </Field>
              <div className="flex flex-wrap gap-3">
                <Button type="submit">Save patient</Button>
                {selectedPatient.userStatus === "archived" ? (
                  <Button type="button" variant="secondary" onClick={() => actions.admin.restorePatient(selectedPatient.id)}>
                    Restore patient
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" onClick={() => actions.admin.archivePatient(selectedPatient.id)}>
                    Archive patient
                  </Button>
                )}
              </div>
            </form>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
