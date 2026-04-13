import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock3, FlaskConical, FileCheck2, FileText, History, Home, PlusCircle, Share2 } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { useDemoData } from "../../app/DemoDataProvider";
import { getPatientWorkspace } from "../shared/selectors";
import { formatDate, formatTime } from "../../lib/format";

function getLabBucket(report) {
  if (report.status === "final") {
    return "completed";
  }
  if (report.status === "pending") {
    return "pending";
  }
  return "past";
}

export function LabReportsPage() {
  const { state } = useDemoData();
  const { labReports } = getPatientWorkspace(state);
  const [tab, setTab] = useState("pending");

  const filtered = useMemo(
    () => labReports.filter((report) => getLabBucket(report) === tab),
    [labReports, tab]
  );

  const counts = {
    pending: labReports.filter((report) => getLabBucket(report) === "pending").length,
    completed: labReports.filter((report) => getLabBucket(report) === "completed").length,
    past: labReports.filter((report) => getLabBucket(report) === "past").length
  };

  return (
    <AppShell
      title="Lab reports"
      subtitle="Visual status at a glance, with pending progress and one-tap sharing."
    >
      <div className="space-y-4">
        <Card density="compact">
          <CardHeader
            eyebrow="Diagnostics"
            title="Reports"
            description="Goal: visual status at glance"
            actions={
              <Button asChild variant="secondary">
                <Link to="/patient">
                  <Home className="h-4 w-4" />
                  Back home
                </Link>
              </Button>
            }
          />

          <div className="flex flex-wrap gap-2">
            {[
              { key: "pending", label: `Pending (${counts.pending})`, icon: Clock3 },
              { key: "completed", label: `Completed (${counts.completed})`, icon: FileCheck2 },
              { key: "past", label: `Past (${counts.past})`, icon: History }
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  tab === item.key ? "bg-brand-sky text-white" : "bg-surface-2 text-ink hover:bg-white"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="icon-wrap-soft">
                    <item.icon className="h-3.5 w-3.5 icon-glow" />
                  </span>
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {filtered.map((report, index) => {
              const progress = report.status === "final" ? 100 : Math.min(20 + index * 20, 80);
              return (
                <div key={report.id} className="rounded-2xl border border-line bg-surface-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-ink">{report.title}</div>
                      <div className="mt-1 text-sm text-muted">{report.category}</div>
                    </div>
                    <Badge tone={report.status === "final" ? "success" : "warning"}>
                      {report.status === "final" ? "Completed" : "Pending"}
                    </Badge>
                  </div>

                  <div className="mt-3 rounded-xl border border-line bg-white p-3">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <ProgressBar className="mt-2" value={progress} />
                  </div>

                  <div className="mt-3 text-sm text-muted">
                    Updated {formatDate(report.updatedAt)} at {formatTime(report.updatedAt)}
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-line bg-white p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-tide">Findings</div>
                      <div className="mt-1.5 text-sm leading-5 text-ink">{report.findings}</div>
                    </div>
                    <div className="rounded-xl border border-line bg-white p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-tide">Summary</div>
                      <div className="mt-1.5 text-sm leading-5 text-ink">{report.resultSummary}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild variant="secondary" size="sm">
                      <Link to={`/patient/appointments/${report.appointmentId}`}>
                        <FileText className="h-4 w-4" />
                        Details
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <a href="https://share.google.com" target="_blank" rel="noreferrer">
                        <Share2 className="h-4 w-4" />
                        Share
                      </a>
                    </Button>
                  </div>
                </div>
              );
            })}

            {!filtered.length ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface-2 p-6 text-center md:col-span-2">
                <FlaskConical className="mx-auto mb-3 h-5 w-5 text-brand-tide" />
                <div className="text-base font-semibold text-ink">No reports in this view</div>
                <div className="mt-2 text-sm text-muted">Order New Test to create a fresh diagnostic request.</div>
                <div className="mt-4">
                  <Button asChild>
                    <Link to="/patient/booking">
                      <PlusCircle className="h-4 w-4" />
                      Order New Test
                    </Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
