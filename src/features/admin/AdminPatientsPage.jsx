import { useEffect, useMemo, useState } from "react";
import { PencilLine, Search, Share2, Trash2, UserRoundPlus, Users } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../components/ui/FormFields";
import { ManagementActionButton, ManagementTable } from "../../components/ui/ManagementTable";
import { ProfileAvatar } from "../../components/ui/ProfileAvatar";
import { useDemoData } from "../../app/DemoDataProvider";
import { getAdminWorkspace } from "../shared/selectors";
import { listCollection } from "../../services/stateHelpers";
import { matchesDirectoryQuery, shareDirectoryRecord } from "./adminDirectoryUtils";

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

function buildEditForm(patient, user) {
  return {
    fullName: patient.fullName || "",
    phone: user.phone || "",
    email: user.email || "",
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

function buildPatientShareText(patient, user, appointmentSummary) {
  return [
    `Patient: ${patient.fullName}`,
    `Phone: ${user?.phone || "-"}`,
    `Email: ${user?.email || "-"}`,
    `City: ${patient.city || "-"}`,
    `ABHA: ${patient.abhaNumber || "Not linked"}`,
    `Appointments: ${appointmentSummary.active} active / ${appointmentSummary.total} total`
  ].join("\n");
}

export function AdminPatientsPage() {
  const { state, actions } = useDemoData();
  const { patients } = getAdminWorkspace(state);
  const [mode, setMode] = useState(patients.length ? "edit" : "create");
  const [searchQuery, setSearchQuery] = useState("");
  const [abhaFilter, setAbhaFilter] = useState("all");
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id || "");
  const [createForm, setCreateForm] = useState(emptyPatientForm());
  const [editForm, setEditForm] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const appointmentSummaryByPatient = useMemo(() => {
    const allAppointments = listCollection(state.appointments || { allIds: [], byId: {} });

    return Object.fromEntries(
      patients.map((patient) => {
        const patientAppointments = allAppointments.filter((appointment) => appointment.patientId === patient.id);
        const active = patientAppointments.filter((appointment) =>
          ["scheduled", "rescheduled", "checked_in"].includes(appointment.bookingStatus)
        ).length;

        return [
          patient.id,
          {
            total: patientAppointments.length,
            active
          }
        ];
      })
    );
  }, [patients, state.appointments]);

  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      const matchesSearch = matchesDirectoryQuery(searchQuery, [
        patient.fullName,
        patient.city,
        patient.phone,
        patient.email,
        patient.abhaNumber
      ]);
      const matchesAbha =
        abhaFilter === "all"
          ? true
          : abhaFilter === "linked"
            ? Boolean(patient.abhaNumber)
            : !patient.abhaNumber;

      return matchesSearch && matchesAbha;
    });
  }, [abhaFilter, patients, searchQuery]);

  const selectedPatient = state.patients.byId[selectedPatientId] || null;
  const selectedUser = selectedPatient ? state.users.byId[selectedPatient.userId] || null : null;

  useEffect(() => {
    if (selectedPatient && selectedUser) {
      setEditForm(buildEditForm(selectedPatient, selectedUser));
    }
  }, [selectedPatient, selectedUser]);

  useEffect(() => {
    if (mode !== "edit") {
      return;
    }

    if (!filteredPatients.length) {
      setSelectedPatientId("");
      return;
    }

    if (!filteredPatients.some((patient) => patient.id === selectedPatientId)) {
      setSelectedPatientId(filteredPatients[0].id);
    }
  }, [filteredPatients, mode, selectedPatientId]);

  function handleSelectPatient(patientId) {
    setMode("edit");
    setSelectedPatientId(patientId);
    setFeedback("");
    setError("");
  }

  function handleStartCreate() {
    setMode("create");
    setSelectedPatientId("");
    setCreateForm(emptyPatientForm());
    setFeedback("");
    setError("");
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFeedback("");
    setError("");

    try {
      const snapshot = await actions.admin.addPatient(createForm);
      const createdPatient = Object.values(snapshot.patients.byId).find(
        (patient) =>
          patient.fullName === createForm.fullName &&
          String(snapshot.users.byId[patient.userId]?.email || "").toLowerCase() === createForm.email.toLowerCase()
      );

      setCreateForm(emptyPatientForm());
      setFeedback("Patient added to the admin directory.");

      if (createdPatient) {
        setMode("edit");
        setSelectedPatientId(createdPatient.id);
      }
    } catch (issue) {
      setError(issue.message);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!selectedPatientId || !editForm) {
      return;
    }

    setFeedback("");
    setError("");

    try {
      await actions.admin.updatePatient(selectedPatientId, editForm);
      setFeedback("Patient profile updated.");
    } catch (issue) {
      setError(issue.message);
    }
  }

  async function handleSharePatient(patient) {
    setError("");

    try {
      const message = await shareDirectoryRecord({
        title: `${patient.fullName} patient record`,
        text: buildPatientShareText(
          patient,
          state.users.byId[patient.userId],
          appointmentSummaryByPatient[patient.id] || { active: 0, total: 0 }
        )
      });
      setFeedback(message);
    } catch (issue) {
      setError(issue.message);
    }
  }

  async function handleDeletePatient(patient) {
    const confirmed = window.confirm(
      `Delete ${patient.fullName}? This will also remove the linked appointments and timeline records from the frontend demo state.`
    );

    if (!confirmed) {
      return;
    }

    setFeedback("");
    setError("");

    try {
      await actions.admin.deletePatient(patient.id);
      setMode("create");
      setSelectedPatientId("");
      setFeedback(`${patient.fullName} has been removed from the patient directory.`);
    } catch (issue) {
      setError(issue.message);
    }
  }

  const linkedCount = patients.filter((patient) => patient.abhaNumber).length;

  return (
    <AppShell
      title="Patient management"
      subtitle="Editable patient management with the same clickable table pattern used for providers."
      actions={
        <Button type="button" onClick={handleStartCreate}>
          <UserRoundPlus className="h-4 w-4" />
          Add patient
        </Button>
      }
    >
      <div className="space-y-6">
        {feedback ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {feedback}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <Card density="compact" className="shadow-elevated">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-tide">Patients</div>
            <div className="mt-3 text-3xl font-bold text-ink">{patients.length}</div>
            <div className="mt-1 text-sm text-muted">Visible in the clinic directory</div>
          </Card>
          <Card density="compact" className="shadow-elevated">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-tide">ABHA linked</div>
            <div className="mt-3 text-3xl font-bold text-ink">{linkedCount}</div>
            <div className="mt-1 text-sm text-muted">Health IDs already connected</div>
          </Card>
          <Card density="compact" className="shadow-elevated">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-tide">Needs follow-up</div>
            <div className="mt-3 text-3xl font-bold text-ink">
              {Object.values(appointmentSummaryByPatient).filter((summary) => summary.active > 0).length}
            </div>
            <div className="mt-1 text-sm text-muted">Patients with active appointments</div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <ManagementTable
            eyebrow="Patient directory"
            title={`Clinic patients (${filteredPatients.length})`}
            description="Rows open in the edit panel, while share and delete stay available in the action rail."
            rows={filteredPatients}
            selectedRowId={mode === "edit" ? selectedPatientId : ""}
            onRowSelect={handleSelectPatient}
            toolbar={
              <div className="flex max-w-[420px] flex-wrap justify-end gap-2">
                <div className="relative w-full sm:w-[260px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search patient, city, phone..."
                    className="pl-9"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={abhaFilter === "all" ? "primary" : "secondary"}
                  onClick={() => setAbhaFilter("all")}
                >
                  All
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={abhaFilter === "linked" ? "primary" : "secondary"}
                  onClick={() => setAbhaFilter("linked")}
                >
                  ABHA linked
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={abhaFilter === "unlinked" ? "primary" : "secondary"}
                  onClick={() => setAbhaFilter("unlinked")}
                >
                  ABHA optional
                </Button>
              </div>
            }
            columns={[
              {
                key: "patient",
                header: "Patient",
                cellClassName: "min-w-[280px]",
                render: (patient) => (
                  <div className="flex items-center gap-3">
                    <ProfileAvatar name={patient.fullName} photo={patient.profilePhoto} size="md" tone="soft" />
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-ink">{patient.fullName}</div>
                      <div className="truncate text-xs text-muted">
                        {state.users.byId[patient.userId]?.phone || state.users.byId[patient.userId]?.email || "No contact"}
                      </div>
                    </div>
                  </div>
                )
              },
              {
                key: "city",
                header: "City",
                cellClassName: "min-w-[160px]",
                render: (patient) => (
                  <div>
                    <div className="font-medium text-ink">{patient.city || "Not set"}</div>
                    <div className="text-xs text-muted">
                      {patient.gender || "Gender not set"}
                    </div>
                  </div>
                )
              },
              {
                key: "abha",
                header: "Health ID",
                cellClassName: "min-w-[180px]",
                render: (patient) => (
                  <div>
                    <Badge tone={patient.abhaNumber ? "success" : "neutral"}>
                      {patient.abhaNumber ? "ABHA linked" : "ABHA optional"}
                    </Badge>
                    <div className="mt-2 text-xs text-muted">
                      {patient.abhaNumber || "Not connected yet"}
                    </div>
                  </div>
                )
              },
              {
                key: "appointments",
                header: "Appointments",
                cellClassName: "min-w-[150px]",
                render: (patient) => {
                  const summary = appointmentSummaryByPatient[patient.id] || { active: 0, total: 0 };

                  return (
                    <div>
                      <div className="font-medium text-ink">{summary.active} active</div>
                      <div className="text-xs text-muted">{summary.total} total history</div>
                    </div>
                  );
                }
              }
            ]}
            renderActions={(patient) => (
              <>
                <ManagementActionButton
                  label={`Edit ${patient.fullName}`}
                  onClick={() => handleSelectPatient(patient.id)}
                >
                  <PencilLine className="h-4 w-4" />
                </ManagementActionButton>
                <ManagementActionButton
                  label={`Share ${patient.fullName}`}
                  onClick={() => handleSharePatient(patient)}
                >
                  <Share2 className="h-4 w-4" />
                </ManagementActionButton>
                <ManagementActionButton
                  label={`Delete ${patient.fullName}`}
                  tone="danger"
                  onClick={() => handleDeletePatient(patient)}
                >
                  <Trash2 className="h-4 w-4" />
                </ManagementActionButton>
              </>
            )}
            emptyTitle="No patients match this view"
            emptyDescription="Try a broader search or add a new patient record."
          />

          <div className="space-y-5">
            {mode === "create" ? (
              <Card className="shadow-elevated">
                <CardHeader
                  eyebrow="Add patient"
                  title="Create a patient account"
                  description="Add the patient straight into the admin directory with contact and health profile details."
                />
                <form className="grid gap-4" onSubmit={handleCreate}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Full name">
                      <Input
                        value={createForm.fullName}
                        onChange={(event) => setCreateForm((current) => ({ ...current, fullName: event.target.value }))}
                      />
                    </Field>
                    <Field label="Phone">
                      <Input
                        value={createForm.phone}
                        onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))}
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        value={createForm.email}
                        onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                      />
                    </Field>
                    <Field label="Password">
                      <Input
                        value={createForm.password}
                        onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                      />
                    </Field>
                    <Field label="Preferred language">
                      <Select
                        value={createForm.preferredLanguage}
                        onChange={(event) =>
                          setCreateForm((current) => ({ ...current, preferredLanguage: event.target.value }))
                        }
                      >
                        <option value="en">English</option>
                        <option value="hi">Hindi</option>
                      </Select>
                    </Field>
                    <Field label="Age">
                      <Input
                        value={createForm.age}
                        onChange={(event) => setCreateForm((current) => ({ ...current, age: event.target.value }))}
                      />
                    </Field>
                    <Field label="Gender">
                      <Select
                        value={createForm.gender}
                        onChange={(event) => setCreateForm((current) => ({ ...current, gender: event.target.value }))}
                      >
                        <option value="">Prefer not to say</option>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Other">Other</option>
                      </Select>
                    </Field>
                    <Field label="City">
                      <Input
                        value={createForm.city}
                        onChange={(event) => setCreateForm((current) => ({ ...current, city: event.target.value }))}
                      />
                    </Field>
                    <Field label="ABHA number">
                      <Input
                        value={createForm.abhaNumber}
                        onChange={(event) => setCreateForm((current) => ({ ...current, abhaNumber: event.target.value }))}
                      />
                    </Field>
                    <Field label="Emergency contact name">
                      <Input
                        value={createForm.emergencyContactName}
                        onChange={(event) =>
                          setCreateForm((current) => ({ ...current, emergencyContactName: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Emergency contact phone">
                      <Input
                        value={createForm.emergencyContactPhone}
                        onChange={(event) =>
                          setCreateForm((current) => ({ ...current, emergencyContactPhone: event.target.value }))
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Notes">
                    <Textarea
                      value={createForm.notes}
                      onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit">
                      <UserRoundPlus className="h-4 w-4" />
                      Add patient
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setCreateForm(emptyPatientForm())}>
                      Reset form
                    </Button>
                  </div>
                </form>
              </Card>
            ) : selectedPatient && editForm ? (
              <Card className="shadow-elevated">
                <CardHeader
                  eyebrow="Edit patient"
                  title={selectedPatient.fullName}
                  description="Update patient contact details, care profile, and share or remove the record when needed."
                />
                <form className="grid gap-4" onSubmit={handleUpdate}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Full name">
                      <Input
                        value={editForm.fullName}
                        onChange={(event) => setEditForm((current) => ({ ...current, fullName: event.target.value }))}
                      />
                    </Field>
                    <Field label="Phone">
                      <Input
                        value={editForm.phone}
                        onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))}
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        value={editForm.email}
                        onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
                      />
                    </Field>
                    <Field label="Preferred language">
                      <Select
                        value={editForm.preferredLanguage}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, preferredLanguage: event.target.value }))
                        }
                      >
                        <option value="en">English</option>
                        <option value="hi">Hindi</option>
                      </Select>
                    </Field>
                    <Field label="Age">
                      <Input
                        value={editForm.age}
                        onChange={(event) => setEditForm((current) => ({ ...current, age: event.target.value }))}
                      />
                    </Field>
                    <Field label="Gender">
                      <Select
                        value={editForm.gender}
                        onChange={(event) => setEditForm((current) => ({ ...current, gender: event.target.value }))}
                      >
                        <option value="">Prefer not to say</option>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Other">Other</option>
                      </Select>
                    </Field>
                    <Field label="City">
                      <Input
                        value={editForm.city}
                        onChange={(event) => setEditForm((current) => ({ ...current, city: event.target.value }))}
                      />
                    </Field>
                    <Field label="ABHA number">
                      <Input
                        value={editForm.abhaNumber}
                        onChange={(event) => setEditForm((current) => ({ ...current, abhaNumber: event.target.value }))}
                      />
                    </Field>
                    <Field label="Emergency contact name">
                      <Input
                        value={editForm.emergencyContactName}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, emergencyContactName: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Emergency contact phone">
                      <Input
                        value={editForm.emergencyContactPhone}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, emergencyContactPhone: event.target.value }))
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Notes">
                    <Textarea
                      value={editForm.notes}
                      onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit">
                      Save patient
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => handleSharePatient(selectedPatient)}>
                      <Share2 className="h-4 w-4" />
                      Share
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => handleDeletePatient(selectedPatient)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </form>
              </Card>
            ) : (
              <Card className="shadow-elevated">
                <CardHeader
                  eyebrow="Selection"
                  title="Choose a patient"
                  description="Pick a patient from the table to edit the record or start a new one from the add action."
                />
                <div className="rounded-[28px] border border-dashed border-line bg-surface-2 px-6 py-10 text-center text-sm text-muted">
                  <Users className="mx-auto mb-3 h-8 w-8 text-muted/50" />
                  No patient is selected right now.
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
