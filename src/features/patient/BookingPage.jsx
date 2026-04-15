import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarCheck2, CalendarClock, CheckCircle2, FileText, Star, UserCircle2 } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input, Select } from "../../components/ui/FormFields";
import { useDemoData } from "../../app/DemoDataProvider";
import { getBookableDoctors, getPatientWorkspace, getScheduleByDate } from "../shared/selectors";
import { formatDate, formatDayKey, formatTime } from "../../lib/format";
import { getDateRange, getTodayDayKey } from "../../lib/schedule";
import { usePatientLanguage } from "./usePatientLanguage";

function getDoctorRating(doctorId) {
  if (!doctorId) {
    return "4.8";
  }

  const tail = doctorId.charCodeAt(doctorId.length - 1) % 3;
  return (4.7 + tail * 0.1).toFixed(1);
}

function getSlotStartTimeMs(slot) {
  const startTimeMs = new Date(slot?.startAt || "").getTime();
  if (Number.isFinite(startTimeMs)) {
    return startTimeMs;
  }

  const endTimeMs = new Date(slot?.endAt || "").getTime();
  return Number.isFinite(endTimeMs) ? endTimeMs : Number.NaN;
}

function isLiveAvailableSlot(slot, referenceMs = Date.now()) {
  if (!slot || slot.status !== "available") {
    return false;
  }

  const startTimeMs = getSlotStartTimeMs(slot);
  return Number.isFinite(startTimeMs) && startTimeMs >= referenceMs;
}

function getLiveAvailableSlots(schedule, referenceMs = Date.now()) {
  return (schedule?.slots || []).filter((slot) => isLiveAvailableSlot(slot, referenceMs));
}

