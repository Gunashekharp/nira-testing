import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  PencilLine,
  Search,
  Share2,
  UserRoundPlus
} from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../components/ui/FormFields";
import { ManagementActionButton, ManagementTable } from "../../components/ui/ManagementTable";
import { ProfileAvatar } from "../../components/ui/ProfileAvatar";
import { useDemoData } from "../../app/DemoDataProvider";
import { getAdminWorkspace } from "../shared/selectors";
import { AvailabilityEditor } from "../shared/AvailabilityEditor";
import { matchesDirectoryQuery, shareDirectoryRecord } from "./adminDirectoryUtils";

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
    status: "active",
    acceptingAppointments: true,
    slotDurationMinutes: "15"
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

function getDoctorStatusTone(status) {
  if (status === "active") {
    return "success";
  }

  if (status === "pending_approval") {
    return "warning";
  }

  if (status === "archived") {
    return "danger";
  }

  return "neutral";
}

function buildDoctorShareText(doctor, user) {
  return [
    `Doctor: ${doctor.fullName}`,
    `Specialty: ${doctor.specialty || "Not set"}`,
    `Clinic: ${doctor.clinic || "Not set"}`,
    `Phone: ${user?.phone || "-"}`,
    `Email: ${user?.email || "-"}`,
    `Status: ${doctor.status.replaceAll("_", " ")}`
  ].join("\n");
}

