import { Link } from "react-router-dom";
import { ChevronRight, FileText } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { useDemoData } from "../../app/DemoDataProvider";
import { getPatientWorkspace } from "../shared/selectors";
import { formatDate } from "../../lib/format";

export function PrescriptionsPage() {
  const { state } = useDemoData();
  const { prescriptions } = getPatientWorkspace(state);

  return (
    <AppShell
      title="My prescriptions"
      subtitle="Approved visit outputs are kept here in a clean, mobile-friendly layout so patients can revisit medicines and follow-up notes anytime."
      languageLabel="Prescription view in English / Hindi"
    >
      <Card>
        <CardHeader
          eyebrow="Portal output"
          title="Issued prescriptions"
          description="Every approved doctor action appears here instantly from the dummy local workflow."
          actions={
            <Button asChild variant="secondary">
              <Link to="/patient">Back home</Link>
            </Button>
          }
        />
        <div className="space-y-4">
          {prescriptions.map((prescription) => (
            <Link key={prescription.id} to={`/patient/prescriptions/${prescription.id}`}>
              <div className="grid gap-4 rounded-[24px] border border-line bg-surface-2 p-5 transition hover:-translate-y-0.5 hover:shadow-soft md:grid-cols-[1fr_auto] md:items-center">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tone="success">{formatDate(prescription.issuedAt)}</Badge>
                    <Badge tone="neutral">{prescription.medicines.length} medications</Badge>
                  </div>
                  <div className="text-lg font-semibold tracking-tight text-ink">{prescription.followUpNote}</div>
                  <div className="flex flex-wrap gap-2 text-sm text-muted">
                    {prescription.medicines.slice(0, 2).map((medicine) => (
                      <span key={medicine.name} className="pill">
                        {medicine.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-brand-tide">
                  <FileText className="h-5 w-5" />
                  View details
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </Link>
          ))}
          {prescriptions.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-line bg-surface-2 p-8 text-center text-sm text-muted">
              Prescriptions will appear here after a doctor approves a chart from the doctor portal.
            </div>
          ) : null}
        </div>
      </Card>
    </AppShell>
  );
}
