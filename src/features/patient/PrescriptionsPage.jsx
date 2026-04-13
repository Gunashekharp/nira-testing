import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarDays, Clock3, FileDown, Home, Pill, RotateCcw, Search, Sparkles } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { useDemoData } from "../../app/DemoDataProvider";
import { getPatientWorkspace } from "../shared/selectors";
import { formatDate } from "../../lib/format";

function getPrescriptionBucket(prescription) {
  const issuedDate = new Date(prescription.issuedAt);
  const daysSinceIssued = Math.floor((Date.now() - issuedDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceIssued > 45) {
    return "expired";
  }

  if (daysSinceIssued > 15) {
    return "past";
  }

  return "active";
}

export function PrescriptionsPage() {
  const { state } = useDemoData();
  const { prescriptions } = getPatientWorkspace(state);
  const [tab, setTab] = useState("active");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");

  const filtered = useMemo(() => {
    return prescriptions.filter((rx) => {
      const bucket = getPrescriptionBucket(rx);
      if (bucket !== tab) {
        return false;
      }

      const haystack = `${rx.followUpNote} ${rx.medicines.map((item) => item.name).join(" ")}`.toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      const matchesDate = !fromDate || rx.issuedAt.slice(0, 10) >= fromDate;
      return matchesSearch && matchesDate;
    });
  }, [prescriptions, tab, search, fromDate]);

  const tabCounts = {
    active: prescriptions.filter((rx) => getPrescriptionBucket(rx) === "active").length,
    past: prescriptions.filter((rx) => getPrescriptionBucket(rx) === "past").length,
    expired: prescriptions.filter((rx) => getPrescriptionBucket(rx) === "expired").length
  };

  return (
    <AppShell
      title="Prescriptions"
      subtitle="Instant PDF access with Active, Past, and Expired filters."
    >
      <div className="space-y-4">
        <Card density="compact">
          <CardHeader
            eyebrow="Rx center"
            title="Your medicines"
            description="Goal: instant PDF access"
            actions={
              <Button asChild variant="secondary">
                <Link to="/patient">
                  <Home className="h-4 w-4" />
                  Back home
                </Link>
              </Button>
            }
          />

          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-white p-1.5">
              {[
                { key: "active", label: "Active", icon: Pill },
                { key: "past", label: "Past", icon: Clock3 },
                { key: "expired", label: "Expired", icon: AlertTriangle }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition sm:px-3 sm:text-sm ${
                    tab === item.key
                      ? "bg-brand-sky text-white"
                      : "text-ink hover:bg-surface-2"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className="icon-wrap-soft">
                      <item.icon className="h-3.5 w-3.5 icon-glow" />
                    </span>
                    {item.label} ({tabCounts[item.key]})
                  </span>
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 icon-wrap-soft">
                <CalendarDays className="h-3.5 w-3.5 text-muted" />
              </span>
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="w-full rounded-xl border border-line bg-white pl-10 pr-3 py-2 text-sm outline-none focus:border-brand-sky"
              />
            </div>
          </div>

          <div className="mt-3 relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 icon-wrap-soft">
              <Search className="h-3.5 w-3.5 text-muted" />
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search medicine or note"
              className="w-full rounded-xl border border-line bg-white pl-10 pr-3 py-2.5 text-sm outline-none focus:border-brand-sky"
            />
          </div>

          <div className="mt-4 space-y-3">
            {filtered.map((prescription) => {
              const firstMed = prescription.medicines[0];
              const duration = firstMed?.duration || "As prescribed";
              const expiry = new Date(prescription.issuedAt);
              expiry.setDate(expiry.getDate() + 14);

              return (
                <div key={prescription.id} className="rounded-2xl border border-line bg-surface-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-ink">{firstMed?.name || "Prescription"}</div>
                      <div className="mt-1 text-sm text-muted">
                        {firstMed?.dosage || "-"} | {duration} | Exp {expiry.toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="info">{formatDate(prescription.issuedAt)}</Badge>
                      <Badge tone={tab === "expired" ? "danger" : "success"}>{tab.toUpperCase()}</Badge>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild variant="secondary" size="sm">
                      <Link to={`/patient/prescriptions/${prescription.id}`}>
                        <FileDown className="h-4 w-4" />
                        PDF ↓
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/patient/booking">
                        <RotateCcw className="h-4 w-4" />
                        Refill
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}

            {!filtered.length ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface-2 p-6 text-center">
                <Pill className="mx-auto mb-3 h-5 w-5 text-brand-tide" />
                <div className="text-base font-semibold text-ink">No Rx found</div>
                <div className="mt-2 text-sm text-muted">No Rx? Try AI Symptom Check</div>
                <div className="mt-4">
                  <Button asChild variant="secondary">
                    <Link to="/patient/booking">
                      <Sparkles className="h-4 w-4" />
                      Book visit
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
