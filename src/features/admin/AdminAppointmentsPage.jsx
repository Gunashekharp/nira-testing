import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Select } from "../../components/ui/FormFields";
import { useDemoData } from "../../app/DemoDataProvider";
import { getAdminWorkspace, getBookableDoctors, getScheduleByDate } from "../shared/selectors";
import { formatDate, formatStatus, formatTime } from "../../lib/format";
import { getDateRange } from "../../lib/schedule";

export function AdminAppointmentsPage() {
  const { state, actions } = useDemoData();
  const { appointments } = getAdminWorkspace(state);
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "all";
  const filteredAppointments = useMemo(() => {
    if (statusFilter === "all") {
      return appointments;
    }

    if (statusFilter === "active") {
      return appointments.filter((appointment) => ["scheduled", "rescheduled", "checked_in"].includes(appointment.bookingStatus));
    }

    return appointments.filter((appointment) => appointment.bookingStatus === statusFilter);
  }, [appointments, statusFilter]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(filteredAppointments[0]?.id || appointments[0]?.id || "");
  const selectedAppointment = state.appointments.byId[selectedAppointmentId];
  const activeDoctors = useMemo(() => getBookableDoctors(state), [state]);
  const [doctorId, setDoctorId] = useState(selectedAppointment?.doctorId || activeDoctors[0]?.id || "");
  const [date, setDate] = useState(state.meta.today);
  const [slotId, setSlotId] = useState("");
  const appointmentFilters = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" }
  ];

  const dateOptions = useMemo(() => getDateRange(state.meta.today, 14), [state.meta.today]);
  const schedules = useMemo(
    () => dateOptions.map((entry) => ({ date: entry, schedule: doctorId ? getScheduleByDate(state, doctorId, entry) : null })),
    [state, doctorId, dateOptions]
  );
  const selectedSchedule = doctorId ? getScheduleByDate(state, doctorId, date) : null;

  useEffect(() => {
    if (!selectedAppointment) {
      return;
    }

    setDoctorId(selectedAppointment.doctorId);
    setDate(selectedAppointment.startAt.slice(0, 10));
  }, [selectedAppointmentId]);

  useEffect(() => {
    if (!filteredAppointments.length) {
      setSelectedAppointmentId("");
      return;
    }

    if (!filteredAppointments.some((appointment) => appointment.id === selectedAppointmentId)) {
      setSelectedAppointmentId(filteredAppointments[0].id);
    }
  }, [filteredAppointments, selectedAppointmentId]);

  useEffect(() => {
    const nextAvailable = selectedSchedule?.slots.find((slot) => slot.status === "available");
    setSlotId(nextAvailable?.id || "");
  }, [selectedSchedule?.id, date, doctorId]);

  async function handleReschedule() {
    if (!selectedAppointmentId || !doctorId || !slotId) {
      return;
    }

    await actions.admin.rescheduleAppointment(selectedAppointmentId, {
      doctorId,
      date,
      slotId
    });
  }

  function handleStatusFilter(nextStatus) {
    setSearchParams(nextStatus === "all" ? {} : { status: nextStatus });
  }

  return (
    <AppShell
      title="Appointment oversight"
      subtitle="Cancel or reschedule appointments while keeping doctor and patient slot views consistent across the frontend."
      languageLabel="Admin UI in English"
    >
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader
            eyebrow="Appointments"
            title={`Operational list (${filteredAppointments.length})`}
            description="Select an appointment to cancel or move it to another open slot."
          />
          <div className="mb-4 flex flex-wrap gap-2">
            {appointmentFilters.map((item) => (
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
          <div className="space-y-3">
            {filteredAppointments.map((appointment) => {
              const patient = state.patients.byId[appointment.patientId];
              const doctor = state.doctors.byId[appointment.doctorId];
              return (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={() => setSelectedAppointmentId(appointment.id)}
                  className={`w-full rounded-[22px] border p-4 text-left transition ${
                    selectedAppointmentId === appointment.id ? "border-cyan-300 bg-brand-mint" : "border-line bg-surface-2 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-ink">{patient?.fullName}</div>
                      <div className="mt-1 text-xs text-muted">
                        {doctor?.fullName} · {formatDate(appointment.startAt)} · {formatTime(appointment.startAt)}
                      </div>
                    </div>
                    <Badge tone={appointment.bookingStatus === "cancelled" ? "danger" : "info"}>
                      {formatStatus(appointment.bookingStatus)}
                    </Badge>
                  </div>
                </button>
              );
            })}
            {!filteredAppointments.length ? (
              <div className="rounded-[22px] border border-dashed border-line bg-surface-2 p-6 text-sm text-muted">
                No appointments match this filter right now.
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Reschedule"
            title={selectedAppointment ? "Move appointment" : "Select an appointment"}
            description="Choose a doctor, date, and open slot. Cancelled appointments can stay in history without being deleted."
          />
          {selectedAppointment ? (
            <div className="space-y-5">
              <div className="rounded-[24px] border border-line bg-surface-2 p-5 text-sm text-muted">
                Current booking:{" "}
                <span className="font-semibold text-ink">
                  {formatDate(selectedAppointment.startAt)} at {formatTime(selectedAppointment.startAt)}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Doctor">
                  <Select value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
                    {activeDoctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.fullName} · {doctor.specialty}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Date">
                  <Select value={date} onChange={(event) => setDate(event.target.value)}>
                    {schedules.map((entry) => (
                      <option key={entry.date} value={entry.date}>
                        {formatDate(`${entry.date}T00:00:00+05:30`)} ({entry.schedule?.slotSummary.available || 0})
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(selectedSchedule?.slots || []).map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={slot.status !== "available"}
                    onClick={() => setSlotId(slot.id)}
                    className={`rounded-[22px] border px-4 py-4 text-left transition ${
                      slotId === slot.id
                        ? "border-cyan-300 bg-brand-mint"
                        : slot.status === "available"
                          ? "border-emerald-200 bg-emerald-50"
                          : slot.status === "booked"
                            ? "border-cyan-200 bg-cyan-50"
                            : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <div className="text-sm font-semibold">
                      {formatTime(slot.startAt)} - {formatTime(slot.endAt)}
                    </div>
                    <div className="mt-2 text-xs uppercase tracking-[0.18em] opacity-70">{slot.status}</div>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleReschedule} disabled={!slotId || selectedAppointment.bookingStatus === "cancelled"}>
                  Reschedule appointment
                </Button>
                <Button variant="secondary" onClick={() => actions.admin.cancelAppointment(selectedAppointmentId)}>
                  Cancel appointment
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
