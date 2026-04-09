import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CalendarClock, ClipboardList } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { LanguageToggle } from "../../components/ui/LanguageToggle";
import { useDemoData } from "../../app/DemoDataProvider";
import {
  getPatientAppointmentById,
  getPatientWorkspace,
  PATIENT_APPOINTMENT_BUCKETS
} from "../shared/selectors";
import { formatDate, formatTime } from "../../lib/format";
import { usePatientLanguage } from "./usePatientLanguage";
import { PatientAppointmentDetailPanel } from "./PatientAppointmentDetailPanel";

const bucketMeta = {
  all: {
    label: "All visits",
    description: "Every appointment in one clean patient list."
  },
  upcoming: {
    label: "Upcoming",
    description: "Booked slots that are still active."
  },
  action: {
    label: "Action needed",
    description: "Visits that still need the AI interview."
  },
  review: {
    label: "In review",
    description: "The doctor is reviewing or validating the visit."
  },
  completed: {
    label: "Completed / prescriptions",
    description: "Finished visits with prescription outcomes."
  },
  cancelled: {
    label: "Cancelled",
    description: "Read-only history for cancelled appointments."
  }
};

function getBucketTone(bucket) {
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

function getSafeBucket(bucket) {
  return PATIENT_APPOINTMENT_BUCKETS.includes(bucket) ? bucket : "all";
}

export function PatientAppointmentsPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, actions } = useDemoData();
  const {
    patient,
    appointmentsByBucket,
    bucketCounts
  } = getPatientWorkspace(state);
  const [language, setLanguage] = usePatientLanguage(patient?.preferredLanguage || "en");

  const bucket = getSafeBucket(searchParams.get("bucket"));
  const selectedAppointment =
    (appointmentId ? getPatientAppointmentById(state, appointmentId) : null) ||
    (!appointmentId ? appointmentsByBucket[bucket][0] || null : null);
  const showCancelledNotice =
    searchParams.get("notice") === "cancelled" &&
    appointmentId &&
    selectedAppointment?.id === appointmentId;

  async function handleCancel(targetAppointmentId) {
    await actions.booking.cancelAppointment(targetAppointmentId);
    navigate(`/patient/appointments/${targetAppointmentId}?bucket=cancelled&notice=cancelled`, {
      replace: true
    });
  }

  return (
    <AppShell
      title={appointmentId ? "Appointment detail" : "My appointments"}
      subtitle="Track upcoming visits, pending interviews, doctor review, completed prescriptions, and cancellations from one patient workspace."
      languageLabel="Patient appointments in English / Hindi"
      actions={
        <>
          <LanguageToggle value={language} onChange={setLanguage} />
          <Button asChild variant="secondary">
            <Link to="/patient">Back home</Link>
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {PATIENT_APPOINTMENT_BUCKETS.map((entry) => (
            <Link key={entry} to={`/patient/appointments?bucket=${entry}`}>
              <div
                className={`rounded-[24px] border p-4 transition ${
                  bucket === entry
                    ? "border-cyan-300 bg-brand-mint shadow-soft"
                    : "border-line bg-white/80 hover:-translate-y-0.5 hover:bg-white"
                }`}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  {bucketMeta[entry].label}
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-ink">
                  {bucketCounts[entry]}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <Card className={appointmentId ? "hidden lg:block" : ""}>
            <CardHeader
              eyebrow="Appointment center"
              title={bucketMeta[bucket].label}
              description={bucketMeta[bucket].description}
              actions={
                <Badge tone={getBucketTone(bucket)}>
                  {bucketCounts[bucket]} item{bucketCounts[bucket] === 1 ? "" : "s"}
                </Badge>
              }
            />
            <div className="space-y-3">
              {appointmentsByBucket[bucket].map((appointment) => (
                <Link
                  key={appointment.id}
                  to={`/patient/appointments/${appointment.id}?bucket=${bucket}`}
                >
                  <div
                    className={`rounded-[24px] border p-5 transition ${
                      selectedAppointment?.id === appointment.id
                        ? "border-cyan-300 bg-brand-mint shadow-soft"
                        : "border-line bg-surface-2 hover:-translate-y-0.5 hover:bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-ink">{appointment.doctor?.fullName}</div>
                        <div className="mt-1 text-sm text-muted">{appointment.doctor?.specialty}</div>
                      </div>
                      <Badge tone={getBucketTone(appointment.journeyBucket)}>{appointment.journeyLabel}</Badge>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-3">
                      <div>
                        <div className="section-title">Date</div>
                        <div className="mt-2 font-semibold text-ink">{formatDate(appointment.startAt)}</div>
                      </div>
                      <div>
                        <div className="section-title">Time</div>
                        <div className="mt-2 font-semibold text-ink">
                          {formatTime(appointment.startAt)} - {formatTime(appointment.endAt)}
                        </div>
                      </div>
                      <div>
                        <div className="section-title">Token</div>
                        <div className="mt-2 font-semibold text-ink">{appointment.token}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-sm text-brand-tide">
                      <ClipboardList className="h-4 w-4" />
                      {appointment.nextAction.label}
                    </div>
                  </div>
                </Link>
              ))}

              {!appointmentsByBucket[bucket].length ? (
                <div className="rounded-[24px] border border-dashed border-line bg-surface-2 p-8 text-center">
                  <div className="text-base font-semibold text-ink">No appointments in this bucket</div>
                  <div className="mt-2 text-sm leading-6 text-muted">
                    Try another filter or book a new visit to start the next patient flow.
                  </div>
                  <div className="mt-5">
                    <Button asChild>
                      <Link to="/patient/booking">
                        <CalendarClock className="h-4 w-4" />
                        Book appointment
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <div className={!appointmentId ? "hidden lg:block" : ""}>
            <PatientAppointmentDetailPanel
              appointment={selectedAppointment}
              onCancel={handleCancel}
              showCancelledNotice={showCancelledNotice}
              showBackToList={Boolean(appointmentId)}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
