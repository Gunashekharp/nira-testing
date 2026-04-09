import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ClipboardList, Clock3, Filter, Microscope, Search, Sparkles } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/FormFields";
import { StatCard } from "../../components/ui/StatCard";
import { useDemoData } from "../../app/DemoDataProvider";
import { getDoctorWorkspace } from "../shared/selectors";
import { formatTime } from "../../lib/format";
import { initials } from "../../lib/utils";

const queueFilters = [
  { id: "all", label: "All patients" },
  { id: "awaiting_interview", label: "Awaiting interview" },
  { id: "ai_ready", label: "AI chat completed" },
  { id: "in_consult", label: "Under consultation" },
  { id: "approved", label: "Completed today" }
];

const labFilters = [
  { id: "all", label: "All requests" },
  { id: "ordered", label: "Requested" },
  { id: "sample_received", label: "Sample received" },
  { id: "processing", label: "Processing" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" }
];

function getQueueTone(status) {
  if (status === "approved") return "success";
  if (status === "ai_ready") return "info";
  if (status === "in_consult") return "warning";
  if (status === "awaiting_interview") return "neutral";
  return "neutral";
}

function getQueueLabel(status) {
  if (status === "ai_ready") return "AI chat completed";
  if (status === "in_consult") return "Under consultation";
  if (status === "approved") return "Completed today";
  if (status === "awaiting_interview") return "Awaiting interview";
  return "Patients in queue";
}

function DashboardCardButton({ active, onClick, label, value, tone = "default" }) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <StatCard
        label={label}
        value={`${value}`}
        tone={tone}
        className={active ? "ring-2 ring-cyan-200 shadow-panel" : "transition hover:-translate-y-0.5 hover:shadow-panel"}
      />
    </button>
  );
}

