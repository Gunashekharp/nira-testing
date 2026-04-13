import { useState } from "react";
import { motion } from "framer-motion";
import { History, ChevronDown, ChevronRight, User2, Clock, FileEdit, ArrowRight } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { cn } from "../../lib/utils";

const MOCK_LOGS = [
  {
    id: "log1",
    field: "Assessment — Primary Diagnosis",
    originalValue: "Viral Upper Respiratory Infection",
    editedValue: "Acute Bronchitis (J20.9)",
    reason: "After reviewing chest X-ray, bronchitis is more accurate",
    aiConfidence: 0.72,
    editedBy: "Dr. Priya Sharma",
    editedAt: "2026-04-09T14:30:00Z",
  },
  {
    id: "log2",
    field: "Plan — Medication",
    originalValue: "Amoxicillin 500mg TID × 5 days",
    editedValue: "Azithromycin 500mg OD × 3 days",
    reason: "Patient allergic to penicillin — switched to macrolide",
    aiConfidence: 0.85,
    editedBy: "Dr. Priya Sharma",
    editedAt: "2026-04-09T14:32:00Z",
  },
  {
    id: "log3",
    field: "Subjective — History",
    originalValue: "Cough for 3 days",
    editedValue: "Productive cough for 5 days with yellowish sputum, worsening at night",
    reason: "Patient provided additional details during consultation",
    aiConfidence: 0.65,
    editedBy: "Dr. Priya Sharma",
    editedAt: "2026-04-09T14:25:00Z",
  },
  {
    id: "log4",
    field: "Objective — Vitals",
    originalValue: "SpO2: 97%",
    editedValue: "SpO2: 94% (corrected after re-measurement)",
    reason: "Initial reading was inaccurate due to cold fingers",
    aiConfidence: 0.9,
    editedBy: "Nurse Anita",
    editedAt: "2026-04-09T14:20:00Z",
  },
];

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function AuditTrail({ logs = MOCK_LOGS }) {
  const [expanded, setExpanded] = useState(new Set());

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card className="p-6">
      <CardHeader
        eyebrow="Compliance"
        title="Audit Trail"
        description="Complete record of all clinical edits made to AI-generated content, with reasons and timestamps."
      />

      <div className="space-y-2">
        {logs.map((log, i) => {
          const isOpen = expanded.has(log.id);
          return (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-xl border border-white/60 bg-white/70 shadow-soft overflow-hidden"
            >
              <button
                onClick={() => toggle(log.id)}
                className="flex w-full items-center gap-3 p-4 text-left hover:bg-white/50 transition"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted flex-shrink-0" />
                )}
                <FileEdit className="h-4 w-4 text-brand-tide flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{log.field}</div>
                  <div className="text-xs text-muted">{log.editedBy} • {formatTime(log.editedAt)}</div>
                </div>
                <Badge tone="info">AI {Math.round(log.aiConfidence * 100)}%</Badge>
              </button>

              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="border-t border-white/40 px-4 pb-4 pt-3 ml-11"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 rounded-lg bg-red-50 border border-red-100 p-3">
                        <div className="text-[10px] font-semibold uppercase text-red-400 mb-1">Original (AI)</div>
                        <div className="text-sm text-red-800 line-through">{log.originalValue}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted mt-6 flex-shrink-0" />
                      <div className="flex-1 rounded-lg bg-green-50 border border-green-100 p-3">
                        <div className="text-[10px] font-semibold uppercase text-green-500 mb-1">Edited</div>
                        <div className="text-sm text-green-800 font-medium">{log.editedValue}</div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                      <div className="text-[10px] font-semibold uppercase text-amber-500 mb-1">Reason for Edit</div>
                      <div className="text-sm text-amber-800">{log.reason}</div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted">
                      <span className="flex items-center gap-1"><User2 className="h-3 w-3" /> {log.editedBy}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(log.editedAt)} at {formatTime(log.editedAt)}</span>
                      <span className="flex items-center gap-1"><History className="h-3 w-3" /> AI Confidence: {Math.round(log.aiConfidence * 100)}%</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
