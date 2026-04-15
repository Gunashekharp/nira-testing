import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Calendar,
  CalendarClock,
  ChevronRight,
  FileDown,
  List,
  HeartPulse,
  MessageCircle,
  Pill,
  Sparkles,
  Stethoscope,
  LinkIcon,
  Check,
  TestTube
} from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { useDemoData } from "../../app/DemoDataProvider";
import { getPatientWorkspace } from "../shared/selectors";
import { formatDate, formatTime } from "../../lib/format";
import { getTodayDayKey } from "../../lib/schedule";
import { useTranslation } from "../../hooks/useTranslation";

const PRECHECK_FOCUS_PLACEHOLDER_PATTERNS = [
  /\bpending symptom interview\b/i,
  /\bawaiting symptom interview\b/i,
  /\bchatbot symptom intake\b/i,
  /\bgeneral consultation\b/i,
  /\bclinical review\b/i,
  /^\s*(booked|visit|appointment)\s*$/i
];

function sanitizePrecheckFocus(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return PRECHECK_FOCUS_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized))
    ? ""
    : normalized;
}

function getPrecheckFocusLabel(appointment) {
  return (
    sanitizePrecheckFocus(appointment?.precheckQuestionnaire?.metadata?.chiefComplaint) ||
    sanitizePrecheckFocus(appointment?.encounter?.apciDraft?.soap?.chiefComplaint) ||
    sanitizePrecheckFocus(appointment?.interview?.extractedFindings?.[0]) ||
    appointment?.doctor?.specialty ||
    "Pre-visit questions"
  );
}

