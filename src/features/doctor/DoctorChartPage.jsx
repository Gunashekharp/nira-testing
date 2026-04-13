import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Plus, Send, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input, Textarea } from "../../components/ui/FormFields";
import { Modal } from "../../components/ui/Modal";
import { useDemoData } from "../../app/DemoDataProvider";
import { getAppointmentBundle, getDoctorWorkspace } from "../shared/selectors";
import { formatStatus, formatTime } from "../../lib/format";
import { findDrugInteractions } from "../shared/DDIChecker";
import { cn } from "../../lib/utils";
import { listCollection } from "../../services/stateHelpers";

const INVESTIGATION_SUGGESTIONS = [
  "CBC",
  "RBS",
  "HbA1c",
  "LFT",
  "RFT",
  "Urine Routine",
  "TSH",
  "ECG",
  "Chest X-Ray",
  "CRP"
];

const SECTION_META = [
  { key: "snapshot", title: "1. Patient snapshot", source: "ABHA / ABDM", action: "Verify, edit if needed" },
  { key: "chiefComplaint", title: "2. Chief complaint", source: "AI from interview", action: "Validate or edit" },
  { key: "history", title: "3. History", source: "AI from interview", action: "Validate or edit" },
  { key: "vitals", title: "4. Vitals", source: "Device sync / nurse", action: "Edit inline if changed" },
  { key: "exam", title: "5. Examination findings", source: "Doctor", action: "Doctor types findings" },
  { key: "diagnosis", title: "6. Diagnosis", source: "AI suggested", action: "Confirm or change" },
  { key: "investigations", title: "7. Investigations", source: "AI suggested", action: "Toggle on/off, add custom" },
  {
    key: "testsPortal",
    title: "8. Tests for patient portal",
    source: "Standard template",
    action: "Same checklist for every visit; syncs to patient Tests after publish"
  },
  { key: "rx", title: "9. Prescription (Rx)", source: "AI pre-filled", action: "Edit, add, remove drugs" },
  { key: "followUp", title: "10. Follow-up plan", source: "AI suggested", action: "Edit and confirm" }
];

const LAB_TEST_DISPLAY = {
  CBC: { label: "Complete Blood Count", dept: "HEMATOLOGY", sample: "Blood | 4 hours" },
  RBS: { label: "Random blood sugar", dept: "BIOCHEMISTRY", sample: "Blood | 3 hours" },
  HbA1c: { label: "HbA1c", dept: "BIOCHEMISTRY", sample: "Blood | 2 hours" },
  LFT: { label: "Liver Function Test", dept: "BIOCHEMISTRY", sample: "Blood | 4 hours" },
  RFT: { label: "Renal Function Test", dept: "BIOCHEMISTRY", sample: "Blood | 4 hours" },
  "Urine Routine": { label: "Urine Routine", dept: "PATHOLOGY", sample: "Urine | 2 hours" },
  TSH: { label: "TSH", dept: "BIOCHEMISTRY", sample: "Blood | 3 hours" },
  ECG: { label: "ECG", dept: "CARDIOLOGY", sample: "Clinic | 1 hour" },
  "Chest X-Ray": { label: "Chest X-Ray", dept: "RADIOLOGY", sample: "Imaging | 24 hours" },
  CRP: { label: "CRP", dept: "BIOCHEMISTRY", sample: "Blood | 3 hours" }
};

function getLabDisplay(key) {
  return LAB_TEST_DISPLAY[key] || { label: key, dept: "GENERAL", sample: "As ordered" };
}

function toPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function computeBmi(weightKg, heightCm) {
  const w = toPositiveNumber(weightKg);
  const h = toPositiveNumber(heightCm);
  if (!w || !h) return "";
  const meters = h / 100;
  return (w / (meters * meters)).toFixed(1);
}

function parseHistory(unified, draft) {
  return {
    hpi: unified?.history?.hpi || draft?.soap?.subjective || "",
    pmh: unified?.history?.pmh || "",
    familyHistory: unified?.history?.familyHistory || "",
    socialHistory: unified?.history?.socialHistory || ""
  };
}

