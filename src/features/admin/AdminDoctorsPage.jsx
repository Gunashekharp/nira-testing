import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../components/ui/FormFields";
import { useDemoData } from "../../app/DemoDataProvider";
import { getAdminWorkspace } from "../shared/selectors";
import { AvailabilityEditor } from "../shared/AvailabilityEditor";

function emptyDoctorForm() {
  return {
    fullName: "",
    phone: "",
    email: "",
    password: "Doctor@123",
    specialty: "",
    licenseNumber: "",
    clinic: "NIRA Pilot Clinic",
    bio: "",
    gender: "",
    status: "active"
  };
}

function buildEditForm(doctor, user) {
  return {
    fullName: doctor.fullName || "",
    phone: user.phone || "",
    email: user.email || "",
    specialty: doctor.specialty || "",
    licenseNumber: doctor.licenseNumber || "",
    clinic: doctor.clinic || "",
    bio: doctor.bio || "",
    gender: doctor.gender || "",
    status: doctor.status,
    acceptingAppointments: doctor.acceptingAppointments,
    slotDurationMinutes: String(doctor.slotDurationMinutes || 15)
  };
}

export function AdminDoctorsPage() {
  const { state, actions } = useDemoData();
  const { doctors } = getAdminWorkspace(state);
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors[0]?.id || "");
  const [createForm, setCreateForm] = useState(emptyDoctorForm());
  const selectedDoctor = state.doctors.byId[selectedDoctorId];
  const selectedUser = selectedDoctor ? state.users.byId[selectedDoctor.userId] : null;
  const [editForm, setEditForm] = useState(() => (selectedDoctor ? buildEditForm(selectedDoctor, selectedUser) : null));

  useEffect(() => {
    if (selectedDoctor && selectedUser) {
      setEditForm(buildEditForm(selectedDoctor, selectedUser));
    }
  }, [selectedDoctorId, selectedDoctor?.status, selectedUser?.email]);

  const pendingDoctors = useMemo(() => doctors.filter((doctor) => doctor.status === "pending_approval"), [doctors]);

  async function handleCreate(event) {
    event.preventDefault();
    await actions.admin.addDoctor(createForm);
    setCreateForm(emptyDoctorForm());
  }

  async function handleUpdate(event) {
    event.preventDefault();
    await actions.admin.updateDoctor(selectedDoctorId, {
      ...editForm,
      slotDurationMinutes: Number(editForm.slotDurationMinutes)
    });
  }

  return (
    <AppShell
      title="Doctor management"
      subtitle="Add, edit, approve, deactivate, archive, and manage schedules for every doctor visible in the clinic."
      languageLabel="Admin UI in English"
    >
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader
              eyebrow="Add doctor"
              title="Create a doctor account"
              description="Admin-created doctors can go live immediately or be kept pending."
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
                <Field label="Specialty">
                  <Input value={createForm.specialty} onChange={(event) => setCreateForm((current) => ({ ...current, specialty: event.target.value }))} />
                </Field>
                <Field label="License number">
                  <Input value={createForm.licenseNumber} onChange={(event) => setCreateForm((current) => ({ ...current, licenseNumber: event.target.value }))} />
                </Field>
                <Field label="Status">
                  <Select value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value }))}>
                    <option value="active">Active immediately</option>
                    <option value="pending_approval">Pending approval</option>
                  </Select>
                </Field>
                <Field label="Clinic">
                  <Input value={createForm.clinic} onChange={(event) => setCreateForm((current) => ({ ...current, clinic: event.target.value }))} />
                </Field>
              </div>
              <Field label="Bio">
                <Textarea value={createForm.bio} onChange={(event) => setCreateForm((current) => ({ ...current, bio: event.target.value }))} />
              </Field>
              <Button type="submit">Add doctor</Button>
            </form>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Pending approvals"
              title={pendingDoctors.length ? "Doctor approval queue" : "No pending doctors"}
              description="Public doctor signups appear here until an admin approves or rejects them."
            />
            <div className="space-y-3">
              {pendingDoctors.map((doctor) => (
                <div key={doctor.id} className="rounded-[22px] border border-line bg-surface-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-ink">{doctor.fullName}</div>
                      <div className="mt-1 text-sm text-muted">{doctor.specialty}</div>
                    </div>
                    <Badge tone="warning">Pending</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button size="sm" onClick={() => actions.admin.approveDoctor(doctor.id)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => actions.admin.rejectDoctor(doctor.id)}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <Card>
            <CardHeader
              eyebrow="Doctor list"
              title="Clinic doctors"
              description="Select a doctor to edit profile fields and schedule rules."
            />
            <div className="space-y-3">
              {doctors.map((doctor) => (
                <button
                  key={doctor.id}
                  type="button"
                  onClick={() => setSelectedDoctorId(doctor.id)}
                  className={`w-full rounded-[22px] border p-4 text-left transition ${
                    selectedDoctorId === doctor.id ? "border-cyan-300 bg-brand-mint" : "border-line bg-surface-2 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-ink">{doctor.fullName}</div>
                      <div className="mt-1 text-xs text-muted">{doctor.specialty}</div>
                    </div>
                    <Badge tone={doctor.status === "active" ? "success" : doctor.status === "pending_approval" ? "warning" : "danger"}>
                      {doctor.status}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {selectedDoctor && editForm ? (
            <div className="space-y-6">
              <Card>
                <CardHeader
                  eyebrow="Edit doctor"
                  title={selectedDoctor.fullName}
                  description="Update profile details, activation status, and booking visibility."
                />
                <form className="grid gap-4" onSubmit={handleUpdate}>
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
                    <Field label="Specialty">
                      <Input value={editForm.specialty} onChange={(event) => setEditForm((current) => ({ ...current, specialty: event.target.value }))} />
                    </Field>
                    <Field label="License number">
                      <Input value={editForm.licenseNumber} onChange={(event) => setEditForm((current) => ({ ...current, licenseNumber: event.target.value }))} />
                    </Field>
                    <Field label="Status">
                      <Select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}>
                        <option value="active">Active</option>
                        <option value="pending_approval">Pending</option>
                        <option value="inactive">Inactive</option>
                        <option value="archived">Archived</option>
                      </Select>
                    </Field>
                    <Field label="Accepting appointments">
                      <Select
                        value={editForm.acceptingAppointments ? "yes" : "no"}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, acceptingAppointments: event.target.value === "yes" }))
                        }
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </Select>
                    </Field>
                    <Field label="Slot duration">
                      <Select
                        value={editForm.slotDurationMinutes}
                        onChange={(event) => setEditForm((current) => ({ ...current, slotDurationMinutes: event.target.value }))}
                      >
                        <option value="15">15 minutes</option>
                        <option value="20">20 minutes</option>
                        <option value="30">30 minutes</option>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Bio">
                    <Textarea value={editForm.bio} onChange={(event) => setEditForm((current) => ({ ...current, bio: event.target.value }))} />
                  </Field>
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit">Save doctor</Button>
                    {selectedDoctor.status === "pending_approval" ? (
                      <Button type="button" variant="secondary" onClick={() => actions.admin.approveDoctor(selectedDoctor.id)}>
                        Approve now
                      </Button>
                    ) : null}
                    <Button type="button" variant="secondary" onClick={() => actions.admin.deactivateDoctor(selectedDoctor.id)}>
                      Deactivate
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => actions.admin.archiveDoctor(selectedDoctor.id)}>
                      Archive
                    </Button>
                  </div>
                </form>
              </Card>

              <AvailabilityEditor
                doctor={selectedDoctor}
                state={state}
                title={`${selectedDoctor.fullName} schedule`}
                description="Admin and doctor schedule tools share the same behavior and data model."
                onSaveTemplate={(payload) => actions.admin.updateDoctorAvailability(selectedDoctor.id, payload)}
                onSaveOverride={(payload) => actions.admin.updateScheduleOverride(selectedDoctor.id, payload)}
                onToggleSlot={(doctorId, date, slotId, nextStatus) =>
                  actions.doctor.toggleSlotAvailability(doctorId, date, slotId, nextStatus)
                }
              />
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
