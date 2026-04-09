import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Card, CardHeader } from "../../components/ui/Card";
import { useDemoData } from "../../app/DemoDataProvider";
import { getAdminWorkspace } from "../shared/selectors";

export function AdminPatientsPage() {
  const { state } = useDemoData();
  const { patients } = getAdminWorkspace(state);

  return (
    <AppShell
      title="Patient directory"
      subtitle="Read-only patient records for demo operations, including optional profile details added during or after signup."
      languageLabel="Admin UI in English"
    >
      <Card>
        <CardHeader
          eyebrow="Directory"
          title="Clinic patients"
          description="This pass keeps patient directory management read-only while exposing the richer profile shape."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {patients.map((patient) => (
            <div key={patient.id} className="rounded-[24px] border border-line bg-surface-2 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-base font-semibold text-ink">{patient.fullName}</div>
                <Badge tone={patient.preferredLanguage === "hi" ? "warning" : "info"}>
                  {patient.preferredLanguage === "hi" ? "Hindi" : "English"}
                </Badge>
                {patient.abhaNumber ? <Badge tone="success">ABHA linked</Badge> : <Badge tone="neutral">ABHA optional</Badge>}
              </div>
              <div className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-2">
                <div>Phone: <span className="font-semibold text-ink">{patient.phone || "-"}</span></div>
                <div>Email: <span className="font-semibold text-ink">{patient.email || "-"}</span></div>
                <div>Age: <span className="font-semibold text-ink">{patient.age || "-"}</span></div>
                <div>Gender: <span className="font-semibold text-ink">{patient.gender || "-"}</span></div>
                <div>City: <span className="font-semibold text-ink">{patient.city || "-"}</span></div>
                <div>Emergency: <span className="font-semibold text-ink">{patient.emergencyContactName || "-"}</span></div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
