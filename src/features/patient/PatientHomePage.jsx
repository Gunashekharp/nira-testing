import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  ClipboardList,
  FileText,
  ShieldCheck,
  UserRound
} from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { LanguageToggle } from "../../components/ui/LanguageToggle";
import { useDemoData } from "../../app/DemoDataProvider";
import { getPatientWorkspace } from "../shared/selectors";
import { formatDate, formatStatus, formatTime } from "../../lib/format";
import { usePatientLanguage } from "./usePatientLanguage";

const copy = {
  en: {
    title: "Patient dashboard",
    subtitle:
      "A cleaner care workspace for appointments, pending AI interviews, doctor review, and approved prescriptions.",
    nextStep: "Next step",
    actionHub: "Your care flow at a glance",
    actionBody:
      "Open the most important visit task first, then review every appointment in a structured appointment center.",
    appointments: "All appointments",
    book: "Book appointment",
    prescriptions: "Prescriptions",
    profile: "Profile",
    profileCompleteness: "Profile completeness",
    recentRx: "Recent prescriptions",
    noPrescription: "Approved prescriptions will appear here after doctor validation.",
    focusVisit: "Focus visit",
    noVisit: "No active visits yet",
    noVisitBody: "Book a live slot to start a new visit journey in the patient workspace."
  },
  hi: {
    title: "Patient dashboard",
    subtitle:
      "A cleaner care workspace for appointments, pending AI interviews, doctor review, and approved prescriptions.",
    nextStep: "Next step",
    actionHub: "Your care flow at a glance",
    actionBody:
      "Open the most important visit task first, then review every appointment in a structured appointment center.",
    appointments: "All appointments",
    book: "Book appointment",
    prescriptions: "Prescriptions",
    profile: "Profile",
    profileCompleteness: "Profile completeness",
    recentRx: "Recent prescriptions",
    noPrescription: "Approved prescriptions will appear here after doctor validation.",
    focusVisit: "Focus visit",
    noVisit: "No active visits yet",
    noVisitBody: "Book a live slot to start a new visit journey in the patient workspace."
  }
};

const bucketCards = [
  {
    bucket: "upcoming",
    label: "Upcoming",
    description: "Booked visits that are still active.",
    tone: "neutral",
    icon: CalendarClock
  },
  {
    bucket: "action",
    label: "Action needed",
    description: "Visits that still need the AI interview.",
    tone: "warning",
    icon: ClipboardList
  },
  {
    bucket: "review",
    label: "In review",
    description: "Your interview is with the doctor for validation.",
    tone: "info",
    icon: Activity
  },
  {
    bucket: "completed",
    label: "Completed / prescriptions",
    description: "Finished visits with approved outputs.",
    tone: "success",
    icon: ShieldCheck
  }
];