export function BookingPage() {
  const { state, session, actions } = useDemoData();
  const [searchParams] = useSearchParams();
  const { patient } = getPatientWorkspace(state);
  const [language] = usePatientLanguage(patient?.preferredLanguage || "en");
  const preferredDoctorId = searchParams.get("doctorId") || "";
  const rescheduleAppointmentId = searchParams.get("rescheduleAppointmentId") || "";
  const rescheduleAppointment = rescheduleAppointmentId ? state.appointments.byId[rescheduleAppointmentId] || null : null;
  const isRescheduleMode = Boolean(rescheduleAppointment);
  const doctors = useMemo(() => {
    const bookableDoctors = getBookableDoctors(state);
    const lockedDoctorId = isRescheduleMode ? rescheduleAppointment?.doctorId : preferredDoctorId;

    if (!lockedDoctorId) {
      return bookableDoctors;
    }

    if (bookableDoctors.some((entry) => entry.id === lockedDoctorId)) {
      return bookableDoctors;
    }

    const lockedDoctor = state.doctors.byId[lockedDoctorId];
    if (!lockedDoctor) {
      return bookableDoctors;
    }

    return [
      {
        ...lockedDoctor,
        nextSchedule: null,
        nextAvailableSlot: null,
        availabilityLabel: "No live online slots right now"
      },
      ...bookableDoctors
    ];
  }, [isRescheduleMode, preferredDoctorId, rescheduleAppointment?.doctorId, state]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(
    () => (isRescheduleMode ? rescheduleAppointment?.doctorId : preferredDoctorId) || ""
  );
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [visitType, setVisitType] = useState("booked");
  const [submitting, setSubmitting] = useState(false);
  const [confirmationId, setConfirmationId] = useState("");

  const doctor = doctors.find((item) => item.id === selectedDoctorId) || null;
  const bookingWindowStart = useMemo(() => {
    const clinicToday = getTodayDayKey();
    return state.meta.today && state.meta.today > clinicToday ? state.meta.today : clinicToday;
  }, [state.meta.today]);
  const dateOptions = useMemo(() => getDateRange(bookingWindowStart, 14), [bookingWindowStart]);
  const schedules = useMemo(
    () => {
      if (!doctor) {
        return [];
      }

      const referenceMs = Date.now();

      return dateOptions
        .map((date) => {
          const schedule = getScheduleByDate(state, doctor.id, date);
          const liveSlots = getLiveAvailableSlots(schedule, referenceMs);

          return {
            date,
            schedule,
            liveSlots,
            availableCount: liveSlots.length
          };
        })
        .filter((entry) => entry.availableCount > 0);
    },
    [dateOptions, doctor, state]
  );
  const selectedScheduleEntry = schedules.find((entry) => entry.date === selectedDate) || null;
  const selectedSchedule = selectedScheduleEntry?.schedule || null;
  const selectedScheduleSlots = selectedScheduleEntry?.liveSlots || [];
  const selectedSlot = selectedScheduleSlots.find((slot) => slot.id === selectedSlotId) || null;
  const confirmationBundle = confirmationId ? state.appointments.byId[confirmationId] : null;
  const visibleDoctors = isRescheduleMode && doctor
    ? [doctor]
    : selectedDoctorId
      ? doctors.filter((entry) => entry.id === selectedDoctorId)
      : doctors;

  useEffect(() => {
    const lockedDoctorId = isRescheduleMode ? rescheduleAppointment?.doctorId : preferredDoctorId;

    if (lockedDoctorId && doctors.some((entry) => entry.id === lockedDoctorId)) {
      setSelectedDoctorId(lockedDoctorId);
    }
  }, [doctors, isRescheduleMode, preferredDoctorId, rescheduleAppointment?.doctorId]);

  useEffect(() => {
    if (!doctor) {
      setSelectedDate("");
      setSelectedSlotId("");
      return;
    }

    const nextWithAvailability = schedules[0] || null;
    const preferredDate = isRescheduleMode && rescheduleAppointment?.doctorId === doctor.id
      ? nextWithAvailability?.date || ""
      : nextWithAvailability?.date || "";

    setSelectedDate(preferredDate);
    setSelectedSlotId("");
  }, [doctor?.id, isRescheduleMode, rescheduleAppointment?.doctorId, schedules]);

  useEffect(() => {
    setSelectedSlotId("");
  }, [selectedDate, selectedDoctorId, selectedSchedule?.id]);

  function openPrecheckForAppointment(appointment) {
    if (!appointment || typeof window === "undefined") {
      return;
    }

    const appointmentDoctor = state.doctors.byId[appointment.doctorId] || null;

    window.dispatchEvent(new CustomEvent("nira:open-precheck", {
      detail: {
        appointmentId: appointment.id,
        doctorName: appointmentDoctor?.fullName,
        specialty: appointmentDoctor?.specialty,
        startAt: appointment.startAt,
        hasDoctorQuestions: appointment?.precheckQuestionnaire?.status === "sent_to_patient"
      }
    }));
  }

  async function handleBooking() {
    if (!selectedSlotId || !selectedDate || !doctor) {
      return;
    }

    setSubmitting(true);

    try {
      if (isRescheduleMode && rescheduleAppointment) {
        await actions.booking.rescheduleAppointment(rescheduleAppointment.id, {
          doctorId: doctor.id,
          date: selectedDate,
          slotId: selectedSlotId
        });
        setConfirmationId(rescheduleAppointment.id);
        return;
      }

      const snapshot = await actions.booking.bookAppointment({
        patientId: patient.id,
        doctorId: doctor.id,
        slotId: selectedSlotId,
        date: selectedDate,
        bookedByUserId: session.userId,
        visitType,
        language
      });

      setConfirmationId(snapshot.ui.lastViewedAppointmentId);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Book by live doctor slots"
      subtitle={
        isRescheduleMode
          ? "Reschedule with the same doctor by picking a fresh live slot."
          : "Doctor cards, live teal slots, and a one-tap confirmation flow."
      }
    >
      <div className="space-y-4">
        <Card density="compact">
          <CardHeader
            eyebrow="Doctor list"
            title={isRescheduleMode ? "Same doctor, fresh slot" : "Choose your doctor"}
            description={
              isRescheduleMode
                ? "This reschedule flow keeps the original doctor and only updates the slot."
                : "Goal: 30-second booking"
            }
          />
          {selectedDoctorId && !isRescheduleMode ? (
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedDoctorId("")}>
                Change doctor
              </Button>
            </div>
          ) : null}
          {isRescheduleMode && doctor ? (
            <div className="mb-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">
              Rescheduling stays with <span className="font-semibold">{doctor.fullName}</span>. To change doctors, book a new appointment instead of rescheduling this one.
            </div>
          ) : null}
          <div className={`grid gap-3 ${selectedDoctorId ? "" : "lg:grid-cols-2"}`}>
            {visibleDoctors.map((entry) => {
              const quickSlots = getDateRange(bookingWindowStart, 14)
                .map((date) => getScheduleByDate(state, entry.id, date))
                .flatMap((schedule) => getLiveAvailableSlots(schedule))
                .slice(0, 3);
              const isSelected = selectedDoctorId === entry.id;

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    if (!isRescheduleMode) {
                      setSelectedDoctorId(entry.id);
                    }
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? "border-brand-sky bg-brand-mint p-5 shadow-soft ring-2 ring-brand-sky/30"
                      : "border-line bg-surface-2 hover:bg-white"
                  }`}
                  disabled={isRescheduleMode}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-white p-2 text-brand-tide shadow-sm">
                        <UserCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-base font-semibold text-ink">{entry.fullName}</div>
                        <div className="mt-1 text-sm text-muted">{entry.specialty || "General"}</div>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink">
                      <Star className="h-3.5 w-3.5 text-amber-500" /> {getDoctorRating(entry.id)}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2" aria-hidden="true">
                    {quickSlots.length ? (
                      quickSlots.map((slot) => (
                        <span
                          key={slot.id}
                          className="rounded-full bg-brand-sky px-2.5 py-1 text-[11px] font-semibold text-white"
                        >
                          {formatTime(slot.startAt)}
                        </span>
                      ))
                    ) : (
                      <Badge tone="warning">FULL</Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card density="compact">
          <CardHeader
            eyebrow="Pick date & slot"
            title="Live availability"
            description="Only available slots can be selected."
          />
          <div className="space-y-4">
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <div className="inline-flex min-w-full gap-2 sm:flex sm:flex-wrap">
                {schedules.map(({ date, availableCount }) => (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className={`whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold transition sm:px-4 ${
                      selectedDate === date
                        ? "border-brand-sky bg-brand-mint text-ink"
                        : "border-line bg-white text-muted hover:bg-surface-2"
                    }`}
                  >
                    {formatDayKey(date)} ({availableCount})
                  </button>
                ))}
              </div>
            </div>

            {!schedules.length ? (
              <div className="rounded-xl border border-dashed border-line bg-surface-2 p-4 text-sm text-muted">
                No live upcoming slots are currently available for this doctor in the next 14 days.
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {selectedScheduleSlots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  disabled={slot.status !== "available"}
                  onClick={() => setSelectedSlotId(slot.id)}
                  className={`rounded-xl border px-2.5 py-2.5 text-xs font-semibold transition sm:px-3 sm:text-sm ${
                    selectedSlotId === slot.id
                      ? "border-brand-sky bg-brand-sky text-white"
                      : slot.status === "available"
                        ? "border-cyan-200 bg-cyan-50 text-ink hover:-translate-y-0.5"
                        : "border-line bg-surface-2 text-muted"
                  } disabled:cursor-not-allowed disabled:opacity-80`}
                >
                  {formatTime(slot.startAt)} - {formatTime(slot.endAt)}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <Card density="compact">
            <CardHeader
              eyebrow="Summary"
              title={doctor && selectedSlot ? `${doctor.fullName} - ${formatTime(selectedSlot.startAt)}` : "Select doctor and slot"}
              description="Minimal patient form, prefilled from profile."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name">
                <Input value={patient?.fullName || ""} readOnly />
              </Field>
              <Field label="Phone">
                <Input value={patient?.phone || ""} readOnly />
              </Field>
              {isRescheduleMode ? (
                <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">
                  This will update the current appointment instead of creating a second booking.
                </div>
              ) : (
                <Field label="Visit type">
                  <Select value={visitType} onChange={(event) => setVisitType(event.target.value)}>
                    <option value="booked">Booked</option>
                    <option value="walk_in">Walk-in</option>
                  </Select>
                </Field>
              )}
              <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm text-muted">
                {doctor ? (
                  <>
                    {doctor.fullName} · {selectedDate ? formatDate(`${selectedDate}T00:00:00+05:30`) : "Select date"}
                    {selectedSlot ? ` · ${formatTime(selectedSlot.startAt)}` : ""}
                  </>
                ) : (
                  "Choose a doctor and slot to continue."
                )}
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <Button onClick={handleBooking} disabled={!selectedSlotId || submitting} className="w-full sm:min-w-[220px]">
              <CalendarCheck2 className="h-4 w-4" />
              {submitting
                ? isRescheduleMode
                  ? "Rescheduling appointment..."
                  : "Creating appointment..."
                : isRescheduleMode
                  ? "Confirm reschedule"
                  : "Confirm slot"}
            </Button>
            <Button asChild variant="secondary" className="w-full sm:min-w-[220px]">
              <Link to="/patient/appointments">
                <CalendarClock className="h-4 w-4" />
                View appointments
              </Link>
            </Button>
          </div>
        </div>

        {confirmationBundle ? (
          <Card density="compact" className="border-emerald-200 bg-emerald-50">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-white p-2 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-semibold text-emerald-900">
                    {isRescheduleMode ? "Appointment rescheduled" : "Appointment created"}
                  </div>
                  <div className="text-sm text-emerald-800">
                    Token {confirmationBundle.token} confirmed for {formatDate(confirmationBundle.startAt)} at {formatTime(confirmationBundle.startAt)}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => openPrecheckForAppointment(confirmationBundle)}>
                  <FileText className="h-4 w-4" />
                  Start pre-check
                </Button>
                <Button asChild>
                  <Link to={`/patient/appointments/${confirmationBundle.id}?bucket=${isRescheduleMode ? "upcoming" : "action"}`}>
                    <FileText className="h-4 w-4" />
                    Open appointment
                  </Link>
                </Button>
              </div>
            </div>
            <div className="mt-3 text-sm text-emerald-900/90">
              You can complete your pre-check now so the doctor gets your responses before consultation.
            </div>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
