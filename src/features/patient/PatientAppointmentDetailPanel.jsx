import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FileText,
  ShieldCheck,
  TestTube
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { formatDate, formatStatus, formatTime } from "../../lib/format";
import { getPatientReschedulePath } from "../shared/selectors";

function getJourneyTone(bucket) {
  if (bucket === "action") {
    return "warning";
  }

  if (bucket === "review") {
    return "info";
  }

  if (bucket === "completed") {
    return "success";
  }

  if (bucket === "missed") {
    return "danger";
  }

  if (bucket === "cancelled") {
    return "danger";
  }

  return "neutral";
}

function buildTimeline(appointment) {
  const precheckDone =
    appointment.precheckQuestionnaire?.status === "completed"
    || ["complete", "completed"].includes(String(appointment.interview?.completionStatus || "").toLowerCase());
  const reviewStarted = ["ai_ready", "in_consult", "approved"].includes(appointment.encounterStatus) || appointment.encounterStatus === "review";
  const prescriptionReady = appointment.canViewPrescription;

  return [
    {
      label: "Booked",
      description: "Your slot is confirmed in the system.",
      active: true
    },
    {
      label: "Pre-check",
      description: precheckDone ? "Your pre-check answers are submitted and visible to doctor." : "Please complete the pending pre-check questions.",
      active: precheckDone,
      current: appointment.precheckQuestionnaire?.status === "sent_to_patient" || appointment.encounterStatus === "awaiting_interview"
    },
    {
      label: "Doctor review",
      description: reviewStarted ? "Doctor is reviewing or has reviewed the summary." : "Doctor review starts after the pre-check is submitted.",
      active: reviewStarted,
      current: ["ai_ready", "in_consult"].includes(appointment.encounterStatus)
    },
    {
      label: "Prescription",
      description: prescriptionReady ? "Prescription has been approved and shared." : "Prescription will appear after approval.",
      active: prescriptionReady,
      current: appointment.bookingStatus === "completed"
    }
  ];
}

