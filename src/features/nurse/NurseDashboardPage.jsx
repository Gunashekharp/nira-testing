import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  HeartPulse,
  MessageSquareMore,
  Pill,
  ScanFace,
  ShieldCheck,
  Siren,
  Sparkles,
  Star,
  Stethoscope,
  Target,
  Thermometer,
  Upload,
  UserRoundCheck,
  Volume2
} from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { StatCard } from "../../components/ui/StatCard";
import { useDemoData } from "../../app/DemoDataProvider";
import { getCurrentProfile } from "../../features/shared/selectors";
import { formatTime } from "../../lib/format";
import { cn, initials } from "../../lib/utils";
import { listCollection } from "../../services/stateHelpers";

const SCREEN_LINKS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "vitals", label: "Vitals" },
  { id: "meds", label: "Meds" },
  { id: "patients", label: "Patients" },
  { id: "tasks", label: "Tasks" },
  { id: "alerts", label: "Alerts" },
  { id: "docs", label: "Docs" },
  { id: "comm", label: "Comm" }
];

function parseBloodPressure(value = "") {
  const match = String(value).match(/(\d+)\s*\/?\s*(\d+)?/);
  if (!match) {
    return { systolic: null, diastolic: null };
  }

  return {
    systolic: Number(match[1]),
    diastolic: match[2] ? Number(match[2]) : null
  };
}

function buildTrendPoints(values, width = 280, height = 96) {
  if (!values.length) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / span) * (height - 12) - 6;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildNurseChecklist(profile) {
  return [
    { key: "fullName", label: "Full name", ok: Boolean(profile?.fullName?.trim()) },
    { key: "nursingLicenseNumber", label: "Nursing license number", ok: Boolean(profile?.nursingLicenseNumber?.trim()) },
    { key: "department", label: "Department", ok: Boolean(profile?.department?.trim()) },
    { key: "shift", label: "Shift", ok: Boolean(profile?.shift?.trim()) },
    { key: "assignedWard", label: "Assigned ward", ok: Boolean(profile?.assignedWard?.trim()) },
    { key: "phone", label: "Phone", ok: Boolean(profile?.phone?.trim()) },
    { key: "email", label: "Email", ok: Boolean(profile?.email?.trim()) },
    { key: "emergencyContactName", label: "Emergency contact name", ok: Boolean(profile?.emergencyContactName?.trim()) },
    { key: "emergencyContactPhone", label: "Emergency contact phone", ok: Boolean(profile?.emergencyContactPhone?.trim()) }
  ];
}

function getSectionTone(status) {
  if (status === "critical") return "danger";
  if (status === "warning") return "warning";
  if (status === "success") return "success";
  return "info";
}

function SectionHeading({ eyebrow, title, description }) {
  return <CardHeader eyebrow={eyebrow} title={title} description={description} />;
}

