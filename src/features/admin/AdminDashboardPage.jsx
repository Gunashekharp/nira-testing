import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { StatCard } from "../../components/ui/StatCard";
import { useDemoData } from "../../app/DemoDataProvider";
import { getAdminWorkspace } from "../shared/selectors";

export function AdminDashboardPage() {
  const { state, actions } = useDemoData();
  const { counts, pendingDoctors, appointments } = getAdminWorkspace(state);

  return (
    <AppShell
      title="Admin console"
      subtitle="Operate the clinic from one place: approve doctors, maintain availability, and manage appointment flow."
      languageLabel="Admin UI in English"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Doctors" value={`${counts.doctors}`} tone="accent" />
          <StatCard label="Pending approvals" value={`${counts.pendingDoctors}`} tone="soft" />
          <StatCard label="Patients" value={`${counts.patients}`} />
          <StatCard label="Appointments" value={`${counts.appointments}`} />
          <StatCard label="Lab requests" value={`${counts.labOrders}`} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader
              eyebrow="Pending doctor approvals"
              title={pendingDoctors.length ? "Approval queue" : "No approvals waiting"}
              description="Public doctor signups land here until an admin activates them."
            />
            <div className="space-y-3">
              {pendingDoctors.map((doctor) => (
                <div key={doctor.id} className="rounded-[24px] border border-line bg-surface-2 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-ink">{doctor.fullName}</div>
                      <div className="mt-1 text-sm text-muted">
                        {doctor.specialty} · {doctor.licenseNumber}
                      </div>
                    </div>
                    <Badge tone="warning">Pending</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button size="sm" onClick={() => actions.admin.approveDoctor(doctor.id)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => actions.admin.rejectDoctor(doctor.id)}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
              {!pendingDoctors.length ? (
                <div className="rounded-[24px] border border-dashed border-line bg-surface-2 p-6 text-sm text-muted">
                  No pending doctor approvals right now.
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Quick links"
              title="Operational workspaces"
              description="Use the focused pages below to manage doctors, appointments, and patient visibility."
            />
            <div className="grid gap-4 md:grid-cols-3">
              <Link to="/admin/doctors" className="rounded-[24px] border border-line bg-surface-2 p-5 transition hover:-translate-y-0.5 hover:shadow-soft">
                <div className="text-base font-semibold text-ink">Doctors</div>
                <div className="mt-2 text-sm leading-6 text-muted">Add, edit, approve, deactivate, archive, and maintain schedules.</div>
              </Link>
              <Link to="/admin/appointments" className="rounded-[24px] border border-line bg-surface-2 p-5 transition hover:-translate-y-0.5 hover:shadow-soft">
                <div className="text-base font-semibold text-ink">Appointments</div>
                <div className="mt-2 text-sm leading-6 text-muted">Cancel or reschedule bookings and watch slot changes reflect everywhere.</div>
              </Link>
              <Link to="/admin/patients" className="rounded-[24px] border border-line bg-surface-2 p-5 transition hover:-translate-y-0.5 hover:shadow-soft">
                <div className="text-base font-semibold text-ink">Patients</div>
                <div className="mt-2 text-sm leading-6 text-muted">Add, edit, archive, and restore patients with profile and lab context.</div>
              </Link>
            </div>
            <div className="mt-6 rounded-[24px] border border-line bg-surface-2 p-5 text-sm text-muted">
              Upcoming appointments in the system: <span className="font-semibold text-ink">{appointments.length}</span>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
