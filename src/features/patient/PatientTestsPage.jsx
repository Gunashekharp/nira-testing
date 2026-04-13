import { Link } from "react-router-dom";
import { Calendar, Home, Stethoscope, TestTube } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { useDemoData } from "../../app/DemoDataProvider";
import { getPatientWorkspace } from "../shared/selectors";
import { formatDate } from "../../lib/format";

export function PatientTestsPage() {
  const { state } = useDemoData();
  const { testOrders, patient } = getPatientWorkspace(state);

  return (
    <AppShell
      title="Tests"
      subtitle="Investigations your doctor ordered during visits appear here, with matching alerts in notifications."
    >
      <div className="space-y-4">
        <Card density="compact">
          <CardHeader
            eyebrow="Diagnostics"
            title="Ordered tests"
            description="When your doctor selects investigations in Unified EMR and approves the visit, the list is published here."
            actions={
              <Button asChild variant="secondary">
                <Link to="/patient">
                  <Home className="h-4 w-4" />
                  Back home
                </Link>
              </Button>
            }
          />

          <div className="space-y-3">
            {testOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-line bg-surface-2 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-tide/15 text-brand-tide">
                        <TestTube className="h-4 w-4" />
                      </span>
                      <span className="text-base font-semibold text-ink">
                        Visit order
                      </span>
                      <Badge tone="info">{formatDate(order.orderedAt)}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                        <Stethoscope className="h-3.5 w-3.5" />
                        {order.doctorName || "Clinician"}
                      </span>
                    </p>
                  </div>
                  <Badge tone="success">{order.status === "ordered" ? "ORDERED" : String(order.status || "").toUpperCase()}</Badge>
                </div>

                {order.tests?.length > 0 ? (
                  <ul className="mt-4 space-y-2 border-t border-line/80 pt-4">
                    {order.tests.map((name) => (
                      <li
                        key={name}
                        className="flex items-start gap-2 text-sm text-ink"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-sky" />
                        {name}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {order.patientNote ? (
                  <div className="mt-4 rounded-xl border border-line bg-white/80 p-3 text-sm text-ink">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted">Doctor instructions</div>
                    <p className="mt-1 whitespace-pre-wrap">{order.patientNote}</p>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/patient/appointments/${order.appointmentId}`}>
                      <Calendar className="h-4 w-4" />
                      Related appointment
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/patient/lab-reports">Lab reports</Link>
                  </Button>
                </div>
              </div>
            ))}

            {!testOrders.length ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface-2 p-8 text-center">
                <TestTube className="mx-auto mb-3 h-8 w-8 text-brand-tide" />
                <div className="text-base font-semibold text-ink">No tests ordered yet</div>
                <p className="mt-2 text-sm text-muted">
                  When your doctor adds investigations in Unified EMR and clicks Approve and publish Rx, they will show up here
                  {patient ? ` for ${patient.fullName}` : ""}.
                </p>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
