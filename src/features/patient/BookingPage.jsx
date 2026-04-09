import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarClock, CheckCircle2, Stethoscope } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Select } from "../../components/ui/FormFields";
import { LanguageToggle } from "../../components/ui/LanguageToggle";
import { useDemoData } from "../../app/DemoDataProvider";
import { getBookableDoctors, getPatientWorkspace, getScheduleByDate } from "../shared/selectors";
import { formatDate, formatDayKey, formatTime } from "../../lib/format";
import { getDateRange } from "../../lib/schedule";
import { usePatientLanguage } from "./usePatientLanguage";

export function BookingPage() {
  const { state, session, actions } = useDemoData();
  const navigate = useNavigate();
  const { patient } = getPatientWorkspace(state);
  const [language, setLanguage] = usePatientLanguage(patient?.preferredLanguage || "en");
  const doctors = useMemo(() => getBookableDoctors(state), [state]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors[0]?.id || "");
  const [selectedDate, setSelectedDate] = useState(state.meta.today);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [visitType, setVisitType] = useState("booked");
  const [submitting, setSubmitting] = useState(false);
  const [confirmationId, setConfirmationId] = useState("");

  const doctor = doctors.find((item) => item.id === selectedDoctorId) || null;
  const dateOptions = useMemo(() => getDateRange(state.meta.today, 14), [state.meta.today]);
  const schedules = useMemo(
    () =>
      doctor
        ? dateOptions.map((date) => ({
            date,
            schedule: getScheduleByDate(state, doctor.id, date)
          }))
        : [],
    [state, doctor, dateOptions]
  );
  const selectedSchedule = doctor ? getScheduleByDate(state, doctor.id, selectedDate) : null;
  const confirmationBundle = confirmationId ? state.appointments.byId[confirmationId] : null;

  useEffect(() => {
    if (!doctor) {
      return;
    }

    const nextWithAvailability = schedules.find((entry) => entry.schedule?.slotSummary.available > 0);
    setSelectedDate(nextWithAvailability?.date || state.meta.today);
  }, [doctor?.id]);

  useEffect(() => {
    const nextAvailable = selectedSchedule?.slots.find((slot) => slot.status === "available");
    setSelectedSlotId(nextAvailable?.id || "");
  }, [selectedDate, selectedSchedule?.id, selectedDoctorId]);

  async function handleBooking() {
    if (!selectedSlotId || !doctor) {
      return;
    }

    setSubmitting(true);
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
    setSubmitting(false);
  }

  return (
    <AppShell
      title="Book by live doctor slots"
      subtitle="Choose an active doctor, review the next 14 days of availability, and confirm only from open slots."
      languageLabel="Patient booking in English / Hindi"
    >
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <Card>
            <CardHeader
              eyebrow="Step 1"
              title="Choose your doctor"
              description="Only active doctors who are currently accepting appointments appear here."
            />
            <div className="grid gap-4 md:grid-cols-2">
              {doctors.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedDoctorId(entry.id)}
                  className={`rounded-[24px] border p-5 text-left transition ${
                    selectedDoctorId === entry.id ? "border-cyan-300 bg-brand-mint shadow-soft" : "border-line bg-surface-2 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-ink">{entry.fullName}</div>
                      <div className="mt-1 text-sm text-muted">{entry.specialty}</div>
                    </div>
                    <Stethoscope className="h-5 w-5 text-brand-tide" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone={entry.nextAvailableSlot ? "success" : "warning"}>
                      {entry.availabilityLabel}
                    </Badge>
                    {entry.nextAvailableSlot ? (
                      <Badge tone="info">
                        Next: {formatDayKey(entry.nextAvailableSlot.date)} {formatTime(entry.nextAvailableSlot.startAt)}
                      </Badge>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Step 2"
              title="Booking preferences"
              description="Pick the interview language and visit type before confirming the slot."
            />
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="pill">Booking for {patient.fullName}</div>
                <LanguageToggle value={language} onChange={setLanguage} />
              </div>
              <Field label="Visit type">
                <Select value={visitType} onChange={(event) => setVisitType(event.target.value)}>
                  <option value="booked">Booked</option>
                  <option value="walk_in">Walk-in</option>
                </Select>
              </Field>
              <div className="rounded-[24px] border border-line bg-surface-2 p-5 text-sm leading-6 text-muted">
                After booking, NIRA creates a pending interview and encounter skeleton immediately so the APCI flow can continue without backend integration.
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader
            eyebrow="Step 3"
            title="Choose date and slot"
            description="See the next 14 days from the selected doctor's resolved schedule, including booked and unavailable states."
          />
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {schedules.map(({ date, schedule }) => (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    selectedDate === date
                      ? "border-cyan-300 bg-brand-mint text-ink"
                      : "border-line bg-white/80 text-muted hover:bg-white"
                  }`}
                >
                  {formatDate(`${date}T00:00:00+05:30`)}{" "}
                  {schedule?.slotSummary.available ? `(${schedule.slotSummary.available})` : "(0)"}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
              {(selectedSchedule?.slots || []).map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  disabled={slot.status !== "available"}
                  onClick={() => setSelectedSlotId(slot.id)}
                  className={`rounded-[22px] border px-4 py-4 text-left transition ${
                    selectedSlotId === slot.id
                      ? "border-cyan-300 bg-brand-mint"
                      : slot.status === "available"
                        ? "border-emerald-200 bg-emerald-50 hover:-translate-y-0.5"
                        : slot.status === "booked"
                          ? "border-cyan-200 bg-cyan-50 text-cyan-900"
                          : "border-amber-200 bg-amber-50 text-amber-900"
                  } disabled:cursor-not-allowed disabled:opacity-100`}
                >
                  <div className="text-sm font-semibold">
                    {formatTime(slot.startAt)} - {formatTime(slot.endAt)}
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.18em] opacity-70">{slot.status}</div>
                </button>
              ))}
            </div>

            {!selectedSchedule?.slots?.length ? (
              <div className="rounded-[24px] border border-dashed border-line bg-surface-2 p-6 text-sm text-muted">
                This day has no generated slots. Choose another date or a different doctor.
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Step 4"
            title={confirmationBundle ? "Appointment created" : "Confirm appointment"}
            description={
              confirmationBundle
                ? "The booking, interview shell, and encounter shell are now ready."
                : "Only available slots can be confirmed. Booked and unavailable slots stay disabled."
            }
          />
          {confirmationBundle ? (
            <div className="space-y-4">
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-700" />
                  <div>
                    <div className="text-sm font-semibold text-emerald-900">
                      Token {confirmationBundle.token} confirmed
                    </div>
                    <div className="mt-1 text-sm text-emerald-800">
                      Your slot is booked for {formatDate(confirmationBundle.startAt)} at {formatTime(confirmationBundle.startAt)}.
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => navigate(`/patient/interview/${confirmationBundle.id}`)}>Start AI interview</Button>
                <Button asChild variant="secondary">
                  <Link to={`/patient/appointments/${confirmationBundle.id}?bucket=action`}>View appointment detail</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link to="/patient">Back home</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="rounded-[24px] border border-line bg-surface-2 p-5 text-sm text-muted">
                {doctor ? (
                  <>
                    Booking with <span className="font-semibold text-ink">{doctor.fullName}</span> on{" "}
                    <span className="font-semibold text-ink">{formatDate(`${selectedDate}T00:00:00+05:30`)}</span>.
                  </>
                ) : (
                  "Select a doctor to continue."
                )}
              </div>
              <Button onClick={handleBooking} disabled={!selectedSlotId || submitting}>
                {submitting ? "Creating appointment..." : "Confirm slot"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
