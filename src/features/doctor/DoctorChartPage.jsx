import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, Plus, Send, ShieldCheck } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input, Textarea } from "../../components/ui/FormFields";
import { Modal } from "../../components/ui/Modal";
import { useDemoData } from "../../app/DemoDataProvider";
import { getAppointmentBundle, getDoctorWorkspace } from "../shared/selectors";
import { formatConfidence, formatStatus, formatTime } from "../../lib/format";
import { clone } from "../../lib/utils";

function buildForm(bundle) {
  return {
    chiefComplaint: bundle.draft?.soap?.chiefComplaint || "",
    subjective: bundle.draft?.soap?.subjective || "",
    objective: bundle.draft?.soap?.objective || "",
    assessment: bundle.draft?.soap?.assessment || "",
    plan: bundle.draft?.soap?.plan || "",
    vitals: clone(
      bundle.draft?.vitals || {
        temperature: "",
        pulse: "",
        bloodPressure: "",
        spo2: ""
      }
    ),
    diagnoses: clone(bundle.draft?.diagnoses || [{ label: "Needs clinician confirmation", code: "R69", confidence: 0.5 }]),
    medicationSuggestions: clone(
      bundle.draft?.medicationSuggestions || [{ name: "", dosage: "", frequency: "", duration: "", rationale: "" }]
    )
  };
}

function toDraft(form, bundle) {
  return {
    ...(bundle.draft || {}),
    id: bundle.draft?.id || `draft-${bundle.appointment.id}`,
    appointmentId: bundle.appointment.id,
    soap: {
      chiefComplaint: form.chiefComplaint,
      subjective: form.subjective,
      objective: form.objective,
      assessment: form.assessment,
      plan: form.plan
    },
    vitals: form.vitals,
    diagnoses: form.diagnoses,
    medicationSuggestions: form.medicationSuggestions
  };
}

function diffEditedFields(form, bundle) {
  const original = buildForm(bundle);
  const edited = [];

  if (form.chiefComplaint !== original.chiefComplaint) edited.push("chiefComplaint");
  if (form.subjective !== original.subjective) edited.push("subjective");
  if (form.objective !== original.objective) edited.push("objective");
  if (form.assessment !== original.assessment) edited.push("assessment");
  if (form.plan !== original.plan) edited.push("plan");
  if (JSON.stringify(form.vitals) !== JSON.stringify(original.vitals)) edited.push("vitals");
  if (JSON.stringify(form.diagnoses) !== JSON.stringify(original.diagnoses)) edited.push("diagnoses");
  if (JSON.stringify(form.medicationSuggestions) !== JSON.stringify(original.medicationSuggestions)) {
    edited.push("medicationSuggestions");
  }

  return edited;
}

function highlightClass(fieldName, editedFields) {
  return editedFields.includes(fieldName) ? "border-cyan-300 bg-brand-mint ring-2 ring-cyan-100" : "border-line bg-surface-2";
}

