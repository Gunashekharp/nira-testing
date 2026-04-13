import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, CheckCircle2, Clock, XCircle, Link2, FileKey, User2 } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { cn } from "../../lib/utils";

const CONSENT_STATUS = {
  pending: { label: "Pending", tone: "warning", icon: Clock },
  granted: { label: "Granted", tone: "success", icon: CheckCircle2 },
  revoked: { label: "Revoked", tone: "danger", icon: XCircle },
};

export function ABHAPanel({ patientName = "Patient" }) {
  const [abhaId, setAbhaId] = useState("");
  const [linked, setLinked] = useState(false);
  const [consents, setConsents] = useState([
    { id: "c1", purpose: "Health Records Access", provider: "NIRA EMR", status: "granted", expiry: "2027-01-15", grantedAt: "2025-12-15" },
    { id: "c2", purpose: "Insurance Claim Processing", provider: "Star Health", status: "pending", expiry: "2026-06-30", grantedAt: null },
    { id: "c3", purpose: "Lab Report Sharing", provider: "Thyrocare Labs", status: "revoked", expiry: "2025-11-01", grantedAt: "2025-08-20" },
  ]);

  const handleLink = () => {
    if (abhaId.trim().length >= 10) {
      setLinked(true);
    }
  };

  const updateConsent = (id, newStatus) => {
    setConsents((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: newStatus, grantedAt: newStatus === "granted" ? new Date().toISOString().slice(0, 10) : c.grantedAt } : c
      )
    );
  };

  return (
    <Card className="p-6">
      <CardHeader
        eyebrow="ABDM Integration"
        title="ABHA Health Account"
        description="Link Ayushman Bharat Health Account for unified health records and consent management."
      />

      {/* ABHA Linking */}
      <div className="mb-6 rounded-xl border border-white/60 bg-white/50 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-tide/10">
            <Link2 className="h-5 w-5 text-brand-tide" />
          </div>
          <div>
            <div className="text-sm font-semibold text-ink">ABHA ID Linkage</div>
            <div className="text-xs text-muted">
              {linked ? `Linked: ${abhaId}` : "Link patient's 14-digit ABHA number"}
            </div>
          </div>
          {linked && <Badge tone="success" className="ml-auto">Linked</Badge>}
        </div>

        {!linked ? (
          <div className="flex gap-2">
            <input
              value={abhaId}
              onChange={(e) => setAbhaId(e.target.value)}
              placeholder="XX-XXXX-XXXX-XXXX"
              maxLength={17}
              className="flex-1 rounded-xl border border-white/60 bg-white/80 px-4 py-2.5 text-sm text-ink shadow-soft outline-none focus:border-brand-tide/40"
            />
            <Button variant="primary" size="sm" onClick={handleLink} disabled={abhaId.trim().length < 10}>
              <Link2 className="h-3.5 w-3.5 mr-1" /> Link
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            ABHA account verified and linked for {patientName}
          </div>
        )}
      </div>

      {/* Consent Management */}
      <div className="space-y-1 mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <FileKey className="h-4 w-4 text-brand-tide" />
          Consent Management
        </div>
        <div className="text-xs text-muted">Manage data sharing consent with health information providers.</div>
      </div>

      <div className="space-y-3">
        {consents.map((consent, i) => {
          const cfg = CONSENT_STATUS[consent.status];
          const Icon = cfg.icon;
          return (
            <motion.div
              key={consent.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-xl border border-white/60 bg-white/70 p-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Icon className={cn("h-5 w-5 mt-0.5", consent.status === "granted" ? "text-green-500" : consent.status === "revoked" ? "text-red-400" : "text-amber-500")} />
                  <div>
                    <div className="text-sm font-semibold text-ink">{consent.purpose}</div>
                    <div className="text-xs text-muted">{consent.provider} • Expires {consent.expiry}</div>
                    {consent.grantedAt && <div className="text-[10px] text-muted/60 mt-0.5">Granted: {consent.grantedAt}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={cfg.tone}>{cfg.label}</Badge>
                  {consent.status === "pending" && (
                    <div className="flex gap-1">
                      <Button variant="primary" size="sm" onClick={() => updateConsent(consent.id, "granted")}>Grant</Button>
                      <Button variant="secondary" size="sm" onClick={() => updateConsent(consent.id, "revoked")}>Deny</Button>
                    </div>
                  )}
                  {consent.status === "granted" && (
                    <Button variant="secondary" size="sm" onClick={() => updateConsent(consent.id, "revoked")}>Revoke</Button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