export function PatientHomePage() {
  const { state } = useDemoData();
  const { t } = useTranslation();
  const {
    patient,
    appointments,
    bucketCounts,
    prescriptions,
    testOrders,
    unreadNotificationCount,
    pendingPrecheckAppointments
  } = getPatientWorkspace(state);
  const today = getTodayDayKey();
  const todayAppointments = useMemo(
    () =>
      appointments.filter(
        (item) =>
          item.startAt?.slice(0, 10) === today &&
          !["cancelled", "completed"].includes(item.bookingStatus) &&
          item.journeyBucket !== "missed"
      ),
    [appointments, today]
  );

  const quickActions = [
    {
      label: t("bookAppt"),
      icon: CalendarClock,
      to: "/patient/booking",
      description: t("bookAppt30s")
    },
    {
      label: t("myRx"),
      icon: Pill,
      to: "/patient/prescriptions",
      description: t("openLatestPdf")
    },
    {
      label: t("myAppts"),
      icon: List,
      to: "/patient/appointments",
      description: t("trackAppts")
    },
    {
      label: "My Tests",
      icon: TestTube,
      to: "/patient/tests",
      description: testOrders.length ? `${testOrders.length} order${testOrders.length === 1 ? "" : "s"}` : "View ordered investigations"
    }
  ];

  const buckets = [
    { key: "upcoming", label: t("upcomingAppts"), count: bucketCounts.upcoming + bucketCounts.action, tone: "neutral" },
    { key: "review", label: "In review", count: bucketCounts.review, tone: "info" },
    { key: "missed", label: "Missed", count: bucketCounts.missed, tone: "danger" },
    { key: "completed", label: t("completed"), count: bucketCounts.completed, tone: "success" }
  ];

  const latestRx = prescriptions.slice(0, 2);
  const latestVitals = useMemo(() => {
    const withVitals = [...appointments]
      .filter((item) => item?.encounter?.apciDraft?.vitals)
      .sort((left, right) => new Date(right.startAt || 0) - new Date(left.startAt || 0));

    return withVitals[0]?.encounter?.apciDraft?.vitals || null;
  }, [appointments]);
  const latestVitalsUpdatedLabel = useMemo(() => {
    if (!latestVitals?.updatedAt) {
      return "No recent sync";
    }

    return `Updated by ${latestVitals.updatedBy || "care team"} · ${formatTime(latestVitals.updatedAt)}`;
  }, [latestVitals]);

  const latestBloodPressureParts = useMemo(() => {
    const match = String(latestVitals?.bloodPressure || "").match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) return null;

    return {
      systolic: Number(match[1]),
      diastolic: Number(match[2])
    };
  }, [latestVitals?.bloodPressure]);

  const latestPulseValue = useMemo(() => {
    const match = String(latestVitals?.pulse || "").match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  }, [latestVitals?.pulse]);

  const vitalsCards = useMemo(
    () => [
      {
        label: "BP",
        value: latestVitals?.bloodPressure || "Pending",
        subtext: latestBloodPressureParts
          ? `${latestBloodPressureParts.systolic} / ${latestBloodPressureParts.diastolic}`
          : "No reading",
        accent: "from-rose-500/15 via-rose-500/8 to-white",
        bar: latestBloodPressureParts
          ? Math.min(100, Math.max(25, latestBloodPressureParts.systolic - 40))
          : 24,
        live: Boolean(latestBloodPressureParts)
      },
      {
        label: "Pulse",
        value: latestVitals?.pulse || "Pending",
        subtext: latestPulseValue ? `${latestPulseValue} bpm` : "No reading",
        accent: "from-cyan-500/15 via-cyan-500/8 to-white",
        bar: latestPulseValue ? Math.min(100, Math.max(20, latestPulseValue)) : 22,
        live: Boolean(latestPulseValue)
      }
    ],
    [latestVitals?.bloodPressure, latestVitals?.pulse, latestBloodPressureParts, latestPulseValue]
  );

  const hasRecentVitals = vitalsCards.some((item) => item.live);
  function openPrecheckChat(precheckAppointment) {
    if (!precheckAppointment) {
      return;
    }

    window.dispatchEvent(new CustomEvent("nira:open-precheck", {
      detail: {
        appointmentId: precheckAppointment.id,
        doctorName: precheckAppointment.doctor?.fullName,
        specialty: precheckAppointment.doctor?.specialty,
        startAt: precheckAppointment.startAt,
        hasDoctorQuestions: true,
        launchSource: "patient_dashboard"
      }
    }));
  }

  return (
    <AppShell title={t("home")} subtitle="5-second access to booking, prescriptions, status, and profile.">
      <div className="space-y-6">
        <Card density="compact" className="animate-fade-in p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-tide">{t("dashboard")}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                {t("welcome")}, {patient?.fullName?.split(" ")[0] || "Patient"}
              </h2>
              <p className="mt-1.5 text-sm text-muted">Need anything? Start from the quick actions below.</p>
            </div>
            <Badge tone="info">{unreadNotificationCount} unread notifications</Badge>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="patient-quick-action-card"
                aria-label={item.label === t("bookAppt") ? "Booking" : undefined}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="icon-wrap icon-glow">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-80 icon-glow" />
                </div>
                <div className="mt-3 text-sm font-semibold sm:text-base">{item.label}</div>
                <div className="mt-1.5 text-xs opacity-90">{item.description}</div>
              </Link>
            ))}
          </div>
        </Card>

        {pendingPrecheckAppointments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <Card density="compact" className="relative overflow-hidden border-2 border-brand-sky/25 bg-gradient-to-br from-brand-sky/[0.04] via-white to-brand-mint/[0.06] animate-fade-in">
              <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-brand-sky/[0.07] blur-2xl" />
              <div className="absolute -left-6 bottom-0 h-20 w-20 rounded-full bg-brand-mint/10 blur-xl" />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-tide to-brand-sky shadow-lg shadow-brand-sky/25">
                      <Stethoscope className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-tide">Pre-Appointment Checks</p>
                      <h3 className="mt-1 text-lg font-semibold text-ink">Prepare each visit separately</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted">
                        Every appointment keeps its own doctor-specific pre-check, so each doctor gets the right problem summary before the visit.
                      </p>
                    </div>
                  </div>
                  <Badge tone="warning">
                    {pendingPrecheckAppointments.length} pending
                  </Badge>
                </div>

                <div className="mt-5 space-y-3">
                  {pendingPrecheckAppointments.map((precheckAppointment) => {
                    const focusLabel = getPrecheckFocusLabel(precheckAppointment);

                    return (
                      <div
                        key={precheckAppointment.id}
                        className="rounded-2xl border border-brand-sky/15 bg-white/90 p-4 shadow-sm ring-1 ring-black/[0.03]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-ink">
                              {precheckAppointment.doctor?.fullName || "Assigned doctor"}
                            </div>
                            <div className="mt-1 text-xs text-muted">
                              {precheckAppointment.startAt ? `${formatDate(precheckAppointment.startAt)} at ${formatTime(precheckAppointment.startAt)}` : "Scheduled soon"}
                              {" · "}
                              {precheckAppointment.doctor?.specialty || "General Practice"}
                            </div>
                          </div>
                          <Badge tone="warning">Pending</Badge>
                        </div>

                        <div className="mt-4 rounded-xl border border-brand-mint/40 bg-brand-mint/10 px-3 py-2.5">
                          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-tide">Pre-check focus</div>
                          <div className="mt-1 text-sm font-medium text-ink">{focusLabel}</div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openPrecheckChat(precheckAppointment)}
                            aria-label={`Start pre-check for ${precheckAppointment.doctor?.fullName || "your doctor"} about ${focusLabel}`}
                            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-tide to-brand-sky px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-sky/25 transition-all hover:shadow-xl hover:shadow-brand-sky/30 hover:-translate-y-0.5 active:translate-y-0"
                          >
                            <Sparkles className="h-4 w-4" />
                            Start Pre-Check
                            <ChevronRight className="h-4 w-4" />
                          </button>
                          <span className="text-xs text-muted">Takes ~2 minutes</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs font-medium text-amber-800">
                    {pendingPrecheckAppointments.length === 1
                      ? "Your doctor has sent pre-check questions for this appointment."
                      : `Your doctors have sent pre-check questions for ${pendingPrecheckAppointments.length} appointments.`}
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        <Card density="compact" className="animate-fade-in">
          <h3 className="text-xl font-semibold text-ink">Appointment buckets</h3>
          <p className="mt-1 text-sm text-muted">Tap once to jump into the exact stage of care.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {buckets.map((bucket) => (
              <Link key={bucket.key} to={`/patient/appointments?bucket=${bucket.key}`} className="rounded-2xl border border-line bg-surface-2 p-4 transition hover:-translate-y-0.5 hover:bg-white">
                <div className="text-sm font-semibold text-ink">{bucket.label}</div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-2xl font-bold text-ink">{bucket.count}</div>
                  <Badge tone={bucket.tone}>{bucket.label}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card density="compact" className="animate-fade-in">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-tide">Upcoming</p>
                <h3 className="mt-1 text-xl font-semibold text-ink">Calendar highlights</h3>
              </div>
              <Badge tone="success">{todayAppointments.length} today</Badge>
            </div>

            <div className="mt-4 space-y-3">
              {todayAppointments.slice(0, 2).map((item) => (
                <Link key={item.id} to={`/patient/appointments/${item.id}?bucket=${item.journeyBucket}`} className="patient-list-card">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-brand-mint p-2 text-brand-tide">
                      <Calendar className="h-4 w-4 icon-glow" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">{item.doctor?.fullName}</p>
                      <p className="text-xs text-muted">{formatTime(item.startAt)} · {item.doctor?.specialty || "General"}</p>
                    </div>
                  </div>
                  <Badge tone={item.journeyBucket === "review" ? "info" : "neutral"}>{item.journeyLabel}</Badge>
                </Link>
              ))}
              {!todayAppointments.length ? (
                <div className="rounded-2xl border border-dashed border-line bg-surface-2 p-4 text-sm text-muted">
                  No appointments today. You can still book a slot instantly.
                </div>
              ) : null}
            </div>
          </Card>

          <Card density="compact" className="animate-fade-in overflow-hidden">
            <div className="relative">
              <div className="absolute right-0 top-3 h-16 w-16 rounded-full bg-brand-sky/10 blur-2xl" />

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-tide">Health snapshot</p>
                  <h3 className="mt-1 text-xl font-semibold text-ink">Vitals at a glance</h3>
                </div>
                <motion.div
                  className="rounded-full border border-brand-mint bg-brand-mint/70 px-3 py-1 text-[11px] font-semibold text-brand-tide shadow-sm"
                  animate={{ scale: [1, 1.04, 1], opacity: [0.82, 1, 0.82] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                >
                  Live feel
                </motion.div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-xs text-muted">{latestVitalsUpdatedLabel}</p>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                    hasRecentVitals
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {hasRecentVitals ? "Live data" : "Sync pending"}
                </span>
              </div>

              <motion.div
                className="mt-4 grid grid-cols-2 gap-3"
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.12 } }
                }}
              >
                {vitalsCards.map((item) => (
                  <motion.div
                    key={item.label}
                    className={`relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br ${item.accent} p-4 shadow-sm`}
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      show: { opacity: 1, y: 0 }
                    }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  >
                    <div className="relative z-10">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted">{item.label}</p>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                            item.live
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white/80 text-slate-600"
                          }`}
                        >
                          {item.live ? "Live" : "Pending"}
                        </span>
                      </div>
                      <p className="mt-2 text-lg font-semibold text-ink">{item.value}</p>
                      <p className="mt-1 text-xs text-muted">{item.subtext}</p>
                    </div>

                    <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/70">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-tide via-brand-sky to-brand-mint"
                        initial={{ width: 0 }}
                        animate={{ width: `${item.bar}%` }}
                        transition={{ duration: 1.1, ease: "easeOut" }}
                      />
                      <motion.span
                        className="absolute inset-y-0 left-0 w-8 rounded-full bg-white/70 blur-[2px]"
                        animate={{ x: [0, `${Math.max(0, item.bar - 8)}%`, 0] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-surface-2 px-4 py-3">
                <div className="flex items-center gap-3">
                  <motion.span
                    className={`h-3 w-3 rounded-full shadow-[0_0_0_0_rgba(16,185,129,0.45)] ${
                      hasRecentVitals ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                    animate={{
                      scale: [1, 1.2, 1],
                      boxShadow: hasRecentVitals
                        ? [
                            "0 0 0 0 rgba(16,185,129,0.45)",
                            "0 0 0 10px rgba(16,185,129,0)",
                            "0 0 0 0 rgba(16,185,129,0)"
                          ]
                        : [
                            "0 0 0 0 rgba(245,158,11,0.45)",
                            "0 0 0 10px rgba(245,158,11,0)",
                            "0 0 0 0 rgba(245,158,11,0)"
                          ]
                    }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-ink">Vitals stream</p>
                    <p className="text-xs text-muted">
                      {hasRecentVitals ? "Subtle motion helps spot changes quickly" : "Awaiting next device sync"}
                    </p>
                  </div>
                </div>
                <HeartPulse className="h-5 w-5 text-brand-tide icon-glow" />
              </div>

              <Button asChild variant="secondary" className="mt-4 w-full">
                <Link to="/patient/profile">
                  <HeartPulse className="h-4 w-4" />
                  Update
                </Link>
              </Button>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card density="compact" className="animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-ink">Recent Rx</h3>
              <Button asChild variant="ghost" size="sm">
                <Link to="/patient/prescriptions">
                  <List className="h-4 w-4" />
                  View all
                </Link>
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {latestRx.map((rx) => (
                <Link key={rx.id} to={`/patient/prescriptions/${rx.id}`} className="patient-list-card">
                  <div>
                    <p className="text-sm font-semibold text-ink">{rx.medicines[0]?.name || "Prescription"}</p>
                    <p className="mt-1 text-xs text-muted">{formatDate(rx.issuedAt)} · {rx.followUpNote}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-tide">
                    <FileDown className="h-4 w-4" /> PDF
                  </span>
                </Link>
              ))}
              {!latestRx.length ? (
                <div className="rounded-2xl border border-dashed border-line bg-surface-2 p-4 text-sm text-muted">
                  No Rx yet. Try AI symptom check after your next booking.
                </div>
              ) : null}
            </div>
          </Card>

          <Card density="compact" className="animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-ink">Recent Tests</h3>
              <Button asChild variant="ghost" size="sm">
                <Link to="/patient/tests">
                  <TestTube className="h-4 w-4" />
                  View all
                </Link>
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {testOrders.slice(0, 2).map((order) => (
                <Link key={order.id} to={`/patient/appointments/${order.appointmentId}`} className="patient-list-card">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-cyan-50 p-2 text-cyan-700">
                      <TestTube className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {order.tests?.length || 0} test{(order.tests?.length || 0) === 1 ? "" : "s"} ordered
                      </p>
                      <p className="text-xs text-muted">
                        {formatDate(order.orderedAt)} · {order.doctorName || "Doctor"}
                      </p>
                    </div>
                  </div>
                  <Badge tone="info">ORDERED</Badge>
                </Link>
              ))}
              {!testOrders.length ? (
                <div className="rounded-2xl border border-dashed border-line bg-surface-2 p-4 text-sm text-muted">
                  No tests ordered yet. After your doctor approves a visit with investigations, they appear here.
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        {/* ABHA Linking Section - Prominent */}
        <Card density="compact" className="border-2 border-brand-mint bg-gradient-to-br from-brand-mint/10 to-transparent animate-fade-in">
          <div className="mb-4 flex items-start justify-between gap-3 sm:items-center sm:gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-tide">Health Identity</p>
              <h3 className="mt-1 text-xl font-semibold text-ink">ABHA Account Linking</h3>
              <p className="mt-1.5 text-sm text-muted">Connect your Ayushman Bharat Health Account for unified health records across providers</p>
            </div>
            <LinkIcon className="hidden h-8 w-8 flex-shrink-0 text-brand-tide sm:block" />
          </div>
          
          <div className="mt-4 rounded-2xl border-2 border-dashed border-brand-mint bg-brand-mint/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-mint">
                <Check className="h-5 w-5 text-brand-tide" />
              </div>
              <div>
                <p className="font-semibold text-ink">Link Your ABHA Account</p>
                <p className="text-xs text-muted">14-digit Health ID or registered phone number</p>
              </div>
            </div>
            <Button asChild className="w-full">
              <Link to="/patient/profile">
                <LinkIcon className="h-4 w-4" />
                Go to Profile & Link ABHA
              </Link>
            </Button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3 text-xs">
            <div className="rounded-lg border border-line p-2">
              <p className="font-semibold text-ink">Unified Access</p>
              <p className="text-muted mt-1">All health records in one place</p>
            </div>
            <div className="rounded-lg border border-line p-2">
              <p className="font-semibold text-ink">Easy Sharing</p>
              <p className="text-muted mt-1">Share with authorized providers</p>
            </div>
            <div className="rounded-lg border border-line p-2">
              <p className="font-semibold text-ink">Better Care</p>
              <p className="text-muted mt-1">Continuity across clinics</p>
            </div>
          </div>
        </Card>

      </div>
    </AppShell>
  );
}
