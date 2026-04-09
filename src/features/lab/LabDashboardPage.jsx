import { Link } from "react-router-dom";
import { FileCheck2, Microscope } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Card, CardHeader } from "../../components/ui/Card";
import { StatCard } from "../../components/ui/StatCard";
import { useDemoData } from "../../app/DemoDataProvider";
import { getLabWorkspace } from "../shared/selectors";
import { formatDate } from "../../lib/format";

function LabProgressInline({ progress }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
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

export function LabDashboardPage() {
  const { state } = useDemoData();
  const { lab, ordersByBucket, counts } = getLabWorkspace(state);

  return (
    <AppShell
      title="Lab operations dashboard"
      subtitle="Review incoming test requests, update sample collection, move work into processing, and publish completed reports back to both doctor and patient workspaces."
      languageLabel="Lab UI in English"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="All requests" value={`${counts.total}`} tone="accent" />
          <StatCard label="Requested" value={`${counts.ordered}`} tone="warning" />
          <StatCard label="Sample received" value={`${counts.sampleReceived}`} tone="soft" />
          <StatCard label="Processing" value={`${counts.processing}`} />
          <StatCard label="Completed" value={`${counts.completed}`} tone="success" />
        </div>

        <Card>
          <CardHeader
            eyebrow="Lab queue"
            title={lab ? `${lab.fullName} workspace` : "Lab workspace"}
            description="Each request stays in one place until the report is completed and shared back to the clinic workflow."
          />
          <div className="grid gap-6 xl:grid-cols-4">
            {[
              { id: "ordered", label: "Requested" },
              { id: "sample_received", label: "Sample received" },
              { id: "processing", label: "Processing" },
              { id: "completed", label: "Completed" }
            ].map((bucket) => (
              <div key={bucket.id} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="section-title">{bucket.label}</div>
                  <Badge tone={bucket.id === "completed" ? "success" : bucket.id === "ordered" ? "warning" : "info"}>
                    {ordersByBucket[bucket.id].length}
                  </Badge>
                </div>
                {ordersByBucket[bucket.id].map((order) => (
                  <Link key={order.id} to={`/lab/orders/${order.id}`}>
                    <div className="rounded-[24px] border border-line bg-surface-2 p-5 transition hover:-translate-y-0.5 hover:shadow-soft">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-ink">{order.patient?.fullName}</div>
                          <div className="mt-1 text-sm text-muted">{order.doctor?.fullName}</div>
                        </div>
                        <Badge tone={order.tone}>{order.doctorStatusLabel}</Badge>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {order.tests.map((test) => (
                          <span key={test.id} className="pill">
                            {test.name}
                          </span>
                        ))}
                      </div>
                      <LabProgressInline progress={order.progress} />
                      <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand-tide">
                        {order.report ? <FileCheck2 className="h-4 w-4" /> : <Microscope className="h-4 w-4" />}
                        {order.report ? `Completed ${formatDate(order.completedAt)}` : `Requested ${formatDate(order.orderedAt)}`}
                      </div>
                    </div>
                  </Link>
                ))}
                {!ordersByBucket[bucket.id].length ? (
                  <div className="rounded-[24px] border border-dashed border-line bg-surface-2 p-5 text-sm text-muted">
                    No requests in this stage right now.
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {ordersByBucket.cancelled?.length ? (
            <div className="mt-6 space-y-3">
              <div className="section-title">Cancelled history</div>
              <div className="grid gap-3">
                {ordersByBucket.cancelled.map((order) => (
                  <div key={order.id} className="rounded-[22px] border border-line bg-surface-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-ink">{order.patient?.fullName}</div>
                        <div className="mt-1 text-sm text-muted">Requested {formatDate(order.orderedAt)}</div>
                      </div>
                      <Badge tone="danger">Cancelled</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
