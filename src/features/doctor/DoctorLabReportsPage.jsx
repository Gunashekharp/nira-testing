import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { useDemoData } from "../../app/DemoDataProvider";
import { getDoctorWorkspace } from "../shared/selectors";
import { formatDate, formatTime } from "../../lib/format";

export function DoctorLabReportsPage() {
  const { state } = useDemoData();
  const { labReports } = getDoctorWorkspace(state);

  return (
    <AppShell
      title="Doctor lab reports"
      subtitle="Review all lab reports tied to your patients. Updates from chart review are synced to patient view automatically."
      languageLabel="Doctor diagnostics in English"
    >
      <Card>
        <CardHeader
          eyebrow="Doctor diagnostics"
          title="Recent lab report updates"
          description="Draft reports can be refined in chart review; final reports are visible to patients right away."
          actions={
            <Button asChild variant="secondary">
              <Link to="/doctor">Back to dashboard</Link>
            </Button>
          }
        />

        <div className="space-y-4">
          {labReports.map((report) => (
            <Link key={report.id} to={`/doctor/patient/${report.appointmentId}`}>
              <div className="rounded-[24px] border border-line bg-surface-2 p-5 transition hover:-translate-y-0.5 hover:shadow-soft">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-semibold tracking-tight text-ink">{report.title}</h3>
                  <Badge tone={report.status === "final" ? "success" : "warning"}>
                    {report.status === "final" ? "Final" : "Draft"}
                  </Badge>
                  <Badge tone="neutral">{report.category}</Badge>
                </div>
                <div className="mt-2 text-sm text-muted">
                  Updated {formatDate(report.updatedAt)} at {formatTime(report.updatedAt)}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4 text-sm text-ink">{report.findings}</div>
                  <div className="rounded-2xl bg-white p-4 text-sm text-ink">{report.resultSummary}</div>
                </div>
              </div>
            </Link>
          ))}

          {labReports.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-line bg-surface-2 p-8 text-center text-sm text-muted">
              No lab reports yet. Add one while reviewing a patient chart.
            </div>
          ) : null}
        </div>
      </Card>
    </AppShell>
  );
}