export function PatientAppointmentDetailPanel({
  appointment,
  onCancel,
  showCancelledNotice = false,
  showBackToList = false
}) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const timeline = useMemo(() => (appointment ? buildTimeline(appointment) : []), [appointment]);
  const reschedulePath = appointment ? getPatientReschedulePath(appointment) : "/patient/booking";

  useEffect(() => {
    if (appointment?.bookingStatus === "cancelled") {
      setConfirmingCancel(false);
      setSubmittingCancel(false);
    }
  }, [appointment?.bookingStatus]);

  async function handleCancel() {
    if (!onCancel || !appointment?.canCancel) {
      return;
    }

    setSubmittingCancel(true);

    try {
      await onCancel(appointment.id);
    } finally {
      setSubmittingCancel(false);
    }
  }

  if (!appointment) {
    return (
      <Card>
        <CardHeader
          eyebrow="Appointment detail"
          title="Select an appointment"
          description="Choose an item from the left list to see visit status, care progress, and prescription outcome."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {showBackToList ? (
        <div className="lg:hidden">
          <Button asChild variant="secondary">
            <Link to={`/patient/appointments?bucket=${appointment.journeyBucket}`}>
              <ArrowLeft className="h-4 w-4" />
              All appointments
            </Link>
          </Button>
        </div>
      ) : null}

      {showCancelledNotice && appointment.bookingStatus === "cancelled" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 h-5 w-5 text-amber-700" />
            <div>
              <div className="text-sm font-semibold text-amber-950">Appointment cancelled</div>
              <div className="mt-1 text-sm leading-6 text-amber-900/90">
                This visit has been moved to your cancelled history and the slot is available for booking again.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {appointment.journeyBucket === "missed" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 text-rose-700" />
            <div>
              <div className="text-sm font-semibold text-rose-950">Appointment missed</div>
              <div className="mt-1 text-sm leading-6 text-rose-900/90">
                This timeslot has already passed, so it is no longer treated as an upcoming visit. You can pick a fresh slot with the same doctor right away.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Card density="compact" variant="gradientElevated">
        <CardHeader
          eyebrow="Visit summary"
          title={appointment.doctor?.fullName || "Assigned doctor"}
          description={`${formatDate(appointment.startAt)} at ${formatTime(appointment.startAt)} | Token ${appointment.token}`}
          actions={<Badge tone={getJourneyTone(appointment.journeyBucket)}>{appointment.journeyLabel}</Badge>}
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-sm">
            <div className="section-title">Doctor</div>
            <div className="mt-2 font-semibold text-ink">{appointment.doctor?.fullName}</div>
            <div className="mt-1 text-muted">{appointment.doctor?.specialty}</div>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-sm">
            <div className="section-title">Slot</div>
            <div className="mt-2 font-semibold text-ink">
              {formatTime(appointment.startAt)} - {formatTime(appointment.endAt)}
            </div>
            <div className="mt-1 text-muted">{formatDate(appointment.startAt)}</div>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-sm">
            <div className="section-title">Booking status</div>
            <div className="mt-2 font-semibold text-ink">{formatStatus(appointment.bookingStatus)}</div>
            <div className="mt-1 text-muted">Encounter: {formatStatus(appointment.encounterStatus)}</div>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-sm">
            <div className="section-title">Visit type</div>
            <div className="mt-2 font-semibold text-ink">{formatStatus(appointment.visitType)}</div>
            <div className="mt-1 text-muted">Token {appointment.token}</div>
          </div>
        </div>
      </Card>

      <Card density="compact">
        <CardHeader
          eyebrow="What happens now"
          title={appointment.nextAction.label}
          description={appointment.nextAction.description}
        />
        <div className="flex flex-wrap gap-3">
          {appointment.canViewPrescription ? (
            <Button asChild>
              <Link to={`/patient/prescriptions/${appointment.prescriptionId}`}>
                <FileText className="h-4 w-4" />
                View prescription
              </Link>
            </Button>
          ) : null}

          {appointment.bookingStatus === "cancelled" ? (
            <Button asChild variant="accent">
              <Link to="/patient/booking">
                <CalendarClock className="h-4 w-4" />
                Book another appointment
              </Link>
            </Button>
          ) : null}

          {appointment.journeyBucket === "missed" ? (
            <Button asChild variant="accent">
              <Link to={reschedulePath}>
                <CalendarClock className="h-4 w-4" />
                Reschedule with same doctor
              </Link>
            </Button>
          ) : null}

          {appointment.canCancel ? (
            <Button
              variant={confirmingCancel ? "primary" : "secondary"}
              onClick={() => setConfirmingCancel((current) => !current)}
            >
              <AlertTriangle className="h-4 w-4" />
              Cancel appointment
            </Button>
          ) : null}
        </div>

        {confirmingCancel && appointment.canCancel ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-sm font-semibold text-amber-950">Confirm cancellation</div>
            <div className="mt-2 text-sm leading-6 text-amber-900/90">
              This will remove the visit from your active appointment flow and release the slot back into booking.
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={handleCancel} disabled={submittingCancel}>
                {submittingCancel ? "Cancelling..." : "Yes, cancel this appointment"}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmingCancel(false)} disabled={submittingCancel}>
                Keep appointment
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-4">
        <Card density="compact">
          <CardHeader
            eyebrow="Care progress"
            title={appointment.journeyLabel}
            description="This timeline explains where the visit sits in the patient journey right now."
          />
          <div className="space-y-3">
            {timeline.map((step) => (
              <div
                key={step.label}
                className={`rounded-xl border p-3.5 ${
                  step.active
                    ? "border-emerald-200 bg-emerald-50"
                    : step.current
                      ? "border-cyan-200 bg-cyan-50"
                      : "border-line bg-surface-2"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                      step.active
                        ? "bg-emerald-600 text-white"
                        : step.current
                          ? "bg-cyan-600 text-white"
                          : "bg-white text-muted"
                    }`}
                  >
                    {step.active ? <CheckCircle2 className="h-4 w-4" /> : timeline.indexOf(step) + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-ink">{step.label}</div>
                    <div className="mt-1 text-sm text-muted">{step.description}</div>
                  </div>
                </div>
              </div>
            ))}

            {appointment.bookingStatus === "cancelled" ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
                This appointment is now read-only history. If you still need care, you can book a fresh slot.
              </div>
            ) : appointment.journeyBucket === "missed" ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-900">
                This visit was missed, so the active care flow stopped here. Use the reschedule action above to pick a new slot with the same doctor.
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card density="compact">
          <CardHeader
            eyebrow="Plain-language summary"
            title="What this means for you"
            description="A simple explanation of the current state so patients do not need to decode clinical workflow."
          />
          <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm leading-6 text-muted">
            {appointment.journeyBucket === "action"
              ? "Please complete the pending pre-check before doctor review starts."
              : appointment.journeyBucket === "review"
                ? "Your pre-check details are already shared. The doctor is now reviewing or validating the information before final approval."
                : appointment.journeyBucket === "completed"
                  ? "This visit has been completed and the approved prescription is available in your portal."
                  : appointment.journeyBucket === "missed"
                    ? "This visit was missed, so it has been moved out of the upcoming queue. Reschedule it with the same doctor to continue care."
                  : appointment.journeyBucket === "cancelled"
                    ? "This visit is cancelled and kept only for history. It will no longer move forward in the workflow."
                    : "Your appointment is booked. If needed, you can still review details or cancel before completion."}
          </div>
        </Card>

        <Card density="compact">
          <CardHeader
            eyebrow="Prescription status"
            title={appointment.canViewPrescription ? "Ready to view" : "Awaiting doctor approval"}
            description="Prescriptions only appear after doctor approval, even when the pre-check is already complete."
          />
          {appointment.canViewPrescription ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-1 h-5 w-5 text-emerald-700" />
                  <div>
                    <div className="text-sm font-semibold text-emerald-950">Prescription approved</div>
                    <div className="mt-1 text-sm text-emerald-900/90">
                      Shared on {formatDate(appointment.prescription.issuedAt)} at {formatTime(appointment.prescription.issuedAt)}.
                    </div>
                  </div>
                </div>
              </div>
              <Button asChild>
                <Link to={`/patient/prescriptions/${appointment.prescriptionId}`}>
                  <FileText className="h-4 w-4" />
                  Open prescription
                </Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line bg-surface-2 p-4 text-sm text-muted">
              No approved prescription yet. The doctor will publish it after validating the encounter.
            </div>
          )}
        </Card>

        <Card density="compact">
          <CardHeader
            eyebrow="Investigations"
            title={appointment.canViewTests ? "Tests ordered" : "No tests ordered"}
            description="Tests your doctor selected during the visit appear here after approval."
          />
          {appointment.canViewTests && appointment.testOrder ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                <div className="flex items-start gap-3">
                  <TestTube className="mt-1 h-5 w-5 text-cyan-700" />
                  <div>
                    <div className="text-sm font-semibold text-cyan-950">
                      {appointment.testOrder.tests?.length || 0} test{(appointment.testOrder.tests?.length || 0) === 1 ? "" : "s"} ordered
                    </div>
                    <div className="mt-1 text-sm text-cyan-900/90">
                      Ordered on {formatDate(appointment.testOrder.orderedAt)} by {appointment.testOrder.doctorName || "your doctor"}.
                    </div>
                  </div>
                </div>
              </div>

              {appointment.testOrder.tests?.length > 0 ? (
                <ul className="space-y-2">
                  {appointment.testOrder.tests.map((name) => (
                    <li key={name} className="flex items-start gap-2 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-sky" />
                      {name}
                    </li>
                  ))}
                </ul>
              ) : null}

              {appointment.testOrder.patientNote ? (
                <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm text-ink">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Doctor instructions</div>
                  <p className="mt-1 whitespace-pre-wrap">{appointment.testOrder.patientNote}</p>
                </div>
              ) : null}

              <Button asChild variant="secondary">
                <Link to="/patient/tests">
                  <TestTube className="h-4 w-4" />
                  View all tests
                </Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line bg-surface-2 p-4 text-sm text-muted">
              No tests ordered for this visit. If your doctor selects investigations, they will appear here after approval.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
