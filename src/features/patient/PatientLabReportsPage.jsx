import { Link, useSearchParams } from "react-router-dom";
import { FileDown, Microscope } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { useDemoData } from "../../app/DemoDataProvider";
import { getPatientWorkspace, PATIENT_LAB_BUCKETS } from "../shared/selectors";
import { formatDate } from "../../lib/format";

const bucketMeta = {
  total: {
    label: "Total lab tests",
    description: "Every active or completed test request in one place."
  },
  yet_to_visit: {
    label: "Yet to visit",
    description: "Tests requested by the doctor that still need your sample visit."
  },
  sample_given: {
    label: "Sample given",
    description: "Samples already given and now moving through the lab process."
  },
  completed: {
    label: "Completed",
    description: "Reports already published and ready to open or download."
  }
};

function getSafeBucket(bucket) {
  return PATIENT_LAB_BUCKETS.includes(bucket) ? bucket : "total";
}

function ProgressPipeline({ order }) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-4">
      {order.progress.map((step) => (
        <div
          key={`${order.id}-${step.key}`}
          className={`rounded-2xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${
            step.done
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : step.current
                ? "border-cyan-200 bg-cyan-50 text-cyan-900"
                : "border-line bg-white text-muted"
          }`}
        >
          {step.label}
        </div>
      ))}
    </div>
  );
}

export function PatientLabReportsPage() {
  const { state } = useDemoData();
  const { labOrders, labCounts, labBuckets } = getPatientWorkspace(state);
  const [searchParams] = useSearchParams();
  const bucket = getSafeBucket(searchParams.get("bucket"));
  const filteredOrders = labBuckets[bucket];
  const cancelledOrders = labBuckets.cancelled;

  return (
    <AppShell
      title="My lab reports"
      subtitle="Track doctor-requested tests, see which ones still need your visit, and open completed reports without leaving the patient portal."
      languageLabel="Patient lab reports in English / Hindi"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { key: "total", count: labCounts.total },
            { key: "yet_to_visit", count: labCounts.yetToVisit },
            { key: "sample_given", count: labCounts.sampleGiven },
            { key: "completed", count: labCounts.completed }
          ].map((item) => (
            <Link key={item.key} to={`/patient/lab-reports?bucket=${item.key}`}>
              <div
                className={`rounded-[24px] border p-5 transition ${
                  bucket === item.key
                    ? "border-cyan-300 bg-brand-mint shadow-soft"
                    : "border-line bg-white/85 hover:-translate-y-0.5 hover:bg-white"
                }`}
              >
                <div className="section-title">{bucketMeta[item.key].label}</div>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-ink">{item.count}</div>
                <div className="mt-2 text-sm text-muted">{bucketMeta[item.key].description}</div>
              </div>
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader
            eyebrow="Lab tracking"
            title={bucketMeta[bucket].label}
            description={bucketMeta[bucket].description}
            actions={
              <Button asChild variant="secondary">
                <Link to="/patient">Back home</Link>
              </Button>
            }
          />
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Link key={order.id} to={`/patient/lab-reports/${order.id}`}>
                <div className="rounded-[24px] border border-line bg-surface-2 p-5 transition hover:-translate-y-0.5 hover:shadow-soft">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-ink">{order.doctor?.fullName}</div>
                      <div className="mt-1 text-sm text-muted">Requested on {formatDate(order.orderedAt)}</div>
                    </div>
                    <Badge tone={order.tone}>{order.patientStatusLabel}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {order.tests.map((test) => (
                      <span key={test.id} className="pill">
                        {test.name}
                      </span>
                    ))}
                  </div>
                  <ProgressPipeline order={order} />
                  <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand-tide">
                    {order.report ? <FileDown className="h-4 w-4" /> : <Microscope className="h-4 w-4" />}
                    {order.report ? "Open report" : "Open request"}
                  </div>
                </div>
              </Link>
            ))}

            {!filteredOrders.length ? (
              <div className="rounded-[24px] border border-dashed border-line bg-surface-2 p-8 text-center text-sm text-muted">
                No lab requests match this filter right now.
              </div>
            ) : null}
          </div>
        </Card>

        {cancelledOrders.length ? (
          <Card>
            <CardHeader
              eyebrow="History"
              title="Cancelled lab requests"
              description="Cancelled requests stay visible here for history, but they do not count in the active lab summary."
            />
            <div className="space-y-3">
              {cancelledOrders.map((order) => (
                <Link key={order.id} to={`/patient/lab-reports/${order.id}`}>
                  <div className="rounded-[24px] border border-line bg-surface-2 p-4 transition hover:bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-ink">{order.doctor?.fullName}</div>
                        <div className="mt-1 text-sm text-muted">Requested on {formatDate(order.orderedAt)}</div>
                      </div>
                      <Badge tone={order.tone}>{order.patientStatusLabel}</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        ) : null}

        {!labOrders.length ? (
          <Card>
            <div className="rounded-[24px] border border-dashed border-line bg-surface-2 p-8 text-center text-sm text-muted">
              Lab requests will appear here after a doctor sends tests for one of your appointments.
            </div>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
