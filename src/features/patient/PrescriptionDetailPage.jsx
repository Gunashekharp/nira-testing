import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { useDemoData } from "../../app/DemoDataProvider";
import { getPatientWorkspace } from "../shared/selectors";
import { formatDate, formatTime } from "../../lib/format";

export function PrescriptionDetailPage() {
  const { prescriptionId } = useParams();
  const { state } = useDemoData();
  const { prescriptions } = getPatientWorkspace(state);
  const prescription = prescriptions.find((item) => item.id === prescriptionId) ?? prescriptions[0];

  return (
    <AppShell
      title="Prescription detail"
      subtitle="A patient-friendly view of medicines, timing, and warning notes generated after doctor approval."
      languageLabel="Prescription detail in English / Hindi"
    >
      <Card>
        <CardHeader
          eyebrow="Issued medication sheet"
          title={prescription ? `Issued ${formatDate(prescription.issuedAt)}` : "Prescription not found"}
          description={
            prescription
              ? `Shared at ${formatTime(prescription.issuedAt)} and synced instantly to the patient portal demo.`
              : "No prescription is available for this route."
          }
          actions={
            <Button asChild variant="secondary">
              <Link to="/patient/prescriptions">
                <ArrowLeft className="h-4 w-4" />
                All prescriptions
              </Link>
            </Button>
          }
        />
        {prescription ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <div className="space-y-4">
              {prescription.medicines.map((medicine) => (
                <div key={`${prescription.id}-${medicine.name}`} className="rounded-[24px] border border-line bg-surface-2 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold tracking-tight text-ink">{medicine.name}</h3>
                    <Badge tone="info">{medicine.duration}</Badge>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm text-muted sm:grid-cols-3">
                    <div>
                      <div className="section-title">Dose</div>
                      <div className="mt-2 font-semibold text-ink">{medicine.dosage}</div>
                    </div>
                    <div>
                      <div className="section-title">When</div>
                      <div className="mt-2 font-semibold text-ink">{medicine.frequency}</div>
                    </div>
                    <div>
                      <div className="section-title">Instruction</div>
                      <div className="mt-2 font-semibold text-ink">{medicine.instructions}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-5 w-5 text-amber-700" />
                  <div className="text-sm font-semibold text-amber-900">Warnings & red flags</div>
                </div>
                <div className="mt-4 space-y-2 text-sm text-amber-900/90">
                  {prescription.warnings.map((warning) => (
                    <div key={warning} className="rounded-2xl border border-amber-200 bg-white/60 px-4 py-3">
                      {warning}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[24px] border border-line bg-surface-2 p-5">
                <div className="section-title">Follow-up</div>
                <div className="mt-3 text-base font-semibold text-ink">{prescription.followUpNote}</div>
                <p className="mt-3 text-sm leading-6 text-muted">
                  This is a patient-friendly summary, designed so the backend team can later plug in real PDF and portal delivery.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </Card>
    </AppShell>
  );
}