export function NurseDashboardPage() {
  const { state, actions } = useDemoData();
  const nurse = getCurrentProfile(state);
  const checklist = useMemo(() => buildNurseChecklist(nurse), [nurse]);
  const today = state?.meta?.today;

  const todayCases = useMemo(() => {
    if (!state || !today) {
      return [];
    }

    return listCollection(state.appointments)
      .filter((appointment) => appointment.bookingStatus !== "cancelled" && appointment.startAt.slice(0, 10) === today)
      .sort((left, right) => new Date(left.startAt) - new Date(right.startAt))
      .map((appointment, index) => {
        const patient = state.patients.byId[appointment.patientId];
        const encounter = state.encounters.byId[`encounter-${appointment.id}`];
        const prescription = encounter?.prescriptionId ? state.prescriptions.byId[encounter.prescriptionId] : null;
        const draft = encounter?.apciDraft;
        const vitals = draft?.vitals || {};
        const bp = parseBloodPressure(vitals.bloodPressure);
        const hasHighBP = (bp.systolic || 0) >= 160 || (bp.diastolic || 0) >= 100;
        const hasVitals = Boolean(vitals.bloodPressure || vitals.pulse || vitals.temperature || vitals.spo2);
        const needsVitals = encounter?.status === "awaiting_interview" || !hasVitals || appointment.bookingStatus === "checked_in";
        const needsMedication = Boolean(prescription || draft?.medicationSuggestions?.length);
        const alerts = [];

        if (hasHighBP) alerts.push("High BP");
        if (needsVitals) alerts.push("Missed vitals");
        if (appointment.bookingStatus === "completed") alerts.push("Discharge follow-up");
        if (encounter?.alerts?.length) alerts.push(encounter.alerts[0]);

        const nextTask = hasHighBP
          ? "Escalate BP"
          : needsVitals
            ? "Capture vitals"
            : needsMedication
              ? "Administer meds"
              : "Document progress";

        const status = appointment.bookingStatus === "completed"
          ? "Completed"
          : encounter?.status === "in_consult"
            ? "In consult"
            : encounter?.status === "ai_ready"
              ? "Vitals ready"
              : encounter?.status === "awaiting_interview"
                ? "Waiting"
                : "Queued";

        return {
          ...appointment,
          patient,
          encounter,
          prescription,
          draft,
          vitals,
          bp,
          alerts,
          nextTask,
          status,
          bedLabel: `Bed ${index + 5}`,
          queuePriority: hasHighBP ? 0 : needsVitals ? 1 : 2
        };
      });
  }, [state, today]);

  const todayStats = useMemo(() => {
    const vitalCount = todayCases.filter((item) => Boolean(item.vitals?.bloodPressure || item.vitals?.pulse || item.vitals?.temperature || item.vitals?.spo2)).length;
    const medCount = todayCases.filter((item) => Boolean(item.prescription || item.draft?.medicationSuggestions?.length)).length;
    const criticalCount = todayCases.filter((item) => item.alerts.some((alert) => alert === "High BP" || alert === "Missed vitals")).length;

    return {
      totalPatients: todayCases.length,
      alerts: criticalCount,
      vitalsTaken: vitalCount,
      medCompletion: todayCases.length ? Math.round((medCount / todayCases.length) * 100) : 0,
      vitalsCompletion: todayCases.length ? `${vitalCount}/${todayCases.length}` : "0/0",
      medsCompletion: todayCases.length ? `${medCount}/${todayCases.length}` : "0/0"
    };
  }, [todayCases]);

  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [scanValue, setScanValue] = useState("");
  const [barcodeValue, setBarcodeValue] = useState("");
  const [noteValue, setNoteValue] = useState("Family updated. Continue monitoring and document pain score after the next round.");
  const [statusBanner, setStatusBanner] = useState("Ready for ward round");
  const [ackedAlerts, setAckedAlerts] = useState([]);
  const [vitalsForm, setVitalsForm] = useState({
    bloodPressure: "",
    pulse: "",
    temperature: "",
    spo2: "",
    painScore: "3"
  });

  useEffect(() => {
    if (!selectedPatientId && todayCases.length) {
      setSelectedPatientId(todayCases[0].patient?.id || todayCases[0].patientId);
      setScanValue(todayCases[0].patient?.id || todayCases[0].patientId || "");
      setBarcodeValue(todayCases[0].prescription?.medicines?.[0]?.name || todayCases[0].draft?.medicationSuggestions?.[0]?.name || "");
    }
  }, [selectedPatientId, todayCases]);

  const selectedCase = useMemo(() => {
    if (!todayCases.length) {
      return null;
    }

    return todayCases.find((item) => item.patient?.id === selectedPatientId || item.patientId === selectedPatientId) || todayCases[0];
  }, [selectedPatientId, todayCases]);

  const patientLookup = useMemo(() => {
    const needle = scanValue.trim().toLowerCase();
    if (!needle) {
      return selectedCase;
    }

    return (
      todayCases.find((item) => {
        const haystacks = [item.patient?.id, item.patient?.fullName, item.bedLabel, item.token]
          .filter(Boolean)
          .map((entry) => String(entry).toLowerCase());
        return haystacks.some((entry) => entry.includes(needle));
      }) || selectedCase
    );
  }, [scanValue, selectedCase, todayCases]);

  useEffect(() => {
    if (!patientLookup) {
      return;
    }

    setVitalsForm({
      bloodPressure: String(patientLookup.vitals?.bloodPressure || ""),
      pulse: String(patientLookup.vitals?.pulse || ""),
      temperature: String(patientLookup.vitals?.temperature || ""),
      spo2: String(patientLookup.vitals?.spo2 || ""),
      painScore: String(patientLookup.vitals?.painScore || "3")
    });
  }, [
    patientLookup?.id,
    patientLookup?.vitals?.bloodPressure,
    patientLookup?.vitals?.pulse,
    patientLookup?.vitals?.temperature,
    patientLookup?.vitals?.spo2,
    patientLookup?.vitals?.painScore
  ]);

  const vitalsTrend = useMemo(() => {
    const base = patientLookup?.bp?.systolic || 128;
    const pulse = Number(String(patientLookup?.vitals?.pulse || "78").replace(/\D/g, "")) || 78;
    const temp = Number(String(patientLookup?.vitals?.temperature || "98.4").replace(/[^\d.]/g, "")) || 98.4;
    return [base - 8, base - 4, base - 2, base + 1, base + 4, base + 6].map((value, index) => value + (index === 4 ? pulse / 20 : 0) + (index === 5 ? temp / 20 : 0));
  }, [patientLookup]);

  const selectedMedication = selectedCase?.prescription?.medicines?.[0] || selectedCase?.draft?.medicationSuggestions?.[0] || null;
  const criticalAlerts = useMemo(
    () =>
      todayCases
        .filter((item) => item.alerts.length > 0)
        .flatMap((item) =>
          item.alerts.map((alert) => ({
            id: `${item.id}-${alert}`,
            patient: item.patient?.fullName || "Unknown patient",
            bedLabel: item.bedLabel,
            alert,
            tone: alert === "High BP" ? "critical" : alert === "Missed vitals" ? "warning" : "info",
            time: formatTime(item.startAt)
          }))
        ),
    [todayCases]
  );

  const carePlanTasks = useMemo(() => {
    if (!selectedCase) {
      return [];
    }

    return [
      { label: "Vitals x3", done: Boolean(selectedCase.vitals?.bloodPressure || selectedCase.vitals?.pulse), time: "08:45" },
      { label: "Wound care", done: Boolean(selectedCase.alerts.includes("Discharge follow-up")), time: "10:15" },
      { label: "Meds administered", done: Boolean(selectedCase.prescription), time: "11:30" },
      { label: "Notify doctor", done: false, time: "As needed" }
    ];
  }, [selectedCase]);

  const topActions = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-2 rounded-full border border-line/50 bg-white/70 px-3 py-2 text-xs font-semibold text-muted">
        <BellRing className="h-4 w-4 text-brand-coral" />
        Alerts: {todayStats.alerts}
      </div>
      <div className="inline-flex items-center gap-2 rounded-full border border-line/50 bg-white/70 px-3 py-2 text-xs font-semibold text-muted">
        <UserRoundCheck className="h-4 w-4 text-brand-tide" />
        My {todayStats.totalPatients} pts
      </div>
      <div className="hidden items-center gap-2 rounded-full border border-line/50 bg-white/70 px-3 py-2 text-xs font-semibold text-muted md:inline-flex">
        <HeartPulse className="h-4 w-4 text-brand-sky" />
        Vitals {todayStats.vitalsCompletion}
      </div>
      <div className="hidden items-center gap-2 rounded-full border border-line/50 bg-white/70 px-3 py-2 text-xs font-semibold text-muted md:inline-flex">
        <Pill className="h-4 w-4 text-brand-midnight" />
        Meds {todayStats.medCompletion}%
      </div>
    </div>
  );

  const highlightSelection = (patientId) => {
    setSelectedPatientId(patientId);
    const nextCase = todayCases.find((item) => item.patient?.id === patientId || item.patientId === patientId);
    setScanValue(nextCase?.patient?.id || nextCase?.patientId || patientId || "");
    setBarcodeValue(nextCase?.prescription?.medicines?.[0]?.name || nextCase?.draft?.medicationSuggestions?.[0]?.name || "");
    setStatusBanner(`Loaded ${nextCase?.patient?.fullName || "patient"} from the ward board`);
  };

  const resolveScannedPatient = () => {
    const nextCase = patientLookup;
    if (!nextCase?.patient) {
      setStatusBanner("No matching patient found in today's ward list");
      return;
    }

    setSelectedPatientId(nextCase.patient.id);
    setBarcodeValue(nextCase.prescription?.medicines?.[0]?.name || nextCase.draft?.medicationSuggestions?.[0]?.name || "");
    setStatusBanner(`Scanned ${nextCase.patient.fullName} for vitals and medication review`);
  };

  const saveVitals = async () => {
    if (!patientLookup?.id) {
      setStatusBanner("Load a patient first before saving vitals");
      return;
    }

    await actions.nurse.saveVitals(patientLookup.id, vitalsForm);
    setStatusBanner(`Vitals saved for ${patientLookup?.patient?.fullName || "patient"} and synced across portals`);
  };

  const selectedTrendPoints = buildTrendPoints(vitalsTrend);

  return (
    <AppShell
      title="Nurse command center"
      subtitle="Ten-second situational awareness for wards, vitals, MAR, documentation, and escalation—without making the nurse hunt through five different screens."
      languageLabel="Nurse UI in English"
      actions={topActions}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {SCREEN_LINKS.map((screen) => (
            <a
              key={screen.id}
              href={`#${screen.id}`}
              className="inline-flex items-center rounded-full border border-line/50 bg-white/70 px-4 py-2 text-sm font-semibold text-muted transition hover:border-brand-tide/30 hover:text-ink"
            >
              {screen.label}
            </a>
          ))}
        </div>

        <div id="dashboard" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Critical alerts" value={`${todayStats.alerts}`} tone="accent" href="#alerts" />
          <StatCard label="My patient list" value={`${todayStats.totalPatients}`} tone="soft" href="#patients" />
          <StatCard label="Vitals taken" value={todayStats.vitalsCompletion} href="#vitals" />
          <StatCard label="Meds given" value={`${todayStats.medCompletion}%`} href="#meds" />
        </div>

        <Card>
          <SectionHeading
            eyebrow="Dashboard"
            title="Today's ward picture"
            description="This view prioritizes the patients who need your attention in the next few minutes."
          />

          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-[20px] border border-line/50 bg-surface-2 px-4 py-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Shift focus</div>
                  <div className="mt-1 text-sm font-semibold text-ink">10-second situational awareness</div>
                </div>
                <Badge tone={todayStats.alerts > 0 ? "danger" : "success"}>{todayStats.alerts > 0 ? `${todayStats.alerts} alerts` : "All clear"}</Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {todayCases.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => highlightSelection(item.patient?.id || item.patientId)}
                    className={cn(
                      "rounded-[20px] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md",
                      selectedCase?.id === item.id ? "border-brand-tide bg-brand-mint/30" : "border-line/50 bg-white/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-midnight text-sm font-bold text-white">
                          {initials(item.patient?.fullName || "Patient")}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-ink">{item.bedLabel} · {item.patient?.fullName}</div>
                          <div className="mt-1 text-xs text-muted">{item.status} · Next: {item.nextTask}</div>
                        </div>
                      </div>
                      <Badge tone={item.queuePriority === 0 ? "danger" : item.queuePriority === 1 ? "warning" : "info"}>{item.queuePriority === 0 ? "Critical" : item.queuePriority === 1 ? "Due now" : "Routine"}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.alerts.slice(0, 2).map((alert) => (
                        <Badge key={alert} tone={getSectionTone(alert === "High BP" ? "critical" : alert === "Missed vitals" ? "warning" : "info")}>
                          {alert}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-[24px] border border-line/50 bg-surface-2 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Sparkles className="h-4 w-4 text-brand-tide" />
                Ward quick stats
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white/70 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Ward</div>
                  <div className="mt-2 font-semibold text-ink">{nurse?.assignedWard || "OPD-A"}</div>
                </div>
                <div className="rounded-2xl bg-white/70 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Department</div>
                  <div className="mt-2 font-semibold text-ink">{nurse?.department || "General OPD"}</div>
                </div>
                <div className="rounded-2xl bg-white/70 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Shift</div>
                  <div className="mt-2 font-semibold text-ink">{(nurse?.shift || "day").toUpperCase()}</div>
                </div>
                <div className="rounded-2xl bg-white/70 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Profile</div>
                  <div className="mt-2 font-semibold text-ink">{checklist.filter((item) => item.ok).length}/{checklist.length}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-line/50 bg-white/70 p-4 text-sm text-muted">
                <div className="flex items-center gap-2 font-semibold text-ink">
                  <ShieldCheck className="h-4 w-4 text-brand-tide" />
                  {statusBanner}
                </div>
                <div className="mt-2 leading-6">Today’s work is anchored around vitals capture, medication safety, and fast escalation when a patient crosses the red line.</div>
              </div>
            </div>
          </div>
        </Card>

        <div id="vitals" className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <SectionHeading
              eyebrow="Vitals entry"
              title="Scan, capture, and save in under 30 seconds"
              description="Load the patient card from a QR scan or typed ID, then capture blood pressure, pulse, temperature, SpO2, and pain score."
            />

            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1.25fr_auto] md:items-end">
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Scan QR / patient ID</label>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={scanValue}
                      onChange={(event) => setScanValue(event.target.value)}
                      placeholder="Patient ID, bed, token, or name"
                      className="h-11 w-full rounded-xl border border-line/50 bg-white/80 px-4 text-sm outline-none focus:border-brand-tide/40"
                    />
                    <Button type="button" variant="secondary" onClick={resolveScannedPatient}>
                      <ScanFace className="h-4 w-4" />
                      Load
                    </Button>
                  </div>
                </div>
                <Badge tone={patientLookup ? "success" : "warning"}>{patientLookup?.patient?.fullName || "No patient loaded"}</Badge>
              </div>

              {patientLookup ? (
                <div className="rounded-[24px] border border-line/50 bg-white/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Patient card</div>
                      <div className="mt-1 text-lg font-semibold text-ink">{patientLookup.patient?.fullName}</div>
                      <div className="mt-1 text-sm text-muted">{patientLookup.bedLabel} · {patientLookup.patient?.id} · {patientLookup.patient?.abhaNumber || "ABHA not linked"}</div>
                    </div>
                    <Badge tone={patientLookup.alerts.some((alert) => alert === "High BP") ? "danger" : "info"}>{patientLookup.status}</Badge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: "BP", value: patientLookup.vitals?.bloodPressure || "—" },
                      { label: "Pulse", value: patientLookup.vitals?.pulse || "—" },
                      { label: "Temp", value: patientLookup.vitals?.temperature || "—" },
                      { label: "SpO2", value: patientLookup.vitals?.spo2 || "—" }
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-line/50 bg-surface-2 p-3">
                        <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted">{item.label}</div>
                        <div className="mt-2 text-base font-semibold text-ink">{item.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_0.6fr]">
                    <div className="rounded-2xl border border-line/50 bg-surface-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-ink">Pain score</div>
                        <Badge tone="warning">1-10 scale</Badge>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={vitalsForm.painScore}
                        onChange={(event) => setVitalsForm((current) => ({ ...current, painScore: event.target.value }))}
                        className="mt-3 w-full"
                      />
                    </div>
                    <div className={cn("rounded-2xl border p-3", (patientLookup.bp.systolic || 0) >= 160 ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50")}>
                      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <AlertTriangle className={cn("h-4 w-4", (patientLookup.bp.systolic || 0) >= 160 ? "text-rose-600" : "text-emerald-600")} />
                        Abnormal alert
                      </div>
                      <div className="mt-2 text-sm leading-6 text-muted">
                        {(patientLookup.bp.systolic || 0) >= 160 ? "BP > 160 detected. Escalate now." : "No red-flag vital sign detected for this patient."}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-line/50 bg-white/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-ink">Last 24h trend</div>
                        <div className="text-xs text-muted">Systolic BP snapshot</div>
                      </div>
                      <Badge tone="info">Realtime EMR update</Badge>
                    </div>
                    <svg viewBox="0 0 280 96" className="mt-4 h-24 w-full rounded-2xl bg-surface-2 p-2">
                      <polyline fill="none" stroke="currentColor" strokeWidth="3" className="text-brand-tide" points={selectedTrendPoints} />
                    </svg>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  { key: "bloodPressure", label: "BP", placeholder: "140/90" },
                  { key: "pulse", label: "Pulse", placeholder: "88" },
                  { key: "temperature", label: "Temp", placeholder: "98.6" },
                  { key: "spo2", label: "SpO2", placeholder: "98" },
                  { key: "painScore", label: "Pain", placeholder: "3" }
                ].map((field) => (
                  <div key={field.label} className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-[0.2em] text-muted">{field.label}</label>
                    <input
                      value={vitalsForm[field.key] ?? ""}
                      onChange={(event) => setVitalsForm((current) => ({ ...current, [field.key]: event.target.value }))}
                      placeholder={field.placeholder}
                      className="h-11 w-full rounded-xl border border-line/50 bg-white/80 px-4 text-sm outline-none focus:border-brand-tide/40"
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={saveVitals}>
                  <CheckCircle2 className="h-4 w-4" />
                  Save vitals
                </Button>
                <Button type="button" variant="secondary">
                  <Thermometer className="h-4 w-4" />
                  Open EMR
                </Button>
                <span className="text-sm text-muted">Pain score, BP warnings, and the latest trend are visible before the nurse taps save.</span>
              </div>
            </div>
          </Card>

          <Card id="meds">
            <SectionHeading
              eyebrow="Medication admin"
              title="Barcode + 5-rights confirmation"
              description="MAR list, barcode scan, locked signature, and missed dose alerts keep the med pass tight."
            />

            <div className="space-y-4">
              <div className="rounded-[22px] border border-line/50 bg-surface-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <ClipboardList className="h-4 w-4 text-brand-tide" />
                    MAR list
                  </div>
                  <Badge tone={selectedMedication ? "success" : "warning"}>{selectedMedication ? "Ready" : "No med selected"}</Badge>
                </div>

                <div className="mt-3 space-y-2">
                  {(selectedCase?.prescription?.medicines || selectedCase?.draft?.medicationSuggestions || []).slice(0, 3).map((med) => (
                    <div key={med.name} className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-sm">
                      <div>
                        <div className="font-semibold text-ink">{med.name}</div>
                        <div className="text-xs text-muted">{med.dosage || med.strength || "Dose pending"} · {med.frequency || med.form || "Route pending"}</div>
                      </div>
                      <Badge tone="info">Scheduled</Badge>
                    </div>
                  ))}
                  {!selectedCase?.prescription?.medicines?.length && !selectedCase?.draft?.medicationSuggestions?.length ? (
                    <div className="rounded-2xl border border-dashed border-line/60 bg-white/60 p-4 text-sm text-muted">No medication order available for the current patient.</div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1.25fr_0.75fr]">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Barcode scan</label>
                  <div className="flex gap-2">
                    <input
                      value={barcodeValue}
                      onChange={(event) => setBarcodeValue(event.target.value)}
                      placeholder="Drug name / barcode / dose"
                      className="h-11 w-full rounded-xl border border-line/50 bg-white/80 px-4 text-sm outline-none focus:border-brand-tide/40"
                    />
                    <Button type="button" variant="secondary" onClick={() => setStatusBanner(`Verified ${barcodeValue || "medication"} against the MAR`)}>
                      <ScanFace className="h-4 w-4" />
                      Verify
                    </Button>
                  </div>
                </div>
                <div className="rounded-2xl border border-line/50 bg-white/70 p-4 text-sm">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted">5-rights check</div>
                  <div className="mt-3 space-y-2">
                    {[
                      "Right patient",
                      "Right drug",
                      "Right dose",
                      "Right time",
                      "Right route"
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-ink">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] border border-line/50 bg-white/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-ink">eMAR signature</div>
                  <Badge tone="success">Locked record</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="primary" onClick={() => setStatusBanner(`Medication signed off for ${selectedCase?.patient?.fullName || "patient"}`)}>
                    <ShieldCheck className="h-4 w-4" />
                    Sign & lock
                  </Button>
                  <Button type="button" variant="secondary">
                    <Pill className="h-4 w-4" />
                    Missed dose alerts
                  </Button>
                </div>
                <div className="mt-3 text-sm text-muted">If a dose is late, the portal escalates it before the shift quietly turns into detective fiction.</div>
              </div>
            </div>
          </Card>
        </div>

        <div id="patients" className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <SectionHeading
              eyebrow="Patient list / assignments"
              title="My patients, ward view, and critical filter"
              description="A quick ward overview with bed numbers, handoff notes, and what is due next."
            />

            <div className="flex flex-wrap gap-2">
              {[
                { label: "My patients", active: true },
                { label: "All ward" },
                { label: "Critical" }
              ].map((item) => (
                <Badge key={item.label} tone={item.active ? "info" : "neutral"}>{item.label}</Badge>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              {todayCases.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => highlightSelection(item.patient?.id || item.patientId)}
                  className={cn(
                    "w-full rounded-[22px] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md",
                    selectedCase?.id === item.id ? "border-brand-tide bg-brand-mint/30" : "border-line/50 bg-white/70"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-midnight text-sm font-bold text-white">{initials(item.patient?.fullName || "P")}</div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold text-ink">{item.bedLabel} · {item.patient?.fullName}</div>
                          <Badge tone={item.queuePriority === 0 ? "danger" : item.queuePriority === 1 ? "warning" : "info"}>{item.status}</Badge>
                        </div>
                        <div className="mt-1 text-sm text-muted">Next task: {item.nextTask}</div>
                        <div className="mt-2 text-xs text-muted">Handoff note: {item.encounter?.doctorReview?.note || item.patient?.notes || "Pending shift handoff"}</div>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-brand-tide" />
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeading
              eyebrow="Care plan / tasks"
              title="Checklist with timestamps and escalation"
              description="Track what is complete, what is due, and when to notify the doctor."
            />

            <div className="space-y-3">
              {carePlanTasks.map((task) => (
                <div key={task.label} className="flex items-center justify-between gap-3 rounded-[20px] border border-line/50 bg-surface-2 p-4 text-sm">
                  <div className="flex items-center gap-3">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", task.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                      {task.done ? <CheckCircle2 className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="font-semibold text-ink">{task.label}</div>
                      <div className="text-xs text-muted">{task.time}</div>
                    </div>
                  </div>
                  <Badge tone={task.done ? "success" : "warning"}>{task.done ? "Done" : "Pending"}</Badge>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[20px] border border-line/50 bg-white/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-ink">SBAR handoff</div>
                <Badge tone="info">Shift ready</Badge>
              </div>
              <div className="mt-3 space-y-3 text-sm leading-6 text-muted">
                <div><span className="font-semibold text-ink">S:</span> {selectedCase?.patient?.fullName || "Patient"} in {nurse?.assignedWard || "OPD-A"} needs routine review.</div>
                <div><span className="font-semibold text-ink">B:</span> {selectedCase?.patient?.notes || "No extra background recorded."}</div>
                <div><span className="font-semibold text-ink">A:</span> {selectedCase?.alerts.join(" · ") || "Stable, awaiting next round."}</div>
                <div><span className="font-semibold text-ink">R:</span> Notify doctor if BP rises or the pain score goes above 8.</div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="secondary">
                  <MessageSquareMore className="h-4 w-4" />
                  Notify doctor
                </Button>
                <Button type="button" variant="secondary">
                  <Volume2 className="h-4 w-4" />
                  Escalate to charge nurse
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div id="alerts" className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <SectionHeading
              eyebrow="Alarms / alerts"
              title="Critical first, then medium, then routine"
              description="Fall risk, IV due, pain > 8, abnormal vitals, and overdue meds stay visible until the nurse acknowledges them."
            />

            <div className="space-y-3">
              {criticalAlerts.length ? criticalAlerts.map((alert) => (
                <div key={alert.id} className={cn("rounded-[22px] border p-4 text-sm", alert.tone === "critical" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50")}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-semibold text-ink">
                      {alert.tone === "critical" ? <Siren className="h-4 w-4 text-rose-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                      {alert.alert}
                    </div>
                    <Badge tone={alert.tone === "critical" ? "danger" : alert.tone === "warning" ? "warning" : "info"}>{alert.tone}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted">{alert.patient} · {alert.bedLabel} · {alert.time}</div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-muted">Escalation chain: nurse → charge nurse → doctor</div>
                    <Button
                      type="button"
                      variant={ackedAlerts.includes(alert.id) ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => {
                        setAckedAlerts((current) => [...new Set([...current, alert.id])]);
                        setStatusBanner(`Acknowledged ${alert.alert} for ${alert.patient}`);
                      }}
                    >
                      {ackedAlerts.includes(alert.id) ? "Acknowledged" : "Acknowledge"}
                    </Button>
                  </div>
                </div>
              )) : (
                <div className="rounded-[22px] border border-dashed border-line/60 bg-surface-2 p-6 text-sm text-muted">No open alerts right now.</div>
              )}
            </div>
          </Card>

          <Card>
            <SectionHeading
              eyebrow="Documentation"
              title="Flowsheets, notes, photos, and templates"
              description="Document the legal record once, then keep the rest of the team aligned with clean timestamps."
            />

            <div className="grid gap-3 md:grid-cols-2">
              {[
                { icon: HeartPulse, title: "Flowsheets", text: "Vitals trends, I&O, and assessment snapshots." },
                { icon: FileText, title: "Nursing notes", text: "Timestamped free-text charting." },
                { icon: Camera, title: "Photo upload", text: "Wounds, devices, and attachments." },
                { icon: ClipboardList, title: "Templates", text: "Admission and discharge note shortcuts." }
              ].map((item) => (
                <div key={item.title} className="rounded-[22px] border border-line/50 bg-surface-2 p-4 text-sm">
                  <item.icon className="h-5 w-5 text-brand-tide" />
                  <div className="mt-3 font-semibold text-ink">{item.title}</div>
                  <div className="mt-1 leading-6 text-muted">{item.text}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              <textarea
                value={noteValue}
                onChange={(event) => setNoteValue(event.target.value)}
                rows={4}
                className="w-full rounded-[22px] border border-line/50 bg-white/80 p-4 text-sm outline-none focus:border-brand-tide/40"
                placeholder="Write nursing note..."
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => setStatusBanner(`Saved nursing note for ${selectedCase?.patient?.fullName || "patient"}`)}>
                  <FileText className="h-4 w-4" />
                  Save note
                </Button>
                <Button type="button" variant="secondary">
                  <Upload className="h-4 w-4" />
                  Upload photo
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div id="comm" className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <SectionHeading
              eyebrow="Communication"
              title="Orders, SBAR, team chat, and call light"
              description="Keep orders visible, communicate changes, and make the call-light path obvious."
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-[22px] border border-line/50 bg-surface-2 p-4 text-sm">
                <div>
                  <div className="font-semibold text-ink">Doctor orders</div>
                  <div className="text-xs text-muted">New orders waiting badge</div>
                </div>
                <Badge tone="warning">2 new</Badge>
              </div>
              <div className="flex items-center justify-between rounded-[22px] border border-line/50 bg-surface-2 p-4 text-sm">
                <div>
                  <div className="font-semibold text-ink">Handoff report</div>
                  <div className="text-xs text-muted">SBAR format for next shift</div>
                </div>
                <Badge tone="info">Ready</Badge>
              </div>
              <div className="flex items-center justify-between rounded-[22px] border border-line/50 bg-surface-2 p-4 text-sm">
                <div>
                  <div className="font-semibold text-ink">Team chat</div>
                  <div className="text-xs text-muted">Ward group + escalation thread</div>
                </div>
                <Badge tone="success">Online</Badge>
              </div>
              <div className="flex items-center justify-between rounded-[22px] border border-line/50 bg-surface-2 p-4 text-sm">
                <div>
                  <div className="font-semibold text-ink">Patient call light</div>
                  <div className="text-xs text-muted">Fast response integration</div>
                </div>
                <Badge tone="danger">Urgent</Badge>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeading
              eyebrow="Operational wrap-up"
              title="Credential-ready, shift-ready, ward-ready"
              description="The nurse workspace stays focused on the patient list and the next clinical action."
            />

            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  icon: HeartPulse,
                  title: "Vitals capture",
                  text: "Auto-load a patient card, capture numbers, and push the update to the EMR."
                },
                {
                  icon: Pill,
                  title: "Medication safety",
                  text: "Barcode confirmation + five-rights checks reduce med errors."
                },
                {
                  icon: Target,
                  title: "Escalation",
                  text: "Alerts and SBAR handoff keep the care team loop closed."
                }
              ].map((item) => (
                <div key={item.title} className="rounded-[22px] border border-line/50 bg-surface-2 p-4 text-sm leading-6 text-muted">
                  <item.icon className="mb-3 h-5 w-5 text-brand-tide" />
                  <div className="font-semibold text-ink">{item.title}</div>
                  <div className="mt-1">{item.text}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link to="/nurse/profile">Open nurse profile</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/nurse/tools">AI Assist</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
