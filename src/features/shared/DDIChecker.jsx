import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Shield, Search, Pill } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/utils";

export const KNOWN_INTERACTIONS = [
  { drugA: "Warfarin", drugB: "Aspirin", severity: "high", description: "Increased bleeding risk. Combined anticoagulant/antiplatelet effect.", recommendation: "Avoid combination or monitor INR closely." },
  { drugA: "Metformin", drugB: "Ibuprofen", severity: "moderate", description: "NSAIDs may reduce renal function, affecting metformin clearance.", recommendation: "Monitor renal function. Consider acetaminophen." },
  { drugA: "Lisinopril", drugB: "Potassium", severity: "high", description: "ACE inhibitors increase potassium retention. Risk of hyperkalemia.", recommendation: "Monitor serum potassium levels regularly." },
  { drugA: "Amoxicillin", drugB: "Methotrexate", severity: "high", description: "Amoxicillin may decrease renal clearance of methotrexate.", recommendation: "Monitor methotrexate levels. Consider alternative antibiotic." },
  { drugA: "Omeprazole", drugB: "Clopidogrel", severity: "moderate", description: "Omeprazole reduces the antiplatelet effect of clopidogrel via CYP2C19.", recommendation: "Use pantoprazole instead or separate dosing by 12 hours." },
  { drugA: "Ciprofloxacin", drugB: "Theophylline", severity: "high", description: "Ciprofloxacin inhibits CYP1A2, increasing theophylline toxicity risk.", recommendation: "Reduce theophylline dose or use alternative antibiotic." },
  { drugA: "Atorvastatin", drugB: "Clarithromycin", severity: "moderate", description: "Clarithromycin increases statin levels via CYP3A4 inhibition.", recommendation: "Limit atorvastatin dose to 20mg or use azithromycin." },
  { drugA: "Diazepam", drugB: "Opioid", severity: "critical", description: "Combined CNS depression. Risk of respiratory failure and death.", recommendation: "AVOID combination. Use lowest doses if absolutely necessary." },
];

const SEVERITY_CONFIG = {
  none: { label: "No Interaction", color: "text-green-700 bg-green-50 border-green-200", icon: CheckCircle2 },
  low: { label: "Low Risk", color: "text-blue-700 bg-blue-50 border-blue-200", icon: Shield },
  moderate: { label: "Moderate", color: "text-amber-700 bg-amber-50 border-amber-200", icon: AlertTriangle },
  high: { label: "High Risk", color: "text-red-600 bg-red-50 border-red-200", icon: AlertTriangle },
  critical: { label: "Critical", color: "text-red-800 bg-red-100 border-red-300", icon: AlertTriangle },
};

export function findDrugInteractions(drugs = []) {
  const results = [];
  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      const a = drugs[i].toLowerCase();
      const b = drugs[j].toLowerCase();
      const match = KNOWN_INTERACTIONS.find(
        (ix) =>
          (ix.drugA.toLowerCase() === a && ix.drugB.toLowerCase() === b) ||
          (ix.drugA.toLowerCase() === b && ix.drugB.toLowerCase() === a)
      );
      if (match) {
        results.push({ ...match, pair: [drugs[i], drugs[j]] });
      }
    }
  }
  return results;
}

export function DDIChecker() {
  const [drugs, setDrugs] = useState([""]);
  const [results, setResults] = useState(null);
  const [checked, setChecked] = useState(false);

  const addDrug = () => setDrugs((prev) => [...prev, ""]);
  const removeDrug = (idx) => setDrugs((prev) => prev.filter((_, i) => i !== idx));
  const updateDrug = (idx, val) => setDrugs((prev) => prev.map((d, i) => (i === idx ? val : d)));

  const runCheck = () => {
    const valid = drugs.filter((d) => d.trim());
    if (valid.length < 2) return;
    const interactions = findDrugInteractions(valid);
    setResults(interactions);
    setChecked(true);
  };

  return (
    <Card className="p-6">
      <CardHeader
        eyebrow="Drug Safety"
        title="Drug-Drug Interaction Checker"
        description="Enter medications to check for known interactions and contraindications."
      />

      <div className="space-y-3 mb-4">
        {drugs.map((drug, i) => (
          <div key={i} className="flex items-center gap-2">
            <Pill className="h-4 w-4 text-brand-tide flex-shrink-0" />
            <input
              value={drug}
              onChange={(e) => updateDrug(i, e.target.value)}
              placeholder={`Medication ${i + 1} (e.g., Warfarin, Aspirin)`}
              className="flex-1 rounded-xl border border-white/60 bg-white/80 px-4 py-2.5 text-sm text-ink shadow-soft outline-none focus:border-brand-tide/40 focus:ring-1 focus:ring-brand-tide/20"
            />
            {drugs.length > 1 && (
              <button onClick={() => removeDrug(i)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-6">
        <Button variant="secondary" size="sm" onClick={addDrug}>+ Add Medication</Button>
        <Button variant="primary" size="sm" onClick={runCheck} disabled={drugs.filter((d) => d.trim()).length < 2}>
          <Search className="h-3.5 w-3.5 mr-1.5" /> Check Interactions
        </Button>
      </div>

      {checked && results !== null && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {results.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-sm font-semibold text-green-800">No Known Interactions Found</div>
                <div className="text-xs text-green-600">All checked medication pairs appear safe to combine.</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-ink">{results.length} interaction{results.length > 1 ? "s" : ""} found:</div>
              {results.map((r, i) => {
                const cfg = SEVERITY_CONFIG[r.severity] || SEVERITY_CONFIG.moderate;
                const Icon = cfg.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={cn("rounded-xl border p-4", cfg.color)}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                      <div className="space-y-1">
                        <div className="text-sm font-semibold">{r.pair[0]} + {r.pair[1]} — {cfg.label}</div>
                        <div className="text-xs">{r.description}</div>
                        <div className="text-xs font-medium">💡 {r.recommendation}</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </Card>
  );
}