export function PatientHomePage() {
  const { state } = useDemoData();
  const {
    patient,
    appointmentsByBucket,
    bucketCounts,
    prescriptions,
    nextRecommendedAction
  } = getPatientWorkspace(state);
  const [language, setLanguage] = usePatientLanguage(patient?.preferredLanguage || "en");
  const content = copy[language];
  const focusVisit =
    appointmentsByBucket.action[0] ||
    appointmentsByBucket.review[0] ||
    appointmentsByBucket.upcoming[0] ||
    appointmentsByBucket.completed[0] ||
    null;

  const profileSignals = [
    patient?.age ? "Age added" : "Age optional",
    patient?.gender ? "Gender added" : "Gender optional",
    patient?.city ? "City added" : "City optional",
    patient?.abhaNumber ? "ABHA linked" : "ABHA optional"
  ];

  return (
    <AppShell title={content.title} subtitle={content.subtitle} languageLabel="Patient UI in English / Hindi">
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <Card className="bg-brand-midnight text-white shadow-panel">
            <CardHeader
              eyebrow={content.nextStep}
              title={nextRecommendedAction.label}
              description={nextRecommendedAction.description}
              actions={
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone="info">{patient?.fullName}</Badge>
                  <Badge tone={patient?.abhaNumber ? "success" : "warning"}>
                    {patient?.abhaNumber ? "ABHA linked" : "ABHA optional"}
                  </Badge>
                </div>
              }
            />
            <div className="space-y-5">
              <p className="max-w-2xl text-sm leading-7 text-white/80">{content.actionBody}</p>

              {focusVisit ? (
                <div className="rounded-[24px] border border-white/10 bg-white/10 p-5">
                  <div className="section-title text-white/70">{content.focusVisit}</div>
                  <div className="mt-3 text-lg font-semibold tracking-tight">{focusVisit.doctor?.fullName}</div>
                  <div className="mt-1 text-sm text-white/75">
                    {formatDate(focusVisit.startAt)} at {formatTime(focusVisit.startAt)} | Token {focusVisit.token}
                  </div>
                  <div className="mt-4">
                    <Badge tone="info">{focusVisit.journeyLabel}</Badge>
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-white/10 bg-white/10 p-5">
                  <div className="text-base font-semibold">{content.noVisit}</div>
                  <div className="mt-2 text-sm leading-6 text-white/75">{content.noVisitBody}</div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button asChild variant="accent" size="lg">
                  <Link to={nextRecommendedAction.to}>
                    {nextRecommendedAction.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link to="/patient/appointments">{content.appointments}</Link>
                </Button>
                <Button asChild variant="ghost" size="lg" className="border border-white/15 text-white hover:bg-white/10">
                  <Link to="/patient/booking">{content.book}</Link>
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow={content.actionHub}
              title={patient?.fullName}
              description="Your language preference, linked ID state, and care summary stay visible here."
              actions={<LanguageToggle value={language} onChange={setLanguage} />}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-line bg-surface-2 p-5">
                <div className="section-title">Current open visits</div>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-ink">
                  {bucketCounts.action + bucketCounts.review + bucketCounts.upcoming}
                </div>
                <div className="mt-2 text-sm text-muted">Action needed, in review, and upcoming buckets combined.</div>
              </div>
              <div className="rounded-[24px] border border-line bg-surface-2 p-5">
                <div className="section-title">Approved prescriptions</div>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-ink">{bucketCounts.completed}</div>
                <div className="mt-2 text-sm text-muted">Completed visits with approved outputs ready to open.</div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link to="/patient/prescriptions">{content.prescriptions}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/patient/profile">{content.profile}</Link>
              </Button>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {bucketCards.map((item) => (
            <Link key={item.bucket} to={`/patient/appointments?bucket=${item.bucket}`}>
              <div className="rounded-[24px] border border-line bg-white/85 p-5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <item.icon className="h-5 w-5 text-brand-tide" />
                  <Badge tone={item.tone}>{bucketCounts[item.bucket]}</Badge>
                </div>
                <div className="mt-4 text-lg font-semibold tracking-tight text-ink">{item.label}</div>
                <div className="mt-2 text-sm leading-6 text-muted">{item.description}</div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader
              eyebrow={content.focusVisit}
              title={focusVisit ? focusVisit.journeyLabel : content.noVisit}
              description={
                focusVisit
                  ? `${focusVisit.doctor?.fullName} | ${formatDate(focusVisit.startAt)} at ${formatTime(focusVisit.startAt)}`
                  : content.noVisitBody
              }
            />
            {focusVisit ? (
              <div className="space-y-4">
                <div className="rounded-[24px] border border-line bg-surface-2 p-5">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <div className="section-title">Next action</div>
                      <div className="mt-2 font-semibold text-ink">{focusVisit.nextAction.label}</div>
                    </div>
                    <div>
                      <div className="section-title">Interview status</div>
                      <div className="mt-2 font-semibold text-ink">{focusVisit.interviewState.label}</div>
                    </div>
                    <div>
                      <div className="section-title">Booking status</div>
                      <div className="mt-2 font-semibold text-ink">{formatStatus(focusVisit.bookingStatus)}</div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link to={`/patient/appointments/${focusVisit.id}?bucket=${focusVisit.journeyBucket}`}>
                      Open visit detail
                    </Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link to="/patient/appointments">All appointments</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <Button asChild>
                <Link to="/patient/booking">{content.book}</Link>
              </Button>
            )}
          </Card>

          <Card>
            <CardHeader
              eyebrow={content.recentRx}
              title="Shared outputs"
              description="Approved prescriptions stay grouped here and in the completed appointment bucket."
            />
            <div className="space-y-3">
              {prescriptions.slice(0, 3).map((prescription) => (
                <Link key={prescription.id} to={`/patient/prescriptions/${prescription.id}`}>
                  <div className="rounded-[22px] border border-line bg-surface-2 p-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-ink">{formatDate(prescription.issuedAt)}</div>
                        <div className="mt-1 text-sm text-muted">{prescription.followUpNote}</div>
                      </div>
                      <FileText className="h-5 w-5 text-brand-tide" />
                    </div>
                  </div>
                </Link>
              ))}
              {prescriptions.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-line bg-surface-2 p-5 text-sm text-muted">
                  {content.noPrescription}
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader
            eyebrow="Patient profile"
            title={content.profileCompleteness}
            description="Optional details stay optional, but richer profile data helps the future visit flow feel more complete."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {profileSignals.map((signal) => (
              <div key={signal} className="rounded-[24px] border border-line bg-surface-2 p-5">
                <UserRound className="h-5 w-5 text-brand-tide" />
                <div className="mt-3 text-sm leading-6 text-muted">{signal}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
