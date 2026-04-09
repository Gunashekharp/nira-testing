import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  MessageSquareHeart,
  ShieldCheck
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { formatDate, formatStatus, formatTime } from "../../lib/format";

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

  if (bucket === "cancelled") {
    return "danger";
  }

  return "neutral";
}

function buildTimeline(appointment) {
  const interviewDone = appointment.interview?.completionStatus === "complete";
  const reviewStarted = ["ai_ready", "in_consult", "approved"].includes(appointment.encounterStatus);
  const prescriptionReady = appointment.canViewPrescription;

  return [
    {
      label: "Booked",
      description: "Your slot is confirmed in the system.",
      active: true
    },
    {
      label: "Interview",
      description: interviewDone ? "AI intake completed and sent to doctor." : "AI interview still needs attention.",
      active: interviewDone,
      current: appointment.encounterStatus === "awaiting_interview"
    },
    {
      label: "Doctor review",
      description: reviewStarted ? "Doctor is reviewing or has reviewed the draft." : "Doctor review starts after intake.",
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
  const timeline = useMemo(() => buildTimeline(appointment), [appointment]);

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
          description="Choose an item from the left list to see visit status, interview progress, and prescription outcome."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
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
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
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

      <Card>
        <CardHeader
          eyebrow="Visit summary"
          title={appointment.doctor?.fullName || "Assigned doctor"}
          description={`${formatDate(appointment.startAt)} at ${formatTime(appointment.startAt)} | Token ${appointment.token}`}
          actions={<Badge tone={getJourneyTone(appointment.journeyBucket)}>{appointment.journeyLabel}</Badge>}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[22px] border border-line bg-surface-2 p-4 text-sm">
            <div className="section-title">Doctor</div>
            <div className="mt-2 font-semibold text-ink">{appointment.doctor?.fullName}</div>
            <div className="mt-1 text-muted">{appointment.doctor?.specialty}</div>
          </div>
          <div className="rounded-[22px] border border-line bg-surface-2 p-4 text-sm">
            <div className="section-title">Slot</div>
            <div className="mt-2 font-semibold text-ink">
              {formatTime(appointment.startAt)} - {formatTime(appointment.endAt)}
            </div>
            <div className="mt-1 text-muted">{formatDate(appointment.startAt)}</div>
          </div>
          <div className="rounded-[22px] border border-line bg-surface-2 p-4 text-sm">
            <div className="section-title">Booking status</div>
            <div className="mt-2 font-semibold text-ink">{formatStatus(appointment.bookingStatus)}</div>
            <div className="mt-1 text-muted">Encounter: {formatStatus(appointment.encounterStatus)}</div>
          </div>
          <div className="rounded-[22px] border border-line bg-surface-2 p-4 text-sm">
            <div className="section-title">Visit type</div>
            <div className="mt-2 font-semibold text-ink">{formatStatus(appointment.visitType)}</div>
            <div className="mt-1 text-muted">Token {appointment.token}</div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          eyebrow="What happens now"
          title={appointment.nextAction.label}
          description={appointment.nextAction.description}
        />
        <div className="flex flex-wrap gap-3">
          {appointment.canStartInterview ? (
            <Button asChild>
              <Link to={`/patient/interview/${appointment.id}`}>
                <MessageSquareHeart className="h-4 w-4" />
                Start AI interview
              </Link>
            </Button>
          ) : null}

          {!appointment.canStartInterview && appointment.canViewInterview ? (
            <Button asChild>
              <a href="#interview-summary">
                <ClipboardList className="h-4 w-4" />
                View interview summary
              </a>
            </Button>
          ) : null}

          {!appointment.canStartInterview && !appointment.canViewInterview && appointment.canViewPrescription ? (
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
          <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 p-5">
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

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader
            eyebrow="Interview status"
            title={appointment.interviewState.label}
            description={appointment.interviewState.description}
          />
          <div id="interview-summary" className="space-y-4">
            {appointment.interview?.transcript?.length ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {(appointment.interview.extractedFindings || []).map((finding) => (
                    <span key={finding} className="pill">
                      {finding}
                    </span>
                  ))}
                </div>
                <div className="space-y-3">
                  {appointment.interview.transcript.slice(0, 4).map((entry, index) => (
                    <div
                      key={`${entry.role}-${index}`}
                      className={`rounded-2xl px-4 py-3 text-sm ${
                        entry.role === "ai" ? "bg-surface-2 text-muted" : "bg-brand-mint text-brand-midnight"
                      }`}
                    >
                      {entry.text}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-[22px] border border-dashed border-line bg-surface-2 p-5 text-sm text-muted">
                No interview answers have been submitted yet for this appointment.
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Care progress"
            title={appointment.journeyLabel}
            description="This timeline explains where the visit sits in the patient journey right now."
          />
          <div className="space-y-3">
            {timeline.map((step) => (
              <div
                key={step.label}
                className={`rounded-[22px] border p-4 ${
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
              <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                This appointment is now read-only history. If you still need care, you can book a fresh slot.
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader
            eyebrow="Plain-language summary"
            title="What this means for you"
            description="A simple explanation of the current state so patients do not need to decode clinical workflow."
          />
          <div className="rounded-[22px] border border-line bg-surface-2 p-5 text-sm leading-7 text-muted">
            {appointment.journeyBucket === "action"
              ? "Please complete the AI interview before the doctor begins review. This helps the doctor see your symptoms in a structured draft."
              : appointment.journeyBucket === "review"
                ? "Your interview has already been submitted. The doctor is now reviewing or validating the information before final approval."
                : appointment.journeyBucket === "completed"
                  ? "This visit has been completed and the approved prescription is available in your portal."
                  : appointment.journeyBucket === "cancelled"
                    ? "This visit is cancelled and kept only for history. It will no longer move forward in the workflow."
                    : "Your appointment is booked. If needed, you can still review details or cancel before completion."}
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Prescription status"
            title={appointment.canViewPrescription ? "Ready to view" : "Awaiting doctor approval"}
            description="Prescriptions only appear after doctor approval, even when the AI interview is already complete."
          />
          {appointment.canViewPrescription ? (
            <div className="space-y-4">
              <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-5">
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
            <div className="rounded-[22px] border border-dashed border-line bg-surface-2 p-5 text-sm text-muted">
              No approved prescription yet. The doctor will publish it after validating the encounter.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