function buildForm(bundle) {
  const draft = bundle?.draft || {};
  const unified = draft?.unifiedEmr || {};
  const patient = bundle?.patient || {};
  const hasExistingUnifiedEmr = Boolean(draft?.unifiedEmr);
  const meds = (draft?.medicationSuggestions || []).map((item) => ({
    drug: item?.name || "",
    dosage: item?.dosage || "",
    frequency: item?.frequency || "",
    duration: item?.duration || "",
    rationale: item?.rationale || ""
  }));

  const weight = unified?.vitals?.weight || draft?.vitals?.weight || "";
  const height = unified?.vitals?.height || draft?.vitals?.height || "";

  return {
    snapshot: {
      name: patient.fullName || "",
      age: patient.age || "",
      sex: patient.gender || "",
      bloodGroup: unified?.snapshot?.bloodGroup || "",
      abhaId: patient.abhaNumber || "",
      allergies: unified?.snapshot?.allergies || "",
      chronicConditions: unified?.snapshot?.chronicConditions || "",
      regularMeds:
        unified?.snapshot?.regularMeds
        || meds.map((item) => item.drug).filter(Boolean).join(", ")
        || ""
    },
    chiefComplaint: {
      presentingComplaint: unified?.chiefComplaint?.presentingComplaint || draft?.soap?.chiefComplaint || "",
      duration: unified?.chiefComplaint?.duration || "",
      onset: unified?.chiefComplaint?.onset || "",
      severityScore: unified?.chiefComplaint?.severityScore || ""
    },
    history: parseHistory(unified, draft),
    vitals: {
      temperature: draft?.vitals?.temperature || "",
      bloodPressure: draft?.vitals?.bloodPressure || "",
      pulse: draft?.vitals?.pulse || "",
      spo2: draft?.vitals?.spo2 || "",
      respiratoryRate: unified?.vitals?.respiratoryRate || "",
      weight,
      height,
      bmi: unified?.vitals?.bmi || computeBmi(weight, height)
    },
    examination: {
      general: unified?.examination?.general || "",
      systemic: unified?.examination?.systemic || "",
      local: unified?.examination?.local || draft?.soap?.objective || ""
    },
    diagnosis: {
      primary: draft?.diagnoses?.[0]?.label || "",
      primaryCode: draft?.diagnoses?.[0]?.code || "",
      secondary: draft?.diagnoses?.[1]?.label || "",
      secondaryCode: draft?.diagnoses?.[1]?.code || "",
      clinicalNotes: unified?.diagnosis?.clinicalNotes || draft?.soap?.assessment || ""
    },
    investigations: {
      selected: hasExistingUnifiedEmr
        ? (unified?.investigations?.selected || [])
        : [...INVESTIGATION_SUGGESTIONS],
      customInput: "",
      patientNote: hasExistingUnifiedEmr
        ? (unified?.investigations?.patientNote || "")
        : "Please visit the lab with this visit token. Fasting required for RBS/HbA1c if applicable."
    },
    prescription: meds.length
      ? meds
      : [{ drug: "", dosage: "", frequency: "", duration: "", rationale: "" }],
    followUp: {
      interval: unified?.followUp?.interval || "",
      reason: unified?.followUp?.reason || "",
      referral: unified?.followUp?.referral || "",
      additionalInstructions: unified?.followUp?.additionalInstructions || bundle?.prescription?.followUpNote || ""
    },
    doctorNote: bundle?.review?.note || ""
  };
}