export function AdminDoctorsPage() {
  const { state, actions } = useDemoData();
  const { doctors } = getAdminWorkspace(state);
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "all";
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState(doctors.length ? "edit" : "create");
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors[0]?.id || "");
  const [createForm, setCreateForm] = useState(emptyDoctorForm());
  const [editForm, setEditForm] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const doctorStatusFilters = [
    { key: "all", label: "All doctors" },
    { key: "pending_approval", label: "Pending" },
    { key: "active", label: "Active" },
    { key: "inactive", label: "Inactive" },
    { key: "archived", label: "Archived" }
  ];

  const filteredDoctors = useMemo(() => {
    return doctors.filter((doctor) => {
      const matchesStatus = statusFilter === "all" ? true : doctor.status === statusFilter;
      const matchesSearch = matchesDirectoryQuery(searchQuery, [
        doctor.fullName,
        doctor.specialty,
        doctor.clinic,
        doctor.email,
        doctor.phone
      ]);

      return matchesStatus && matchesSearch;
    });
  }, [doctors, searchQuery, statusFilter]);

  const selectedDoctor = state.doctors.byId[selectedDoctorId] || null;
  const selectedUser = selectedDoctor ? state.users.byId[selectedDoctor.userId] || null : null;
  const pendingDoctors = useMemo(
    () => doctors.filter((doctor) => doctor.status === "pending_approval"),
    [doctors]
  );

  useEffect(() => {
    if (selectedDoctor && selectedUser) {
      setEditForm(buildEditForm(selectedDoctor, selectedUser));
    }
  }, [selectedDoctor, selectedUser]);

  useEffect(() => {
    if (mode !== "edit") {
      return;
    }

    if (!filteredDoctors.length) {
      setSelectedDoctorId("");
      return;
    }

    if (!filteredDoctors.some((doctor) => doctor.id === selectedDoctorId)) {
      setSelectedDoctorId(filteredDoctors[0].id);
    }
  }, [filteredDoctors, mode, selectedDoctorId]);

  function handleStatusFilter(nextStatus) {
    setSearchParams(nextStatus === "all" ? {} : { status: nextStatus });
  }

  function handleSelectDoctor(doctorId) {
    setMode("edit");
    setSelectedDoctorId(doctorId);
    setFeedback("");
    setError("");
  }

  function handleStartCreate() {
    setMode("create");
    setSelectedDoctorId("");
    setCreateForm(emptyDoctorForm());
    setFeedback("");
    setError("");
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setFeedback("");

    try {
      const snapshot = await actions.admin.addDoctor(createForm);
      const createdDoctor = Object.values(snapshot.doctors.byId).find(
        (doctor) =>
          doctor.fullName === createForm.fullName &&
          String(snapshot.users.byId[doctor.userId]?.email || "").toLowerCase() === createForm.email.toLowerCase()
      );

      setCreateForm(emptyDoctorForm());
      setFeedback("Doctor account added to the clinic directory.");

      if (createdDoctor) {
        setMode("edit");
        setSelectedDoctorId(createdDoctor.id);
      }
    } catch (issue) {
      setError(issue.message);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!selectedDoctorId || !editForm) {
      return;
    }

    setError("");
    setFeedback("");

    try {
      await actions.admin.updateDoctor(selectedDoctorId, {
        ...editForm,
        slotDurationMinutes: Number(editForm.slotDurationMinutes)
      });
      setFeedback("Doctor profile updated.");
    } catch (issue) {
      setError(issue.message);
    }
  }

  async function handleShareDoctor(doctor) {
    setError("");

    try {
      const message = await shareDirectoryRecord({
        title: `${doctor.fullName} doctor record`,
        text: buildDoctorShareText(doctor, state.users.byId[doctor.userId])
      });
      setFeedback(message);
    } catch (issue) {
      setError(issue.message);
    }
  }

  async function handleArchiveDoctor(doctor) {
    const confirmed = window.confirm(
      `Archive ${doctor.fullName}? This is the safer admin action for doctors with schedule and appointment history.`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setFeedback("");

    try {
      await actions.admin.archiveDoctor(doctor.id);
      setFeedback(`${doctor.fullName} has been archived.`);
    } catch (issue) {
      setError(issue.message);
    }
  }

  return (
    <AppShell
      title="Doctor management"
      subtitle="Clickable management tables for admin review, safer archive actions, and a focused edit panel."
      actions={
        <Button type="button" onClick={handleStartCreate}>
          <UserRoundPlus className="h-4 w-4" />
          Add doctor
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

        <Card className="shadow-elevated">
          <CardHeader
            eyebrow="Approval queue"
            title={pendingDoctors.length ? "Doctor approvals waiting" : "Doctor approvals clear"}
            description="Pending signup requests stay visible here until an admin approves or rejects them."
          />
          {pendingDoctors.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {pendingDoctors.map((doctor) => (
                <div
                  key={doctor.id}
                  className="rounded-[28px] border border-amber-200 bg-amber-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-white p-2 text-amber-700 shadow-sm">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-ink">{doctor.fullName}</div>
                        <div className="mt-1 text-sm text-muted">{doctor.specialty || "Specialty not set"}</div>
                      </div>
                    </div>
                    <Badge tone="warning">Pending</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={async () => {
                        await actions.admin.approveDoctor(doctor.id);
                        setFeedback(`${doctor.fullName} approved and published.`);
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        await actions.admin.rejectDoctor(doctor.id);
                        setFeedback(`${doctor.fullName} moved to inactive.`);
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-line bg-surface-2 px-6 py-10 text-center text-sm text-muted">
              No pending doctor approvals right now.
            </div>
          )}
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <ManagementTable
            eyebrow="Doctor directory"
            title={`Clinic doctors (${filteredDoctors.length})`}
            description="Each row is clickable, and action buttons stay available for fast admin work."
            rows={filteredDoctors}
            selectedRowId={mode === "edit" ? selectedDoctorId : ""}
            onRowSelect={handleSelectDoctor}
            toolbar={
              <div className="flex max-w-[420px] flex-wrap justify-end gap-2">
                <div className="relative w-full sm:w-[260px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search doctor, specialty, clinic..."
                    className="pl-9"
                  />
                </div>
                {doctorStatusFilters.map((item) => (
                  <Button
                    key={item.key}
                    type="button"
                    size="sm"
                    variant={statusFilter === item.key ? "primary" : "secondary"}
                    onClick={() => handleStatusFilter(item.key)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            }
            columns={[
              {
                key: "doctor",
                header: "Doctor",
                cellClassName: "min-w-[280px]",
                render: (doctor) => (
                  <div className="flex items-center gap-3">
                    <ProfileAvatar name={doctor.fullName} photo={doctor.profilePhoto} size="md" tone="soft" />
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-ink">{doctor.fullName}</div>
                      <div className="truncate text-xs text-muted">
                        {state.users.byId[doctor.userId]?.email || state.users.byId[doctor.userId]?.phone || "No contact"}
                      </div>
                    </div>
                  </div>
                )
              },
              {
                key: "specialty",
                header: "Specialty",
                cellClassName: "min-w-[170px]",
                render: (doctor) => (
                  <div>
                    <div className="font-medium text-ink">{doctor.specialty || "General"}</div>
                    <div className="text-xs text-muted">
                      License {doctor.licenseNumber || "pending"}
                    </div>
                  </div>
                )
              },
              {
                key: "clinic",
                header: "Clinic",
                cellClassName: "min-w-[180px]",
                render: (doctor) => (
                  <div>
                    <div className="font-medium text-ink">{doctor.clinic || "Clinic not set"}</div>
                    <div className="text-xs text-muted">
                      {doctor.slotDurationMinutes || 15} min slots
                    </div>
                  </div>
                )
              },
              {
                key: "status",
                header: "Status",
                cellClassName: "min-w-[140px]",
                render: (doctor) => (
                  <Badge tone={getDoctorStatusTone(doctor.status)}>
                    {doctor.status.replaceAll("_", " ")}
                  </Badge>
                )
              }
            ]}
            renderActions={(doctor) => (
              <>
                <ManagementActionButton
                  label={`Edit ${doctor.fullName}`}
                  onClick={() => handleSelectDoctor(doctor.id)}
                >
                  <PencilLine className="h-4 w-4" />
                </ManagementActionButton>
                <ManagementActionButton
                  label={`Share ${doctor.fullName}`}
                  onClick={() => handleShareDoctor(doctor)}
                >
                  <Share2 className="h-4 w-4" />
                </ManagementActionButton>
                <ManagementActionButton
                  label={`Archive ${doctor.fullName}`}
                  tone="danger"
                  onClick={() => handleArchiveDoctor(doctor)}
                >
                  <Archive className="h-4 w-4" />
                </ManagementActionButton>
              </>
            )}
            emptyTitle="No doctors match this view"
            emptyDescription="Try a different filter or add a new doctor account."
          />

          <div className="space-y-5">
            {mode === "create" ? (
              <Card className="shadow-elevated">
                <CardHeader
                  eyebrow="Add doctor"
                  title="Create a doctor account"
                  description="Use the same polished admin form for adding new providers to the live list."
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
                    <Field label="Specialty">
                      <Input
                        value={createForm.specialty}
                        onChange={(event) => setCreateForm((current) => ({ ...current, specialty: event.target.value }))}
                      />
                    </Field>
                    <Field label="License number">
                      <Input
                        value={createForm.licenseNumber}
                        onChange={(event) =>
                          setCreateForm((current) => ({ ...current, licenseNumber: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Clinic">
                      <Input
                        value={createForm.clinic}
                        onChange={(event) => setCreateForm((current) => ({ ...current, clinic: event.target.value }))}
                      />
                    </Field>
                    <Field label="Status">
                      <Select
                        value={createForm.status}
                        onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value }))}
                      >
                        <option value="active">Active immediately</option>
                        <option value="pending_approval">Pending approval</option>
                      </Select>
                    </Field>
                    <Field label="Accepting appointments">
                      <Select
                        value={createForm.acceptingAppointments ? "yes" : "no"}
                        onChange={(event) =>
                          setCreateForm((current) => ({
                            ...current,
                            acceptingAppointments: event.target.value === "yes"
                          }))
                        }
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </Select>
                    </Field>
                    <Field label="Slot duration">
                      <Select
                        value={createForm.slotDurationMinutes}
                        onChange={(event) =>
                          setCreateForm((current) => ({ ...current, slotDurationMinutes: event.target.value }))
                        }
                      >
                        <option value="15">15 minutes</option>
                        <option value="20">20 minutes</option>
                        <option value="30">30 minutes</option>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Bio">
                    <Textarea
                      value={createForm.bio}
                      onChange={(event) => setCreateForm((current) => ({ ...current, bio: event.target.value }))}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit">
                      <UserRoundPlus className="h-4 w-4" />
                      Add doctor account
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setCreateForm(emptyDoctorForm())}>
                      Reset form
                    </Button>
                  </div>
                </form>
              </Card>
            ) : selectedDoctor && editForm ? (
              <>
                <Card className="shadow-elevated">
                  <CardHeader
                    eyebrow="Edit doctor"
                    title={selectedDoctor.fullName}
                    description="Update doctor visibility, contact details, and booking behavior from one place."
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
                      <Field label="Specialty">
                        <Input
                          value={editForm.specialty}
                          onChange={(event) => setEditForm((current) => ({ ...current, specialty: event.target.value }))}
                        />
                      </Field>
                      <Field label="License number">
                        <Input
                          value={editForm.licenseNumber}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, licenseNumber: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Status">
                        <Select
                          value={editForm.status}
                          onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                        >
                          <option value="active">Active</option>
                          <option value="pending_approval">Pending approval</option>
                          <option value="inactive">Inactive</option>
                          <option value="archived">Archived</option>
                        </Select>
                      </Field>
                      <Field label="Accepting appointments">
                        <Select
                          value={editForm.acceptingAppointments ? "yes" : "no"}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              acceptingAppointments: event.target.value === "yes"
                            }))
                          }
                        >
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </Select>
                      </Field>
                      <Field label="Slot duration">
                        <Select
                          value={editForm.slotDurationMinutes}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, slotDurationMinutes: event.target.value }))
                          }
                        >
                          <option value="15">15 minutes</option>
                          <option value="20">20 minutes</option>
                          <option value="30">30 minutes</option>
                        </Select>
                      </Field>
                    </div>
                    <Field label="Clinic">
                      <Input
                        value={editForm.clinic}
                        onChange={(event) => setEditForm((current) => ({ ...current, clinic: event.target.value }))}
                      />
                    </Field>
                    <Field label="Bio">
                      <Textarea
                        value={editForm.bio}
                        onChange={(event) => setEditForm((current) => ({ ...current, bio: event.target.value }))}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-3">
                      <Button type="submit">
                        Save doctor
                      </Button>
                      {selectedDoctor.status === "pending_approval" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={async () => {
                            await actions.admin.approveDoctor(selectedDoctor.id);
                            setFeedback(`${selectedDoctor.fullName} approved and published.`);
                          }}
                        >
                          Approve now
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={async () => {
                          await actions.admin.deactivateDoctor(selectedDoctor.id);
                          setFeedback(`${selectedDoctor.fullName} moved to inactive.`);
                        }}
                      >
                        Deactivate
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleArchiveDoctor(selectedDoctor)}
                      >
                        Archive
                      </Button>
                    </div>
                  </form>
                </Card>

                <AvailabilityEditor
                  doctor={selectedDoctor}
                  state={state}
                  title={`${selectedDoctor.fullName} schedule`}
                  description="Schedule controls stay directly under the selected doctor so the admin flow feels connected."
                  onSaveTemplate={(payload) => actions.admin.updateDoctorAvailability(selectedDoctor.id, payload)}
                  onSaveOverride={(payload) => actions.admin.updateScheduleOverride(selectedDoctor.id, payload)}
                  onToggleSlot={(doctorId, date, slotId, nextStatus) =>
                    actions.doctor.toggleSlotAvailability(doctorId, date, slotId, nextStatus)
                  }
                />
              </>
            ) : (
              <Card className="shadow-elevated">
                <CardHeader
                  eyebrow="Selection"
                  title="Choose a doctor"
                  description="Select a doctor from the table to edit details or schedule settings."
                />
                <div className="rounded-[28px] border border-dashed border-line bg-surface-2 px-6 py-10 text-center text-sm text-muted">
                  No doctor is selected right now.
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
