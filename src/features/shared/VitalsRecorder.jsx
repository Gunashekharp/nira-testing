import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, Heart, Thermometer, Wind, Droplets, Scale, Ruler, Calculator } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/utils";

const VITAL_FIELDS = [
  { key: "systolic", label: "Systolic BP", unit: "mmHg", icon: Heart, placeholder: "120", color: "text-red-500" },
  { key: "diastolic", label: "Diastolic BP", unit: "mmHg", icon: Heart, placeholder: "80", color: "text-red-400" },
  { key: "heartRate", label: "Heart Rate", unit: "bpm", icon: Activity, placeholder: "72", color: "text-pink-500" },
  { key: "temperature", label: "Temperature", unit: "°F", icon: Thermometer, placeholder: "98.6", color: "text-orange-500" },
  { key: "respiratory", label: "Respiratory Rate", unit: "/min", icon: Wind, placeholder: "16", color: "text-blue-500" },
  { key: "spo2", label: "SpO2", unit: "%", icon: Droplets, placeholder: "98", color: "text-cyan-500" },
  { key: "weight", label: "Weight", unit: "kg", icon: Scale, placeholder: "70", color: "text-green-500" },
  { key: "height", label: "Height", unit: "cm", icon: Ruler, placeholder: "170", color: "text-violet-500" },
];

function getRangeStatus(key, value) {
  const v = parseFloat(value);
  if (isNaN(v)) return null;
  const ranges = {
    systolic: { low: 90, normal: [90, 120], elevated: [121, 139], high: 140 },
    diastolic: { low: 60, normal: [60, 80], elevated: [81, 89], high: 90 },
    heartRate: { low: 60, normal: [60, 100], high: 100 },
    temperature: { low: 97, normal: [97, 99.5], high: 99.5 },
    respiratory: { low: 12, normal: [12, 20], high: 20 },
    spo2: { low: 95, normal: [95, 100] },
  };
  const r = ranges[key];
  if (!r) return null;
  if (v < r.low) return "low";
  if (r.high && v >= r.high) return "high";
  if (r.elevated && v >= r.elevated[0] && v <= r.elevated[1]) return "elevated";
  return "normal";
}

const STATUS_COLORS = {
  low: "text-blue-600 bg-blue-50",
  normal: "text-green-600 bg-green-50",
  elevated: "text-amber-600 bg-amber-50",
  high: "text-red-600 bg-red-50",
};

export function VitalsRecorder({ onSave }) {
  const [values, setValues] = useState({});
  const [saved, setSaved] = useState(false);

  const update = (key, val) => setValues((prev) => ({ ...prev, [key]: val }));

  const bmi = useMemo(() => {
    const w = parseFloat(values.weight);
    const h = parseFloat(values.height);
    if (!w || !h || h === 0) return null;
    return (w / ((h / 100) ** 2)).toFixed(1);
  }, [values.weight, values.height]);

  const bmiCategory = useMemo(() => {
    if (!bmi) return null;
    const v = parseFloat(bmi);
    if (v < 18.5) return { label: "Underweight", color: "text-blue-600" };
    if (v < 25) return { label: "Normal", color: "text-green-600" };
    if (v < 30) return { label: "Overweight", color: "text-amber-600" };
    return { label: "Obese", color: "text-red-600" };
  }, [bmi]);

  const handleSave = () => {
    const record = {
      ...values,
      bmi: bmi ? parseFloat(bmi) : null,
      recordedAt: new Date().toISOString(),
    };
    onSave?.(record);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Card className="p-6">
      <CardHeader
        eyebrow="Clinical"
        title="Vitals Recording"
        description="Record patient vital signs with automatic BMI calculation and range indicators."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {VITAL_FIELDS.map((field) => {
          const status = getRangeStatus(field.key, values[field.key]);
          const Icon = field.icon;
          return (
            <motion.div
              key={field.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-1.5"
            >
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <Icon className={cn("h-3.5 w-3.5", field.color)} />
                {field.label}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={values[field.key] || ""}
                  onChange={(e) => update(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border border-white/60 bg-white/80 px-3 py-2 pr-12 text-sm text-ink shadow-soft outline-none focus:border-brand-tide/40 focus:ring-1 focus:ring-brand-tide/20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted">{field.unit}</span>
              </div>
              {status && (
                <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", STATUS_COLORS[status])}>
                  {status}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* BMI Display */}
      {bmi && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-5 flex items-center gap-4 rounded-xl border border-white/60 bg-white/50 p-4 shadow-soft"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-tide/10">
            <Calculator className="h-5 w-5 text-brand-tide" />
          </div>
          <div>
            <div className="text-xs font-medium text-muted">Body Mass Index (Auto-Calculated)</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-ink">{bmi}</span>
              <span className="text-xs text-muted">kg/m²</span>
              {bmiCategory && (
                <span className={cn("text-sm font-semibold", bmiCategory.color)}>— {bmiCategory.label}</span>
              )}
            </div>
          </div>
        </motion.div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={handleSave}>
          Save Vitals
        </Button>
        {saved && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-green-600 font-medium">
            ✓ Vitals saved successfully
          </motion.span>
        )}
      </div>
    </Card>
  );
}