function toDraft(form, bundle) {
  const selectedInvestigations = form.investigations.selected;
  const diagnoses = [
    form.diagnosis.primary
      ? { label: form.diagnosis.primary, code: form.diagnosis.primaryCode || "", confidence: 0.9 }
      : null,
    form.diagnosis.secondary
      ? { label: form.diagnosis.secondary, code: form.diagnosis.secondaryCode || "", confidence: 0.75 }
      : null
  ].filter(Boolean);

  const medicationSuggestions = form.prescription
    .filter((row) => String(row.drug || "").trim())
    .map((row) => ({
      name: row.drug,
      dosage: row.dosage || "",
      frequency: row.frequency,
      duration: row.duration,
      rationale: row.rationale
    }));

  const subjective = [
    `HPI: ${form.history.hpi || ""}`,
    `PMH: ${form.history.pmh || ""}`,
    `Family history: ${form.history.familyHistory || ""}`,
    `Social history: ${form.history.socialHistory || ""}`,
    `Complaint details: duration=${form.chiefComplaint.duration || "NA"}, onset=${form.chiefComplaint.onset || "NA"}, severity=${form.chiefComplaint.severityScore || "NA"}`
  ].join("\n");

  const objective = [
    `General: ${form.examination.general || ""}`,
    `Systemic: ${form.examination.systemic || ""}`,
    `Local: ${form.examination.local || ""}`,
    `Vitals: Temp=${form.vitals.temperature || "NA"}, BP=${form.vitals.bloodPressure || "NA"}, Pulse=${form.vitals.pulse || "NA"}, SpO2=${form.vitals.spo2 || "NA"}, RR=${form.vitals.respiratoryRate || "NA"}, Wt=${form.vitals.weight || "NA"}, Ht=${form.vitals.height || "NA"}, BMI=${form.vitals.bmi || "NA"}`
  ].join("\n");

  const plan = [
    selectedInvestigations.length ? `Investigations: ${selectedInvestigations.join(", ")}` : "Investigations: none",
    `Follow-up: ${form.followUp.interval || "TBD"}`,
    `Reason: ${form.followUp.reason || ""}`,
    `Referral: ${form.followUp.referral || ""}`,
    `Instructions: ${form.followUp.additionalInstructions || ""}`
  ].join("\n");

  return {
    ...(bundle?.draft || {}),
    id: bundle?.draft?.id || `draft-${bundle.appointment.id}`,
    appointmentId: bundle.appointment.id,
    soap: {
      chiefComplaint: form.chiefComplaint.presentingComplaint,
      subjective,
      objective,
      assessment: form.diagnosis.clinicalNotes,
      plan
    },
    vitals: {
      temperature: form.vitals.temperature,
      pulse: form.vitals.pulse,
      bloodPressure: form.vitals.bloodPressure,
      spo2: form.vitals.spo2,
      respiratoryRate: form.vitals.respiratoryRate,
      weight: form.vitals.weight,
      height: form.vitals.height,
      bmi: form.vitals.bmi
    },
    diagnoses,
    medicationSuggestions,
    alerts: bundle?.draft?.alerts || [],
    confidenceMap: bundle?.draft?.confidenceMap || {
      subjective: 0.82,
      objective: 0.8,
      assessment: 0.84,
      plan: 0.81
    },
    unifiedEmr: {
      snapshot: form.snapshot,
      chiefComplaint: form.chiefComplaint,
      history: form.history,
      vitals: form.vitals,
      examination: form.examination,
      diagnosis: form.diagnosis,
      investigations: {
        selected: selectedInvestigations,
        patientNote: form.investigations.patientNote || ""
      },
      followUp: form.followUp
    }
  };
}

