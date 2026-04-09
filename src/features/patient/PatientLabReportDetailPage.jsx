import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, Microscope } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { useDemoData } from "../../app/DemoDataProvider";
import { getLabOrderBundle } from "../shared/selectors";
import { formatDate, formatTime } from "../../lib/format";

function formatResultFlag(flag) {
  if (flag === "normal") return "Within range";
  return "Outside range";
}

function ProgressPipeline({ order }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
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

export function PatientLabReportDetailPage() {
  const { labOrderId } = useParams();
  const { state, actions } = useDemoData();
  const order = getLabOrderBundle(state, labOrderId);

  return (
    <AppShell
      title="Lab report detail"
      subtitle="View what tests were requested, where the request is in the process, and download the report once it is ready."
      languageLabel="Patient lab detail in English / Hindi"
    >
      <Card>
        <CardHeader
          eyebrow="Lab request"
          title={order ? order.patient?.fullName : "Lab order not found"}
          description={
            order
              ? `${order.doctor?.fullName} | ${formatDate(order.orderedAt)} | ${order.patientStatusLabel}`
              : "No lab order could be loaded for this route."
          }
          actions={
            <Button asChild variant="secondary">
              <Link to="/patient/lab-reports">
                <ArrowLeft className="h-4 w-4" />
                All lab reports
              </Link>
            </Button>
          }
        />
        {order ? (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="rounded-[22px] border border-line bg-surface-2 p-4 text-sm">
                <div className="section-title">Status</div>
                <div className="mt-2">
                  <Badge tone={order.tone}>{order.patientStatusLabel}</Badge>
                </div>
              </div>
              <div className="rounded-[22px] border border-line bg-surface-2 p-4 text-sm">
                <div className="section-title">Requested</div>
                <div className="mt-2 font-semibold text-ink">{formatDate(order.orderedAt)}</div>
              </div>
              <div className="rounded-[22px] border border-line bg-surface-2 p-4 text-sm">
                <div className="section-title">Doctor</div>
                <div className="mt-2 font-semibold text-ink">{order.doctor?.fullName}</div>
              </div>
              <div className="rounded-[22px] border border-line bg-surface-2 p-4 text-sm">
                <div className="section-title">Appointment</div>
                <div className="mt-2 font-semibold text-ink">
                  {order.appointment ? `${formatDate(order.appointment.startAt)} at ${formatTime(order.appointment.startAt)}` : "-"}
                </div>
              </div>
            </div>

            <Card>
              <CardHeader
                eyebrow="Progress"
                title="Request pipeline"
                description="This shows whether the request is waiting for your sample visit, already shared with the lab, or fully completed."
              />
              <ProgressPipeline order={order} />
            </Card>

            <div className="rounded-[24px] border border-line bg-surface-2 p-5">
              <div className="section-title">Requested tests</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {order.tests.map((test) => (
                  <span key={test.id} className="pill">
                    {test.name}
                  </span>
                ))}
              </div>
              {order.clinicianNote ? (
                <div className="mt-4 text-sm leading-6 text-muted">{order.clinicianNote}</div>
              ) : null}
            </div>

            {order.report ? (
              <div className="grid gap-6 lg:grid-cols-[1fr_0.82fr]">
                <div className="space-y-4">
                  {order.report.resultItems.map((item) => (
                    <div key={item.testId} className="rounded-[24px] border border-line bg-surface-2 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-base font-semibold text-ink">{item.name}</div>
                        <Badge tone={item.flag === "normal" ? "success" : "warning"}>{formatResultFlag(item.flag)}</Badge>
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-3">
                        <div>
                          <div className="section-title">Result</div>
                          <div className="mt-2 font-semibold text-ink">{item.result}</div>
                        </div>
                        <div>
                          <div className="section-title">Unit</div>
                          <div className="mt-2 font-semibold text-ink">{item.unit || "-"}</div>
                        </div>
                        <div>
                          <div className="section-title">Expected range</div>
                          <div className="mt-2 font-semibold text-ink">{item.referenceRange || "-"}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
                    <div className="text-sm font-semibold text-emerald-950">Report ready</div>
                    <div className="mt-2 text-sm text-emerald-900/90">
                      Published on {formatDate(order.report.completedAt)} at {formatTime(order.report.completedAt)}.
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-line bg-surface-2 p-5 text-sm leading-7 text-muted">
                    {order.report.summary}
                  </div>
                  <Button onClick={() => actions.documents.downloadLabReport(order.report.id)}>
                    <FileDown className="h-4 w-4" />
                    Download report
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-line bg-surface-2 p-8 text-sm text-muted">
                <div className="flex items-center gap-2 font-semibold text-ink">
                  <Microscope className="h-4 w-4 text-brand-tide" />
                  Report not ready yet
                </div>
                <div className="mt-2 leading-6">
                  The request is still moving through the lab process. This page will update automatically once the final report is published.
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Card>
    </AppShell>
  );
}
