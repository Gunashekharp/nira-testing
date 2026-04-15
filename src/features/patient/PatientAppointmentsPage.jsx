import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Ban, Calendar, CalendarClock, FileText, History, Home, MapPin, PlusCircle, RotateCcw, Timer, XCircle } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { useDemoData } from "../../app/DemoDataProvider";
import {
  getPatientAppointmentById,
  getPatientReschedulePath,
  getPatientWorkspace,
  PATIENT_APPOINTMENT_BUCKETS
} from "../shared/selectors";
import { formatDate, formatTime } from "../../lib/format";
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
    label: "Pending pre-check",
    description: "Upcoming visits where pre-check is still pending."
  },
  review: {
    label: "Pre-check submitted",
    description: "Upcoming visits where your pre-check is already submitted to doctor."
  },
  missed: {
    label: "Missed",
    description: "Slots that already passed and should be rescheduled."
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

  if (bucket === "missed") {
    return "danger";
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

function getBucketQueryFromTab(tab) {
  if (tab === "past") {
    return "completed";
  }

  if (tab === "pending-precheck") {
    return "action";
  }

  if (tab === "precheck-submitted") {
    return "review";
  }

  return tab;
}

export function PatientAppointmentsPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, actions } = useDemoData();
  const { appointmentsByBucket } = getPatientWorkspace(state);

  const bucket = getSafeBucket(searchParams.get("bucket"));
  const tabFromBucket =
    bucket === "completed"
      ? "past"
      : bucket === "cancelled"
        ? "cancelled"
        : bucket === "missed"
          ? "missed"
          : bucket === "action"
            ? "pending-precheck"
            : bucket === "review"
              ? "precheck-submitted"
              : "upcoming";

  const tabMap = {
    upcoming: [...appointmentsByBucket.upcoming, ...appointmentsByBucket.action, ...appointmentsByBucket.review]
      .sort((left, right) => new Date(left.startAt) - new Date(right.startAt)),
    "pending-precheck": [...appointmentsByBucket.action]
      .sort((left, right) => new Date(left.startAt) - new Date(right.startAt)),
    "precheck-submitted": [...appointmentsByBucket.review]
      .sort((left, right) => new Date(left.startAt) - new Date(right.startAt)),
    missed: [...appointmentsByBucket.missed].sort((left, right) => new Date(right.startAt) - new Date(left.startAt)),
    past: appointmentsByBucket.completed,
    cancelled: appointmentsByBucket.cancelled
  };

  const selectedAppointment =
    (appointmentId ? getPatientAppointmentById(state, appointmentId) : null) ||
    (!appointmentId ? tabMap[tabFromBucket]?.[0] || null : null);
  const showCancelledNotice =
    searchParams.get("notice") === "cancelled" &&
    appointmentId &&
    selectedAppointment?.id === appointmentId;

  const monthlyDays = Array.from({ length: 30 }, (_, index) => {
    const date = new Date();
    date.setDate(index + 1);
    const dayIso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const dayAppointments = appointmentsByBucket.all
      .filter((entry) => entry.startAt?.slice(0, 10) === dayIso)
      .sort((left, right) => new Date(left.startAt) - new Date(right.startAt));
    const count = dayAppointments.length;
    return {
      dayLabel: date.getDate(),
      count,
      firstAppointment: dayAppointments[0] || null,
      isToday: date.toDateString() === new Date().toDateString()
    };
  });

  async function handleCancel(targetAppointmentId) {
    await actions.booking.cancelAppointment(targetAppointmentId);
    navigate(`/patient/appointments/${targetAppointmentId}?bucket=cancelled&notice=cancelled`, {
      replace: true
    });
  }

  function openPrecheckForAppointment(appointment) {
    if (!appointment || typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(new CustomEvent("nira:open-precheck", {
      detail: {
        appointmentId: appointment.id,
        doctorName: appointment.doctor?.fullName,
        specialty: appointment.doctor?.specialty,
        startAt: appointment.startAt,
        hasDoctorQuestions: appointment.precheckQuestionnaire?.status === "sent_to_patient"
      }
    }));
  }

  return (
    <AppShell
      title={appointmentId ? "Appointment detail" : "My appointments"}
      subtitle="One-tap reschedule, map directions, and fast filtering across all appointments."
      actions={
        <Button asChild variant="secondary">
          <Link to="/patient">
            <Home className="h-4 w-4" />
            Back home
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-white p-1.5 sm:p-2">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { key: "upcoming", label: "Upcoming", count: tabMap.upcoming.length, icon: Timer },
              { key: "pending-precheck", label: "Pending pre-check", count: tabMap["pending-precheck"].length, icon: CalendarClock },
              { key: "precheck-submitted", label: "Pre-check submitted", count: tabMap["precheck-submitted"].length, icon: Calendar },
              { key: "missed", label: "Missed", count: tabMap.missed.length, icon: RotateCcw },
              { key: "past", label: "Past", count: tabMap.past.length, icon: History },
              { key: "cancelled", label: "Cancelled", count: tabMap.cancelled.length, icon: Ban }
            ].map((tab) => (
              <Link
                key={tab.key}
                to={`/patient/appointments?bucket=${getBucketQueryFromTab(tab.key)}`}
                className={`rounded-xl px-2.5 py-2.5 text-center transition sm:px-4 sm:py-3 ${
                  tabFromBucket === tab.key
                    ? "bg-brand-sky text-white shadow-md"
                    : "bg-surface-2 text-ink hover:bg-white"
                }`}
              >
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold sm:text-sm">
                  <span className="icon-wrap-soft">
                    <tab.icon className="h-3.5 w-3.5 icon-glow" />
                  </span>
                  {tab.label}
                </div>
                <div className="mt-1 text-[11px] opacity-90 sm:text-xs">{tab.count} item{tab.count === 1 ? "" : "s"}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.06fr_0.94fr]">
          <Card density="compact" className={appointmentId ? "hidden lg:block" : ""}>
            <CardHeader
              eyebrow="List view"
              title={
                tabFromBucket === "upcoming"
                  ? "Upcoming appointments"
                  : tabFromBucket === "pending-precheck"
                    ? "Pending pre-check appointments"
                    : tabFromBucket === "precheck-submitted"
                      ? "Pre-check submitted appointments"
                      : tabFromBucket === "past"
                        ? "Past appointments"
                        : tabFromBucket === "missed"
                          ? "Missed appointments"
                          : "Cancelled appointments"
              }
              description="Goal: one-tap reschedule and directions from each row."
              actions={<Badge tone={getBucketTone(bucket)}>{bucketMeta[bucket]?.label || "Appointments"}</Badge>}
            />
            <div className="space-y-3">
              {(tabMap[tabFromBucket] || []).map((appointment) => {
                const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appointment.doctor?.clinic || "NIRA Clinic")}`;
                const reschedulePath = getPatientReschedulePath(appointment);
                return (
                  <div
                    key={appointment.id}
                    className={`rounded-2xl border p-4 transition ${
                      selectedAppointment?.id === appointment.id
                        ? "border-cyan-300 bg-brand-mint"
                        : "border-line bg-surface-2"
                    }`}
                  >
                    <Link to={`/patient/appointments/${appointment.id}?bucket=${getBucketQueryFromTab(tabFromBucket)}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-ink">{formatTime(appointment.startAt)} {appointment.doctor?.fullName}</p>
                          <p className="mt-1 text-sm text-muted">{formatDate(appointment.startAt)} · Token {appointment.token}</p>
                        </div>
                        <Badge tone={getBucketTone(appointment.journeyBucket)}>{appointment.journeyLabel}</Badge>
                      </div>
                    </Link>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {tabFromBucket === "upcoming" || tabFromBucket === "pending-precheck" || tabFromBucket === "missed" ? (
                        <Button asChild variant="secondary" size="sm">
                          <Link to={reschedulePath}>
                            <RotateCcw className="h-4 w-4" />
                            {tabFromBucket === "missed" ? "Reschedule same doctor" : "Reschedule"}
                          </Link>
                        </Button>
                      ) : null}
                      {tabFromBucket === "upcoming" || tabFromBucket === "pending-precheck" || tabFromBucket === "precheck-submitted" ? (
                        <Button asChild variant="secondary" size="sm">
                          <a href={mapUrl} target="_blank" rel="noreferrer">
                            <MapPin className="h-4 w-4" />
                            Directions
                          </a>
                        </Button>
                      ) : null}
                      {tabFromBucket === "pending-precheck" ? (
                        <Button type="button" variant="secondary" size="sm" onClick={() => openPrecheckForAppointment(appointment)}>
                          <FileText className="h-4 w-4" />
                          Start pre-check
                        </Button>
                      ) : null}
                      {appointment.canCancel ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleCancel(appointment.id)}>
                          <XCircle className="h-4 w-4" />
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {!(tabMap[tabFromBucket] || []).length ? (
                <div className="rounded-xl border border-dashed border-line bg-surface-2 p-6 text-center">
                  <div className="text-base font-semibold text-ink">No appointments in this tab</div>
                  <div className="mt-2 text-sm leading-6 text-muted">
                    {tabFromBucket === "missed"
                      ? "You have not missed any appointments right now."
                      : "Try a different filter or book a new visit."}
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

          <div className="space-y-4">
            <Card density="compact" className={appointmentId ? "hidden lg:block" : ""}>
              <CardHeader
                eyebrow="Calendar widget"
                title="Monthly view"
                description="Days with appointments are highlighted for quick planning."
                actions={<Calendar className="h-4 w-4 text-brand-tide" />}
              />
              <div className="grid grid-cols-7 gap-2">
                {monthlyDays.map((day, index) => (
                  day.firstAppointment ? (
                    <Link
                      key={`${day.dayLabel}-${index}`}
                      to={`/patient/appointments/${day.firstAppointment.id}?bucket=${day.firstAppointment.journeyBucket}`}
                      className={`rounded-lg border p-2 text-center text-xs transition hover:-translate-y-0.5 hover:shadow-sm ${
                        day.isToday
                          ? "border-brand-sky bg-brand-mint text-ink"
                          : "border-cyan-200 bg-cyan-50 text-ink"
                      }`}
                      title={`Open ${day.count} appointment${day.count === 1 ? "" : "s"}`}
                    >
                      <div className="font-semibold">{day.dayLabel}</div>
                      <div className="mt-1 text-[10px]">{day.count} appt</div>
                    </Link>
                  ) : (
                    <div
                      key={`${day.dayLabel}-${index}`}
                      className={`rounded-lg border p-2 text-center text-xs ${
                        day.isToday
                          ? "border-brand-sky bg-brand-mint text-ink"
                          : "border-line bg-surface-2 text-muted"
                      }`}
                    >
                      <div className="font-semibold">{day.dayLabel}</div>
                      <div className="mt-1 text-[10px]">-</div>
                    </div>
                  )
                ))}
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

        <Button asChild className="patient-floating-book" size="lg">
          <Link to="/patient/booking">
            <PlusCircle className="h-4 w-4" />
            Book New
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}
