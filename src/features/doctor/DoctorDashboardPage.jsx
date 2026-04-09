import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock3, FileCheck2, Filter, Sparkles } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { StatCard } from "../../components/ui/StatCard";
import { useDemoData } from "../../app/DemoDataProvider";
import { getDoctorWorkspace } from "../shared/selectors";
import { formatStatus, formatTime } from "../../lib/format";
import { initials } from "../../lib/utils";

const filters = ["all", "ai_ready", "awaiting_interview", "in_consult", "approved"];

function toneForStatus(status) {
  if (status === "approved") return "success";
  if (status === "ai_ready") return "info";
  if (status === "awaiting_interview") return "warning";
  return "neutral";
}

export function DoctorDashboardPage() {
  const { state } = useDemoData();
  const { doctor, appointments, queueCounts } = getDoctorWorkspace(state);
  const [filter, setFilter] = useState("all");

  const filteredAppointments = useMemo(
    () => appointments.filter((item) => filter === "all" || item.queueStatus === filter),
    [appointments, filter]
  );

  return (
    <AppShell
      title="Doctor validation workspace"
      subtitle="Review only your own queue, validate APCI drafts, manage availability, and approve the final prescription from one workspace."
      languageLabel="Doctor UI in English"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Today's queue" value={`${queueCounts.total}`} tone="accent" />
          <StatCard label="AI-ready patients" value={`${queueCounts.aiReady}`} tone="soft" />
          <StatCard label="In consult" value={`${queueCounts.inConsult}`} />
          <StatCard label="Approved today" value={`${queueCounts.approved}`} />
        </div>

        <Card>
          <CardHeader
            eyebrow="Queue control"
            title={doctor ? `${doctor.fullName} · ${doctor.specialty}` : "Doctor workspace"}
            description="Focus on AI-ready patients first, then move through live consultations and approvals without leaving the dashboard."
          />
          <div className="flex flex-wrap gap-2">
            {filters.map((option) => (
              <Button key={option} variant={filter === option ? "primary" : "secondary"} size="sm" onClick={() => setFilter(option)}>
                {option === "all" ? (
                  <>
                    <Filter className="h-4 w-4" />
                    All
                  </>
                ) : (
                  formatStatus(option)
                )}
              </Button>
            ))}
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          {filteredAppointments.map((item) => (
            <Link key={item.id} to={`/doctor/patient/${item.id}`}>
              <div className="glass-card h-full p-6 transition hover:-translate-y-1 hover:shadow-panel">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-brand-midnight text-white">
                      <span className="text-sm font-semibold">{initials(item.patient?.fullName)}</span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-semibold tracking-tight text-ink">{item.patient?.fullName}</h3>
                        <Badge tone={toneForStatus(item.queueStatus)}>{formatStatus(item.queueStatus)}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted">
                        Token {item.token} · {formatTime(item.startAt)} · {formatStatus(item.visitType)}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-brand-tide" />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-ink">
                      {item.draft?.soap?.chiefComplaint || "Interview pending"}
                    </div>
                    <div className="text-sm leading-6 text-muted">
                      {item.draft?.soap?.assessment || "Patient has not completed the AI interview yet, so the chart is still empty."}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-muted">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-brand-sky" />
                      Confidence {item.draft ? `${Math.round(item.draft.confidenceMap.assessment * 100)}%` : "--"}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-brand-tide" />
                      Queue status {formatStatus(item.queueStatus)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {(item.draft?.alerts || ["Interview pending"]).slice(0, 2).map((alert) => (
                    <span key={alert} className="pill">
                      {alert}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
          {filteredAppointments.length === 0 ? (
            <Card className="xl:col-span-2">
              <div className="rounded-[24px] border border-dashed border-line bg-surface-2 p-8 text-center text-sm text-muted">
                No patients match this filter in the dummy queue right now.
              </div>
            </Card>
          ) : null}
        </div>

        <Card>
          <CardHeader
            eyebrow="Why this works"
            title="Doctor workflow is now role-aware"
            description="Queue, chart review, availability, and approval are now tied to the signed-in doctor instead of a demo persona switch."
          />
          <div className="grid gap-3 md:grid-cols-3">
            {[
              "Only this doctor's appointments and APCI drafts appear in the queue.",
              "Availability changes feed back into patient and admin booking views immediately.",
              "Pending or inactive doctors can sign in, but clinical access stays safely blocked."
            ].map((item) => (
              <div key={item} className="rounded-[22px] border border-line bg-surface-2 p-4 text-sm leading-6 text-muted">
                <FileCheck2 className="mb-3 h-5 w-5 text-brand-tide" />
                {item}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