export function DoctorChartPage() {
  const { appointmentId } = useParams();
  const { state, actions } = useDemoData();
  const bundle = getAppointmentBundle(state, appointmentId);
  const { appointments } = getDoctorWorkspace(state);
  const [form, setForm] = useState(() => (bundle ? buildForm(bundle) : null));
  const [note, setNote] = useState(bundle?.review?.note || "");
  const [followUpNote, setFollowUpNote] = useState(bundle?.prescription?.followUpNote || "Review if symptoms persist after 5 days.");
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewPrescription, setPreviewPrescription] = useState(bundle?.prescription || null);
  const draftContext = bundle?.draft || {
    confidenceMap: { subjective: 0.45, objective: 0.25, assessment: 0.3, plan: 0.25 },
    alerts: ["Interview has not been submitted yet. Approval should wait for more history."],
    differentials: ["Insufficient pre-visit information"]
  };

  useEffect(() => {
    if (bundle) {
      setForm(buildForm(bundle));
      setNote(bundle.review?.note || "");
      setFollowUpNote(bundle.prescription?.followUpNote || "Review if symptoms persist after 5 days.");
      setPreviewPrescription(bundle.prescription || null);
    }
  }, [bundle?.appointment?.id, bundle?.review?.reviewedAt, bundle?.prescription?.issuedAt]);

  const editedFields = useMemo(() => {
    if (!bundle || !form) return [];
    return diffEditedFields(form, bundle);
  }, [form, bundle]);

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

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateVital(key, value) {
    setForm((current) => ({ ...current, vitals: { ...current.vitals, [key]: value } }));
  }

  function updateDiagnosis(index, key, value) {
    setForm((current) => ({
      ...current,
      diagnoses: current.diagnoses.map((diagnosis, diagnosisIndex) =>
        diagnosisIndex === index ? { ...diagnosis, [key]: value } : diagnosis
      )
    }));
  }

  function updateMedication(index, key, value) {
    setForm((current) => ({
      ...current,
      medicationSuggestions: current.medicationSuggestions.map((medicine, medicineIndex) =>
        medicineIndex === index ? { ...medicine, [key]: value } : medicine
      )
    }));
  }

  function addMedication() {
    setForm((current) => ({
      ...current,
      medicationSuggestions: [
        ...current.medicationSuggestions,
        { name: "", dosage: "", frequency: "", duration: "", rationale: "" }
      ]
    }));
  }

  async function handleSave() {
    setSaving(true);
    await actions.doctor.saveDoctorReview(bundle.appointment.id, {
      draft: toDraft(form, bundle),
      editedFields,
      note
    });
    setSaving(false);
  }

  async function handleApprove() {
    setApproving(true);
    const next = await actions.doctor.approveEncounter(bundle.appointment.id, {
      draft: toDraft(form, bundle),
      editedFields,
      note,
      followUpNote
    });
    setPreviewPrescription(
      Object.values(next.prescriptions.byId).find((item) => item.appointmentId === bundle.appointment.id) || null
    );
    setApproving(false);
    setModalOpen(true);
  }

  return (
    <AppShell
      title="Unified EMR validation"
      subtitle="Review the APCI draft, edit clinical sections inline, capture doctor notes, and approve a patient-facing prescription without leaving this single workspace."
      languageLabel="Doctor review in English"
    >
      <div className="grid gap-6 xl:grid-cols-[0.74fr_1.28fr_0.78fr]">
        <Card className="xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)] xl:overflow-auto">
          <CardHeader
            eyebrow="Today's queue"
            title="Consult navigation"
            description="Jump between queued patients while keeping the doctor workflow intact."
          />
          <div className="space-y-3">
            {appointments.map((item) => (
              <Link key={item.id} to={`/doctor/patient/${item.id}`}>
                <div
                  className={`rounded-[22px] border p-4 transition ${
                    item.id === bundle.appointment.id ? "border-cyan-300 bg-brand-mint" : "border-line bg-surface-2 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-ink">{item.patient?.fullName}</div>
                      <div className="mt-1 text-xs text-muted">
                        {formatTime(item.startAt)} · Token {item.token}
                      </div>
                    </div>
                    <Badge tone={item.queueStatus === "approved" ? "success" : item.queueStatus === "ai_ready" ? "info" : "warning"}>
                      {formatStatus(item.queueStatus)}
                    </Badge>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-muted">
                    {item.draft?.soap?.chiefComplaint || "Interview still pending"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="space-y-6">
          <CardHeader
            eyebrow="Encounter review"
            title={`${bundle.patient.fullName} · ${bundle.patient.age || "--"} yrs`}
            description={`${bundle.doctor.fullName} · ${formatStatus(bundle.appointment.visitType)} · Token ${bundle.appointment.token}`}
            actions={
              <Button asChild variant="secondary">
                <Link to="/doctor">
                  <ArrowLeft className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            }
          />

          <div className={`rounded-[24px] border p-5 ${highlightClass("chiefComplaint", editedFields)}`}>
            <Field label="Chief complaint">
              <Input value={form.chiefComplaint} onChange={(event) => updateField("chiefComplaint", event.target.value)} />
            </Field>
          </div>

          <div className={`rounded-[24px] border p-5 ${highlightClass("subjective", editedFields)}`}>
            <Field label="History / subjective">
              <Textarea value={form.subjective} onChange={(event) => updateField("subjective", event.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`rounded-[24px] border p-5 ${highlightClass("objective", editedFields)}`}>
              <Field label="Examination / objective">
                <Textarea value={form.objective} onChange={(event) => updateField("objective", event.target.value)} />
              </Field>
            </div>
            <div className="rounded-[24px] border border-line bg-surface-2 p-5">
              <div className="section-title">Vitals</div>
              <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${editedFields.includes("vitals") ? "rounded-2xl bg-brand-mint p-2" : ""}`}>
                <Input value={form.vitals.temperature} onChange={(event) => updateVital("temperature", event.target.value)} placeholder="Temperature" />
                <Input value={form.vitals.pulse} onChange={(event) => updateVital("pulse", event.target.value)} placeholder="Pulse" />
                <Input value={form.vitals.bloodPressure} onChange={(event) => updateVital("bloodPressure", event.target.value)} placeholder="Blood pressure" />
                <Input value={form.vitals.spo2} onChange={(event) => updateVital("spo2", event.target.value)} placeholder="SpO2" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`rounded-[24px] border p-5 ${highlightClass("assessment", editedFields)}`}>
              <Field label="Assessment">
                <Textarea value={form.assessment} onChange={(event) => updateField("assessment", event.target.value)} />
              </Field>
            </div>
            <div className={`rounded-[24px] border p-5 ${highlightClass("plan", editedFields)}`}>
              <Field label="Plan">
                <Textarea value={form.plan} onChange={(event) => updateField("plan", event.target.value)} />
              </Field>
            </div>
          </div>

          <div className={`rounded-[24px] border p-5 ${highlightClass("diagnoses", editedFields)}`}>
            <div className="section-title">AI-suggested diagnoses</div>
            <div className="mt-4 space-y-3">
              {form.diagnoses.map((diagnosis, index) => (
                <div key={`${diagnosis.code}-${index}`} className="grid gap-3 rounded-2xl bg-white p-4 md:grid-cols-[1fr_120px_120px]">
                  <Input value={diagnosis.label} onChange={(event) => updateDiagnosis(index, "label", event.target.value)} />
                  <Input value={diagnosis.code} onChange={(event) => updateDiagnosis(index, "code", event.target.value)} />
                  <Input
                    value={diagnosis.confidence}
                    onChange={(event) => updateDiagnosis(index, "confidence", Number(event.target.value))}
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-[24px] border p-5 ${highlightClass("medicationSuggestions", editedFields)}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="section-title">Prescription draft</div>
                <div className="mt-2 text-sm text-muted">Edit the proposed medications before approval.</div>
              </div>
              <Button variant="secondary" size="sm" onClick={addMedication}>
                <Plus className="h-4 w-4" />
                Add line
              </Button>
            </div>
            <div className="mt-4 space-y-4">
              {form.medicationSuggestions.map((medicine, index) => (
                <div key={`${medicine.name || "med"}-${index}`} className="rounded-[22px] bg-white p-4 shadow-soft">
                  <div className="grid gap-3 lg:grid-cols-4">
                    <Input value={medicine.name} onChange={(event) => updateMedication(index, "name", event.target.value)} placeholder="Medication" />
                    <Input value={medicine.dosage} onChange={(event) => updateMedication(index, "dosage", event.target.value)} placeholder="Dosage" />
                    <Input value={medicine.frequency} onChange={(event) => updateMedication(index, "frequency", event.target.value)} placeholder="Frequency" />
                    <Input value={medicine.duration} onChange={(event) => updateMedication(index, "duration", event.target.value)} placeholder="Duration" />
                  </div>
                  <div className="mt-3">
                    <Input value={medicine.rationale} onChange={(event) => updateMedication(index, "rationale", event.target.value)} placeholder="Instruction / rationale" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-[24px] border border-line bg-surface-2 p-5">
              <Field label="Doctor note" hint="Logged for future fine-tuning">
                <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
              </Field>
            </div>
            <div className="rounded-[24px] border border-line bg-surface-2 p-5">
              <Field label="Patient follow-up note">
                <Textarea value={followUpNote} onChange={(event) => setFollowUpNote(event.target.value)} />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={handleSave} disabled={saving}>
              <ClipboardCheck className="h-4 w-4" />
              {saving ? "Saving..." : "Save progress"}
            </Button>
            <Button onClick={handleApprove} disabled={approving}>
              <Send className="h-4 w-4" />
              {approving ? "Approving..." : "Approve and publish Rx"}
            </Button>
            {bundle.review?.approved ? <Badge tone="success">Already approved</Badge> : null}
          </div>
        </Card>

        <Card className="space-y-5 xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)] xl:overflow-auto">
          <CardHeader
            eyebrow="Clinical side panel"
            title="AI signals & safety"
            description="A compact right rail for confidence, alerts, differentials, and future integration hooks."
          />
          <div className="rounded-[24px] border border-line bg-surface-2 p-5">
            <div className="section-title">Confidence map</div>
            <div className="mt-4 space-y-3">
              {Object.entries(draftContext.confidenceMap).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm">
                  <span className="font-semibold capitalize text-ink">{key}</span>
                  <Badge tone={value > 0.8 ? "success" : "warning"}>{formatConfidence(value)}</Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-700" />
              <div className="text-sm font-semibold text-amber-950">Alerts</div>
            </div>
            <div className="mt-4 space-y-2">
              {draftContext.alerts.map((alert) => (
                <div key={alert} className="rounded-2xl border border-amber-200 bg-white/70 px-4 py-3 text-sm text-amber-900">
                  {alert}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-line bg-surface-2 p-5">
            <div className="section-title">Differentials</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(draftContext.differentials || []).map((item) => (
                <span key={item} className="pill">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-line bg-surface-2 p-5">
            <div className="section-title">ABHA readiness</div>
            <div className="mt-4 space-y-3 text-sm text-muted">
              {[
                "Composition bundle pending doctor approval",
                "MedicationRequest will be generated on approve",
                "Consent flow placeholder ready for sandbox",
                bundle.patient.abhaNumber ? `ABHA linked: ${bundle.patient.abhaNumber}` : "ABHA not linked yet"
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-brand-tide" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-line bg-surface-2 p-5">
            <div className="section-title">Interview excerpt</div>
            <div className="mt-4 space-y-2">
              {(bundle.interview?.transcript || []).slice(-4).map((entry, index) => (
                <div
                  key={`${entry.role}-${index}`}
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    entry.role === "ai" ? "bg-white text-muted" : "bg-brand-mint text-brand-midnight"
                  }`}
                >
                  {entry.text}
                </div>
              ))}
            </div>
          </div>
        </Card>
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
                  <div className="mt-1 text-sm text-emerald-900/90">
                    Patient portal and mock approval states are now updated from the same local workflow.
                  </div>
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
                <Link to="/patient/prescriptions">Open patient portal</Link>
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </AppShell>
  );
}