export function DoctorChartPage() {
  const { appointmentId } = useParams();
  const { state, actions } = useDemoData();
  const bundle = getAppointmentBundle(state, appointmentId);
  const { appointments } = getDoctorWorkspace(state);

  const precheckByAppointment = useMemo(() => {
    const map = {};
    listCollection(state.precheckQuestionnaires || { allIds: [], byId: {} }).forEach((q) => {
      map[q.appointmentId] = q;
    });
    return map;
  }, [state.precheckQuestionnaires]);

  const [form, setForm] = useState(() => (bundle ? buildForm(bundle) : null));
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewPrescription, setPreviewPrescription] = useState(bundle?.prescription || null);

  useEffect(() => {
    if (bundle) {
      setForm(buildForm(bundle));
      setPreviewPrescription(bundle.prescription || null);
    }
  }, [bundle?.appointment?.id, bundle?.encounter?.status, bundle?.encounter?.prescriptionId]);

  const ddiInteractions = useMemo(() => {
    const drugs = (form?.prescription || []).map((row) => row.drug).filter(Boolean);
    if (drugs.length < 2) return [];
    return findDrugInteractions(drugs);
  }, [form?.prescription]);

  if (!bundle || !form) {
    return (
      <AppShell title="Chart not found" subtitle="The requested consultation could not be loaded from the local demo state.">
        <Card>
          <Button asChild>
            <Link to="/doctor">Back to doctor dashboard</Link>
          </Button>
        </Card>
      </AppShell>
    );
  }

  const update = (path, value) => {
    setForm((current) => {
      const next = { ...current };
      const [root, key] = path;
      next[root] = { ...next[root], [key]: value };

      if (root === "vitals" && (key === "weight" || key === "height")) {
        next.vitals.bmi = computeBmi(
          key === "weight" ? value : next.vitals.weight,
          key === "height" ? value : next.vitals.height
        );
      }

      return next;
    });
  };

  const toggleInvestigation = (name) => {
    setForm((current) => {
      const selected = current.investigations.selected.includes(name)
        ? current.investigations.selected.filter((item) => item !== name)
        : [...current.investigations.selected, name];
      return {
        ...current,
        investigations: {
          ...current.investigations,
          selected
        }
      };
    });
  };

  const addCustomInvestigation = () => {
    const label = String(form.investigations.customInput || "").trim();
    if (!label) return;

    setForm((current) => {
      if (current.investigations.selected.includes(label)) {
        return {
          ...current,
          investigations: { ...current.investigations, customInput: "" }
        };
      }

      return {
        ...current,
        investigations: {
          selected: [...current.investigations.selected, label],
          customInput: ""
        }
      };
    });
  };

  const addRxRow = () => {
    setForm((current) => ({
      ...current,
      prescription: [...current.prescription, { drug: "", dosage: "", frequency: "", duration: "", rationale: "" }]
    }));
  };

  const removeRxRow = (index) => {
    setForm((current) => {
      const next = current.prescription.filter((_, i) => i !== index);
      return {
        ...current,
        prescription: next.length ? next : [{ drug: "", dosage: "", frequency: "", duration: "", rationale: "" }]
      };
    });
  };

  const updateRx = (index, key, value) => {
    setForm((current) => ({
      ...current,
      prescription: current.prescription.map((row, i) => (i === index ? { ...row, [key]: value } : row))
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const draft = toDraft(form, bundle);
    await actions.doctor.saveDoctorReview(bundle.appointment.id, {
      draft,
      editedFields: [],
      note: form.doctorNote,
      labReport: bundle.labReport || {}
    });
    setSaving(false);
  };

  const handleApprove = async () => {
    setApproving(true);
    const draft = toDraft(form, bundle);
    const next = await actions.doctor.approveEncounter(bundle.appointment.id, {
      draft,
      editedFields: [],
      note: form.doctorNote,
      followUpNote: form.followUp.additionalInstructions,
      labReport: bundle.labReport || {}
    });
    setPreviewPrescription(
      Object.values(next.prescriptions.byId).find((item) => item.appointmentId === bundle.appointment.id) || null
    );
    setApproving(false);
    setModalOpen(true);
  };

  const sectionBadge = (key) => SECTION_META.find((s) => s.key === key);

  return (
    <AppShell
      title="Unified EMR"
      subtitle="Three-column workspace: patient queue, encounter review, and lab workflow—same clinical fields as before."
      languageLabel="Doctor review in English"
    >
      <div className="unified-emr-shell">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-6">
          {/* Left: patients in queue */}
          <aside className="lg:col-span-3">
            <div className="unified-emr-panel p-4 sm:p-5">
              <p className="unified-emr-eyebrow">Patients in queue</p>
              <h2 className="mt-2 text-lg font-bold tracking-tight text-slate-900">Consult navigation</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Jump between queued patients while keeping the doctor workflow intact.
              </p>
            </div>
            <div className="mt-4 space-y-3">
              {appointments.map((item) => {
                const active = item.id === bundle.appointment.id;
                const pq = precheckByAppointment[item.id];
                const showPrecheck = pq && ["sent_to_patient", "completed"].includes(pq.status);
                const complaint =
                  item.encounter?.apciDraft?.soap?.chiefComplaint ||
                  (item.encounter?.apciDraft?.soap?.subjective
                    ? String(item.encounter.apciDraft.soap.subjective).slice(0, 140)
                    : "");
                return (
                  <Link
                    key={item.id}
                    to={`/doctor/patient/${item.id}`}
                    className={cn(
                      "block rounded-2xl border p-3.5 transition",
                      active ? "unified-emr-panel-mint border-emerald-200/90" : "unified-emr-panel border-slate-200/90 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-900">{item.patient?.fullName}</span>
                      {showPrecheck ? (
                        <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800">
                          Pre check
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {formatTime(item.startAt)} · Token {item.token}
                    </p>
                    {complaint ? <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">{complaint}</p> : null}
                  </Link>
                );
              })}
            </div>
          </aside>

          {/* Center: encounter review */}
          <div className="space-y-5 lg:col-span-6">
            <div className="unified-emr-panel p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="unified-emr-eyebrow">Encounter review</p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
                    {bundle.patient.fullName} · {bundle.patient.age || "--"} yrs
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {bundle.doctor.fullName} · {formatStatus(bundle.appointment.visitType)} · Token {bundle.appointment.token}
                  </p>
                </div>
                <Button asChild variant="secondary" className="shrink-0 rounded-full border-slate-200/90 bg-white shadow-sm">
                  <Link to="/doctor">
                    <ArrowLeft className="h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
              </div>
            </div>

          <Card className="!border-slate-200/85 !bg-white shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
            <CardHeader
              eyebrow="Patient snapshot"
              title={sectionBadge("snapshot").title}
              description={sectionBadge("snapshot").action}
              actions={<Badge tone="info">{sectionBadge("snapshot").source}</Badge>}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input value={form.snapshot.name} onChange={(e) => update(["snapshot", "name"], e.target.value)} placeholder="Name" />
              <Input value={form.snapshot.age} onChange={(e) => update(["snapshot", "age"], e.target.value)} placeholder="Age" />
              <Input value={form.snapshot.sex} onChange={(e) => update(["snapshot", "sex"], e.target.value)} placeholder="Sex" />
              <Input value={form.snapshot.bloodGroup} onChange={(e) => update(["snapshot", "bloodGroup"], e.target.value)} placeholder="Blood group" />
              <Input value={form.snapshot.abhaId} onChange={(e) => update(["snapshot", "abhaId"], e.target.value)} placeholder="ABHA ID" />
              <Input value={form.snapshot.allergies} onChange={(e) => update(["snapshot", "allergies"], e.target.value)} placeholder="Allergies" />
              <Input value={form.snapshot.chronicConditions} onChange={(e) => update(["snapshot", "chronicConditions"], e.target.value)} placeholder="Chronic conditions" />
              <Input value={form.snapshot.regularMeds} onChange={(e) => update(["snapshot", "regularMeds"], e.target.value)} placeholder="Regular meds" />
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Chief complaint"
              title={sectionBadge("chiefComplaint").title}
              description={sectionBadge("chiefComplaint").action}
              actions={<Badge tone="info">{sectionBadge("chiefComplaint").source}</Badge>}
            />
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Input value={form.chiefComplaint.presentingComplaint} onChange={(e) => update(["chiefComplaint", "presentingComplaint"], e.target.value)} placeholder="Presenting complaint" />
              <Input value={form.chiefComplaint.duration} onChange={(e) => update(["chiefComplaint", "duration"], e.target.value)} placeholder="Duration" />
              <Input value={form.chiefComplaint.onset} onChange={(e) => update(["chiefComplaint", "onset"], e.target.value)} placeholder="Onset" />
              <Input value={form.chiefComplaint.severityScore} onChange={(e) => update(["chiefComplaint", "severityScore"], e.target.value)} placeholder="Severity score" />
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="History"
              title={sectionBadge("history").title}
              description={sectionBadge("history").action}
              actions={<Badge tone="info">{sectionBadge("history").source}</Badge>}
            />
            <div className="grid gap-3 lg:grid-cols-2">
              <Textarea value={form.history.hpi} onChange={(e) => update(["history", "hpi"], e.target.value)} placeholder="HPI" />
              <Textarea value={form.history.pmh} onChange={(e) => update(["history", "pmh"], e.target.value)} placeholder="Past medical history" />
              <Textarea value={form.history.familyHistory} onChange={(e) => update(["history", "familyHistory"], e.target.value)} placeholder="Family history" />
              <Textarea value={form.history.socialHistory} onChange={(e) => update(["history", "socialHistory"], e.target.value)} placeholder="Social history" />
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Vitals"
              title={sectionBadge("vitals").title}
              description={sectionBadge("vitals").action}
              actions={<Badge tone="info">{sectionBadge("vitals").source}</Badge>}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input value={form.vitals.temperature} onChange={(e) => update(["vitals", "temperature"], e.target.value)} placeholder="Temp" />
              <Input value={form.vitals.bloodPressure} onChange={(e) => update(["vitals", "bloodPressure"], e.target.value)} placeholder="BP" />
              <Input value={form.vitals.pulse} onChange={(e) => update(["vitals", "pulse"], e.target.value)} placeholder="Pulse" />
              <Input value={form.vitals.spo2} onChange={(e) => update(["vitals", "spo2"], e.target.value)} placeholder="SpO2" />
              <Input value={form.vitals.respiratoryRate} onChange={(e) => update(["vitals", "respiratoryRate"], e.target.value)} placeholder="RR" />
              <Input value={form.vitals.weight} onChange={(e) => update(["vitals", "weight"], e.target.value)} placeholder="Weight (kg)" />
              <Input value={form.vitals.height} onChange={(e) => update(["vitals", "height"], e.target.value)} placeholder="Height (cm)" />
              <Input value={form.vitals.bmi} onChange={(e) => update(["vitals", "bmi"], e.target.value)} placeholder="BMI" />
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Examination findings"
              title={sectionBadge("exam").title}
              description={sectionBadge("exam").action}
              actions={<Badge tone="warning">{sectionBadge("exam").source}</Badge>}
            />
            <div className="grid gap-3 lg:grid-cols-3">
              <Textarea value={form.examination.general} onChange={(e) => update(["examination", "general"], e.target.value)} placeholder="General exam" />
              <Textarea value={form.examination.systemic} onChange={(e) => update(["examination", "systemic"], e.target.value)} placeholder="Systemic exam" />
              <Textarea value={form.examination.local} onChange={(e) => update(["examination", "local"], e.target.value)} placeholder="Local exam" />
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Diagnosis"
              title={sectionBadge("diagnosis").title}
              description={sectionBadge("diagnosis").action}
              actions={<Badge tone="info">{sectionBadge("diagnosis").source}</Badge>}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input value={form.diagnosis.primary} onChange={(e) => update(["diagnosis", "primary"], e.target.value)} placeholder="Primary diagnosis" />
              <Input value={form.diagnosis.primaryCode} onChange={(e) => update(["diagnosis", "primaryCode"], e.target.value)} placeholder="Primary ICD-10" />
              <Input value={form.diagnosis.secondary} onChange={(e) => update(["diagnosis", "secondary"], e.target.value)} placeholder="Secondary diagnosis" />
              <Input value={form.diagnosis.secondaryCode} onChange={(e) => update(["diagnosis", "secondaryCode"], e.target.value)} placeholder="Secondary ICD-10" />
            </div>
            <div className="mt-3">
              <Textarea value={form.diagnosis.clinicalNotes} onChange={(e) => update(["diagnosis", "clinicalNotes"], e.target.value)} placeholder="Clinical notes" />
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Prescription"
              title={sectionBadge("rx").title}
              description={sectionBadge("rx").action}
              actions={<Badge tone="info">{sectionBadge("rx").source}</Badge>}
            />

            <div className="space-y-3">
              {form.prescription.map((row, index) => (
                <div key={`rx-${index}`} className="rounded-2xl border border-line bg-surface-2 p-3">
                  <div className="grid gap-2 lg:grid-cols-5">
                    <Input value={row.drug} onChange={(e) => updateRx(index, "drug", e.target.value)} placeholder="Drug" />
                    <Input value={row.dosage} onChange={(e) => updateRx(index, "dosage", e.target.value)} placeholder="Dosage" />
                    <Input value={row.frequency} onChange={(e) => updateRx(index, "frequency", e.target.value)} placeholder="Frequency" />
                    <Input value={row.duration} onChange={(e) => updateRx(index, "duration", e.target.value)} placeholder="Duration" />
                    <div className="flex items-center gap-2">
                      <Input value={row.rationale} onChange={(e) => updateRx(index, "rationale", e.target.value)} placeholder="Instruction" />
                      <Button variant="ghost" size="sm" onClick={() => removeRxRow(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <Button variant="secondary" size="sm" onClick={addRxRow}>
                <Plus className="h-4 w-4" />
                Add drug
              </Button>
              <Badge tone={ddiInteractions.length ? "warning" : "success"}>
                {ddiInteractions.length ? `${ddiInteractions.length} DDI warning${ddiInteractions.length > 1 ? "s" : ""}` : "No DDI warning"}
              </Badge>
            </div>

            {ddiInteractions.length > 0 ? (
              <div className="mt-3 space-y-2">
                {ddiInteractions.map((item, idx) => (
                  <div key={`${item.drugA}-${item.drugB}-${idx}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <div className="font-semibold">{item.pair[0]} + {item.pair[1]} · {item.severity.toUpperCase()}</div>
                    <div className="mt-1">{item.description}</div>
                    <div className="mt-1 font-medium">{item.recommendation}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader
              eyebrow="Follow-up plan"
              title={sectionBadge("followUp").title}
              description={sectionBadge("followUp").action}
              actions={<Badge tone="info">{sectionBadge("followUp").source}</Badge>}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input value={form.followUp.interval} onChange={(e) => update(["followUp", "interval"], e.target.value)} placeholder="Follow-up interval" />
              <Input value={form.followUp.reason} onChange={(e) => update(["followUp", "reason"], e.target.value)} placeholder="Reason" />
              <Input value={form.followUp.referral} onChange={(e) => update(["followUp", "referral"], e.target.value)} placeholder="Referral" />
              <Input value={form.followUp.additionalInstructions} onChange={(e) => update(["followUp", "additionalInstructions"], e.target.value)} placeholder="Additional instructions" />
            </div>

            <div className="mt-3">
              <Field label="Doctor note (internal)">
                <Textarea value={form.doctorNote} onChange={(e) => setForm((current) => ({ ...current, doctorNote: e.target.value }))} />
              </Field>
            </div>
          </Card>

            <Card className="!border-slate-200/85 !bg-white shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" className="rounded-full border-slate-200/90" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save progress"}
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={approving}
                  className="rounded-full !bg-[#0A2533] px-6 text-white shadow-md hover:!bg-[#0f3849]"
                >
                  <Send className="h-4 w-4" />
                  {approving ? "Approving..." : "Approve and publish Rx"}
                </Button>
                {bundle.review?.approved ? <Badge tone="success">Already approved</Badge> : null}
              </div>
            </Card>
          </div>

          <aside className="space-y-4 lg:col-span-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pb-4">
            <div className="unified-emr-panel p-4 sm:p-5">
              <p className="unified-emr-eyebrow">Care side panel</p>
              <h2 className="mt-2 text-lg font-bold text-slate-900">Lab workflow</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Suggested tests, request status, and completed reports stay in this rail while you document the encounter.
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2.5 text-xs font-medium text-slate-600">
                <Sparkles className="h-4 w-4 text-amber-500" />
                AI signals & safety
              </div>
            </div>

            <Card className="!border-slate-200/85 !bg-white shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
              <CardHeader
                eyebrow="Investigations"
                title={sectionBadge("investigations").title}
                description={sectionBadge("investigations").action}
                actions={<Badge tone="info">{sectionBadge("investigations").source}</Badge>}
              />
              <p className="unified-emr-eyebrow mb-2 text-slate-400">Suggested tests</p>
              <div className="flex flex-wrap gap-2">
                {INVESTIGATION_SUGGESTIONS.map((tag) => {
                  const selected = form.investigations.selected.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleInvestigation(tag)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                        selected ? "unified-emr-chip-on" : "unified-emr-chip-off"
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  value={form.investigations.customInput}
                  onChange={(e) => update(["investigations", "customInput"], e.target.value)}
                  placeholder="Add custom investigation"
                />
                <Button variant="secondary" onClick={addCustomInvestigation}>
                  Add
                </Button>
              </div>
              <p className="unified-emr-eyebrow mb-2 mt-5 text-slate-400">Edit lab request</p>
              <div className="space-y-2">
                {form.investigations.selected.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-center text-xs text-slate-500">
                    Select tests above to build the lab request list.
                  </p>
                ) : (
                  form.investigations.selected.map((key) => {
                    const meta = getLabDisplay(key);
                    return (
                      <div key={`lab-${key}`} className="unified-emr-panel-mint rounded-xl border border-emerald-200/80 p-3">
                        <div className="text-sm font-semibold text-slate-900">{meta.label}</div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{meta.dept}</div>
                        <div className="mt-1 text-xs text-slate-500">{meta.sample}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            <Card className="!border-slate-200/85 !bg-white shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
              <CardHeader
                eyebrow="Patient portal"
                title={sectionBadge("testsPortal").title}
                description={sectionBadge("testsPortal").action}
                actions={<Badge tone="success">{sectionBadge("testsPortal").source}</Badge>}
              />
              <p className="mb-3 text-sm text-muted">
                Same standard test template for every patient. Toggles and custom tests are shared with section 7—use either
                block. After <strong>Approve and publish Rx</strong>, the list and notes below appear in the patient app under{" "}
                <strong>Tests</strong>.
              </p>
              <p className="unified-emr-eyebrow mb-2 text-slate-400">Suggested tests</p>
              <div className="flex flex-wrap gap-2">
                {INVESTIGATION_SUGGESTIONS.map((tag) => {
                  const selected = form.investigations.selected.includes(tag);
                  return (
                    <button
                      key={`tests-portal-${tag}`}
                      type="button"
                      onClick={() => toggleInvestigation(tag)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                        selected ? "unified-emr-chip-on" : "unified-emr-chip-off"
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  value={form.investigations.customInput}
                  onChange={(e) => update(["investigations", "customInput"], e.target.value)}
                  placeholder="Add custom investigation"
                />
                <Button variant="secondary" onClick={addCustomInvestigation}>
                  Add
                </Button>
              </div>
              <div className="mt-4">
                <Field label="Instructions for patient (optional)">
                  <Textarea
                    value={form.investigations.patientNote}
                    onChange={(e) => update(["investigations", "patientNote"], e.target.value)}
                    placeholder="e.g. Fasting required for RBS; report to lab with this visit token."
                    rows={3}
                  />
                </Field>
              </div>
            </Card>
          </aside>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Prescription issued"
        description="This preview simulates the patient-facing prescription immediately after doctor approval."
      >
        {previewPrescription ? (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-700" />
                <div>
                  <div className="text-base font-semibold text-emerald-950">Approved for {bundle.patient.fullName}</div>
                  <div className="mt-1 text-sm text-emerald-900/90">Prescription is now available in the patient portal.</div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {previewPrescription.medicines.map((medicine) => (
                <div key={`${previewPrescription.id}-${medicine.name}`} className="rounded-[22px] border border-line bg-surface-2 p-4">
                  <div className="text-base font-semibold text-ink">{medicine.name}</div>
                  <div className="mt-2 text-sm text-muted">
                    {medicine.dosage} · {medicine.frequency} · {medicine.duration}
                  </div>
                  <div className="mt-2 text-sm text-ink">{medicine.instructions}</div>
                </div>
              ))}
            </div>
            <div className="rounded-[22px] border border-line bg-surface-2 p-4 text-sm text-muted">
              {previewPrescription.followUpNote}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setModalOpen(false)}>Continue review</Button>
              <Button asChild variant="secondary">
                <Link to="/patient/prescriptions">
                  <ShieldCheck className="h-4 w-4" />
                  Open patient prescriptions
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </AppShell>
  );
}
