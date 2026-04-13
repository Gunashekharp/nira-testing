import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock3, Filter, Shield } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { StatCard } from "../../components/ui/StatCard";
import { useDemoData } from "../../app/DemoDataProvider";
import { getDoctorWorkspace, getCurrentProfile } from "../shared/selectors";
import { formatConfidence, formatStatus, formatTime } from "../../lib/format";
import { initials } from "../../lib/utils";
import { useTranslation } from "../../hooks/useTranslation";

export function DoctorDashboardPage() {
  const { state } = useDemoData();
  const { t } = useTranslation();

  const isPreCheckDone = (item) => ["complete", "completed"].includes(String(item?.interview?.completionStatus || "").toLowerCase());

  const getQueueDisplayStatus = (item) => {
    if (item.queueStatus === "approved" || item.bookingStatus === "completed") return t("completedToday");
    if (item.queueStatus === "in_consult") return t("underConsultation");
    if (isPreCheckDone(item) || item.queueStatus === "ai_ready") return t("aiChatCompleted");
    return formatStatus(item.queueStatus);
  };

  const getChiefComplaintDisplay = (item) => {
    const complaint = String(item?.draft?.soap?.chiefComplaint || item?.chiefComplaint || "").trim();
    const isPendingSymptomNote = /pending symptom (interview|check)/i.test(complaint) || /interview pending/i.test(complaint);
    if (item?.queueStatus === "awaiting_interview" && isPendingSymptomNote) return "-";
    return complaint || "-";
  };
  
  const filters = [
    { key: "all", label: t("allPatients") },
    { key: "pre_check", label: t("preCheckStage") },
    { key: "in_consult", label: t("underConsultation") },
    { key: "approved", label: t("completedToday") }
  ];

  function toneForStatus(status) {
    if (status === "approved") return "success";
    if (status === "ai_ready") return "info";
    if (status === "awaiting_interview") return "warning";
    return "neutral";
  }

  const { doctor, appointments, queueCounts, labReports } = getDoctorWorkspace(state);
  const profile = getCurrentProfile(state);
  const isPending = ["pending_approval", "pending"].includes(String(profile?.status || "").toLowerCase());
  const [filter, setFilter] = useState("all");

  const dashboardStats = useMemo(
    () => [
      { label: "Patients in queue", value: queueCounts.total, tone: "accent", filterKey: "all" },
      {
        label: "Pre-check stage",
        value: appointments.filter((item) => ["awaiting_interview", "ai_ready"].includes(item.queueStatus)).length,
        tone: "soft",
        filterKey: "pre_check"
      },
      { label: "Under consultation", value: queueCounts.inConsult, tone: "default", filterKey: "in_consult" },
      {
        label: "Completed today",
        value: appointments.filter((item) => item.queueStatus === "approved" || item.bookingStatus === "completed").length,
        tone: "default",
        filterKey: "approved"
      },
      { label: "Lab requests", value: labReports.length, tone: "default", to: "/doctor/lab-reports" },
      { label: "Doctor availability", value: doctor?.availability?.length || 0, tone: "soft", to: "/doctor/availability" }
    ],
    [appointments, doctor?.availability?.length, labReports.length, queueCounts.inConsult, queueCounts.total]
  );

  const filteredAppointments = useMemo(
    () =>
      appointments.filter((item) => {
        if (filter === "all") return true;
        if (filter === "pre_check") {
          return ["awaiting_interview", "ai_ready"].includes(item.queueStatus);
        }
        return item.queueStatus === filter;
      }),
    [appointments, filter]
  );

  return (
    <AppShell
      title="Doctor validation workspace"
      subtitle="Review only your own queue, validate APCI drafts, manage availability, and approve the final prescription from one workspace."
      languageLabel="Doctor UI in English"
    >
      <div className="space-y-6">
        {isPending ? (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-amber-700 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-amber-950">Pending Admin Approval</div>
                <div className="mt-1 text-sm text-amber-900">
                  Your doctor account is pending approval from the clinic admin. You can explore the workspace, but clinical operations will be fully unlocked once approved.
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {dashboardStats.map((item) => (
            <StatCard
              key={item.label}
              label={item.label}
              value={`${item.value}`}
              tone={item.tone}
              to={item.to}
              onClick={item.filterKey ? () => setFilter(item.filterKey) : undefined}
              active={item.filterKey ? filter === item.filterKey : false}
            />
          ))}
        </div>

        <Card density="compact">
          <CardHeader
            eyebrow="Doctor profile"
            title="Your profile at a glance"
            description="Keep your public-facing details updated so patients and admins always see the latest credentials."
          />
          <div className="grid gap-4 md:grid-cols-[1.3fr_1fr_auto] md:items-center">
            <div>
              <div className="text-lg font-semibold text-ink">{profile?.fullName || doctor?.fullName || "Doctor"}</div>
              <div className="mt-1 text-sm text-muted">
                {(profile?.specialty || doctor?.specialty || "General Practice")}
                {profile?.licenseNumber ? ` · License ${profile.licenseNumber}` : ""}
              </div>
              <div className="mt-2 text-sm text-muted">{profile?.clinic || doctor?.clinic || "Clinic details not added yet"}</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
              <Badge tone="info">Phone: {doctor?.phone || "Not set"}</Badge>
              <Badge tone="neutral">Status: {isPending ? "Pending approval" : "Active"}</Badge>
            </div>
            <Button asChild>
              <Link to="/doctor/profile">
                Manage profile
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Card>
        <Card>
          <CardHeader
            eyebrow="Queue control"
            title={doctor ? `${doctor.fullName} · ${doctor.specialty}` : "Doctor workspace"}
            description="Use the filter chips to focus on the next patients who need your attention."
          />
          <div className="flex flex-wrap gap-2">
            {filters.map((option) => (
              <Button
                key={option.key}
                variant={filter === option.key ? "primary" : "secondary"}
                size="sm"
                onClick={() => setFilter(option.key)}
              >
                {option.key === "all" ? (
                  <>
                    <Filter className="h-4 w-4" />
                    {option.label}
                  </>
                ) : (
                  option.label
                )}
              </Button>
            ))}
          </div>
        </Card>

        {filteredAppointments.length === 0 ? (
          <Card>
            <div className="rounded-[24px] border border-dashed border-line bg-surface-2 p-8 text-center text-sm text-muted">
              No patients match this filter in the dummy queue right now.
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-line">
                <thead className="bg-surface-2">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">Patient</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">Queue status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">Token & time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">ABHA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">Chief complaint</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">Signals</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-white">
                  {filteredAppointments.map((item) => {
                    return (
                      <tr key={item.id} className="transition hover:bg-cyan-50/40">
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-center gap-3 min-w-[220px]">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-midnight text-white">
                              <span className="text-sm font-semibold">{initials(item.patient?.fullName)}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-ink">{item.patient?.fullName}</div>
                              <div className="mt-1 text-xs text-muted">{item.patient?.gender || "Patient"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-muted">
                          <div className="space-y-1">
                            <Badge tone={toneForStatus(item.queueStatus)}>{getQueueDisplayStatus(item)}</Badge>
                            <div>{item.queueStatus ? formatStatus(item.queueStatus) : "—"}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-muted">
                          <div className="flex items-center gap-2 font-medium text-ink">
                            <Clock3 className="h-4 w-4 text-brand-tide" />
                            Token {item.token || "--"}
                          </div>
                          <div className="mt-1 text-xs text-muted">{formatTime(item.startAt)}</div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-muted">
                          {item.patient?.abhaNumber || item.patient?.abha || item.abhaId || "Not linked"}
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-ink">
                          <div className="font-semibold">{getChiefComplaintDisplay(item)}</div>
                          <div className="mt-1 max-w-[30rem] text-sm leading-6 text-muted">
                            {item.draft?.soap?.assessment || "Patient has not completed the pre-check yet, so the chart is still empty."}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-muted">
                          <div className="flex flex-wrap gap-2">
                            {(item.draft?.alerts || ["Awaiting doctor review"]).slice(0, 2).map((alert) => (
                              <span key={alert} className="pill">
                                {alert}
                              </span>
                            ))}
                            {item.dbSync?.encounterId ? <Badge tone="success" className="text-xs">DB linked</Badge> : null}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-right">
                          <Button asChild variant="secondary" className="h-8 px-3">
                            <Link to={`/doctor/patient/${item.id}`}>
                              Open
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

      </div>
    </AppShell>
  );
}