function LabProgressInline({ progress }) {
  return (
    <div className="flex flex-wrap gap-2">
      {progress.map((step) => (
        <span
          key={step.key}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            step.current
              ? "border-cyan-200 bg-brand-mint text-brand-midnight"
              : step.done
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-line bg-white text-muted"
          }`}
        >
          {step.label}
        </span>
      ))}
    </div>
  );
}

export function DoctorDashboardPage() {
  const { state } = useDemoData();
  const { doctor, appointments, queueCounts, labOrders, labCounts } = getDoctorWorkspace(state);
  const [viewMode, setViewMode] = useState("queue");
  const [queueFilter, setQueueFilter] = useState("all");
  const [labFilter, setLabFilter] = useState("all");
  const [labSearch, setLabSearch] = useState("");

  const filteredAppointments = useMemo(
    () => appointments.filter((item) => queueFilter === "all" || item.queueStatus === queueFilter),
    [appointments, queueFilter]
  );

  const filteredLabOrders = useMemo(() => {
    const normalizedQuery = labSearch.trim().toLowerCase();

    return labOrders.filter((order) => {
      const matchesStatus = labFilter === "all" || order.status === labFilter;
      const matchesQuery =
        !normalizedQuery ||
        order.patient?.fullName?.toLowerCase().includes(normalizedQuery) ||
        order.tests.some((test) => test.name.toLowerCase().includes(normalizedQuery));

      return matchesStatus && matchesQuery;
    });
  }, [labOrders, labFilter, labSearch]);

  return (
    <AppShell
      title="Doctor validation workspace"
      subtitle="Review only your own queue, validate APCI drafts, manage lab requests, and approve the final prescription from one workspace."
      languageLabel="Doctor UI in English"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <DashboardCardButton
            active={viewMode === "queue" && queueFilter === "all"}
            onClick={() => {
              setViewMode("queue");
              setQueueFilter("all");
            }}
            label="Patients in queue"
            value={queueCounts.total}
            tone="accent"
          />
          <DashboardCardButton
            active={viewMode === "queue" && queueFilter === "ai_ready"}
            onClick={() => {
              setViewMode("queue");
              setQueueFilter("ai_ready");
            }}
            label="AI chat completed"
            value={queueCounts.aiReady}
            tone="soft"
          />
          <DashboardCardButton
            active={viewMode === "queue" && queueFilter === "in_consult"}
            onClick={() => {
              setViewMode("queue");
              setQueueFilter("in_consult");
            }}
            label="Under consultation"
            value={queueCounts.inConsult}
          />
          <DashboardCardButton
            active={viewMode === "queue" && queueFilter === "approved"}
            onClick={() => {
              setViewMode("queue");
              setQueueFilter("approved");
            }}
            label="Completed today"
            value={queueCounts.approved}
          />
          <DashboardCardButton
            active={viewMode === "labs"}
            onClick={() => setViewMode("labs")}
            label="Lab requests"
            value={labCounts.total}
          />
        </div>

        <Card>
          <CardHeader
            eyebrow={viewMode === "queue" ? "Queue control" : "Lab request worklist"}
            title={doctor ? `${doctor.fullName} · ${doctor.specialty}` : "Doctor workspace"}
            description={
              viewMode === "queue"
                ? "Use the cards and filters to focus the queue on the next patients who need your attention."
                : "Search lab requests by patient name, follow request progress, and jump back into the EMR when a result needs review."
            }
          />

          {viewMode === "queue" ? (
            <div className="flex flex-wrap gap-2">
              {queueFilters.map((option) => (
                <Button
                  key={option.id}
                  variant={queueFilter === option.id ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setQueueFilter(option.id)}
                >
                  {option.id === "all" ? (
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
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1.1fr_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input
                    value={labSearch}
                    onChange={(event) => setLabSearch(event.target.value)}
                    placeholder="Search by patient or test name"
                    className="pl-11"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {labFilters.map((option) => (
                    <Button
                      key={option.id}
                      variant={labFilter === option.id ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => setLabFilter(option.id)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                {filteredLabOrders.map((order) => (
                  <div key={order.id} className="glass-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold tracking-tight text-ink">{order.patient?.fullName}</h3>
                          <Badge tone={order.tone}>{order.doctorStatusLabel}</Badge>
                        </div>
                        <div className="text-sm text-muted">
                          {order.doctor?.fullName} · Ordered {new Date(order.orderedAt).toLocaleDateString("en-IN")}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {order.tests.map((test) => (
                            <span key={test.id} className="pill">
                              {test.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Button asChild variant="secondary" size="sm">
                        <Link to={`/doctor/patient/${order.appointmentId}`}>
                          Open EMR
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                      <LabProgressInline progress={order.progress} />
                      <div className="text-sm text-muted">
                        {order.status === "completed"
                          ? "Report ready to review"
                          : order.status === "cancelled"
                            ? "Request cancelled"
                            : "Awaiting next lab step"}
                      </div>
                    </div>
                  </div>
                ))}

                {!filteredLabOrders.length ? (
                  <div className="rounded-[24px] border border-dashed border-line bg-surface-2 p-8 text-center text-sm text-muted">
                    No lab requests match the current search or filter.
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </Card>

        {viewMode === "queue" ? (
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
                          <Badge tone={getQueueTone(item.queueStatus)}>{getQueueLabel(item.queueStatus)}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted">
                          Token {item.token} · {formatTime(item.startAt)}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-brand-tide" />
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-ink">
                        {item.draft?.soap?.chiefComplaint || "Interview still pending"}
                      </div>
                      <div className="text-sm leading-6 text-muted">
                        {item.draft?.soap?.assessment ||
                          "The patient has not completed the AI chat yet, so the chart still needs intake before review."}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-muted">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-brand-sky" />
                        Confidence {item.draft ? `${Math.round(item.draft.confidenceMap.assessment * 100)}%` : "--"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-brand-tide" />
                        {getQueueLabel(item.queueStatus)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {(item.draft?.alerts || ["Interview pending"]).slice(0, 2).map((alert) => (
                      <span key={alert} className="pill">
                        {alert}
                      </span>
                    ))}
                    {item.latestLabOrder ? <span className="pill">Lab {item.latestLabOrder.doctorStatusLabel}</span> : null}
                  </div>
                </div>
              </Link>
            ))}
            {filteredAppointments.length === 0 ? (
              <Card className="xl:col-span-2">
                <div className="rounded-[24px] border border-dashed border-line bg-surface-2 p-8 text-center text-sm text-muted">
                  No patients match this queue filter right now.
                </div>
              </Card>
            ) : null}
          </div>
        ) : (
          <Card>
            <CardHeader
              eyebrow="Doctor workflow"
              title="Lab requests stay inside the same workspace"
              description="Requests, progress checks, and EMR review now stay connected so you do not have to jump between unrelated screens."
            />
            <div className="grid gap-3 md:grid-cols-3">
              {[
                "Click any lab request to open the patient EMR and continue the same consultation flow.",
                "Doctors can edit or cancel a request only before the lab has started working on it.",
                "Completed reports stay available for both doctor review and patient download."
              ].map((item) => (
                <div key={item} className="rounded-[22px] border border-line bg-surface-2 p-4 text-sm leading-6 text-muted">
                  <ClipboardList className="mb-3 h-5 w-5 text-brand-tide" />
                  {item}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
