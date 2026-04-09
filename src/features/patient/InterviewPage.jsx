import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ChevronRight, MessageSquareHeart } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../components/ui/FormFields";
import { LanguageToggle } from "../../components/ui/LanguageToggle";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { useDemoData } from "../../app/DemoDataProvider";
import { getAppointmentBundle } from "../shared/selectors";
import { usePatientLanguage } from "./usePatientLanguage";

const interviewCopy = {
  en: {
    title: "AI symptom interview",
    subtitle:
      "A guided conversational intake that turns patient responses into a structured draft for the doctor before the consultation begins.",
    stepTitle: ["Primary concern", "Timeline", "Severity", "Associated symptoms", "Medication and allergy check", "Review summary"],
    primaryConcern: "What is the main issue today?",
    duration: "How long have you had it?",
    severity: "How intense is it right now?",
    associatedSymptoms: "Any other symptoms or context?",
    medications: "Current medicines or home remedies",
    allergies: "Known allergies",
    submit: "Submit to doctor queue",
    submitted: "Interview submitted",
    submittedBody:
      "Your draft has been pushed to the doctor queue. The doctor will now see a pre-filled note before the visit starts.",
    summary: "Preview of what APCI will send",
    durationOptions: ["Since today", "2 to 3 days", "About a week", "More than a week"],
    severityOptions: ["Mild", "Moderate", "Strong", "Severe"],
    refine: "Update responses",
    home: "Back home"
  },
  hi: {
    title: "एआई लक्षण इंटरव्यू",
    subtitle: "यह इंटरव्यू आपकी जानकारी को डॉक्टर के लिए एक संरचित ड्राफ्ट में बदल देता है।",
    stepTitle: ["मुख्य समस्या", "कब से है", "तीव्रता", "अन्य लक्षण", "दवा और एलर्जी", "समीक्षा सारांश"],
    primaryConcern: "आज की मुख्य परेशानी क्या है?",
    duration: "यह समस्या कब से है?",
    severity: "अभी इसकी तीव्रता कितनी है?",
    associatedSymptoms: "कोई अन्य लक्षण या जानकारी?",
    medications: "चल रही दवाएं या घरेलू उपाय",
    allergies: "कोई एलर्जी",
    submit: "डॉक्टर क्यू में भेजें",
    submitted: "इंटरव्यू सबमिट हो गया",
    submittedBody: "आपका ड्राफ्ट डॉक्टर की क्यू में भेज दिया गया है। विजिट शुरू होने से पहले डॉक्टर इसे देख पाएंगे।",
    summary: "APCI डॉक्टर को क्या भेजेगा",
    durationOptions: ["आज से", "2 से 3 दिन", "लगभग एक हफ्ता", "एक हफ्ते से ज्यादा"],
    severityOptions: ["हल्का", "मध्यम", "तेज", "बहुत ज्यादा"],
    refine: "जवाब अपडेट करें",
    home: "होम पर वापस"
  }
};

const concernSuggestions = {
  en: ["Fever with body ache", "Cough and cold", "Stomach acidity", "Headache / migraine", "Fatigue and poor sleep"],
  hi: ["बुखार और बदन दर्द", "खांसी और जुकाम", "पेट में जलन", "सिरदर्द / माइग्रेन", "थकान और नींद की दिक्कत"]
};

export function InterviewPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { state, actions } = useDemoData();
  const bundle = getAppointmentBundle(state, appointmentId);
  const [language, setLanguage] = usePatientLanguage(bundle?.patient?.preferredLanguage || "en");
  const copy = interviewCopy[language];
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [editingExisting, setEditingExisting] = useState(false);
  const [answers, setAnswers] = useState({
    language,
    primaryConcern: "",
    duration: copy.durationOptions[1],
    severity: copy.severityOptions[1],
    associatedSymptoms: "",
    medications: "",
    allergies: ""
  });

  const alreadySubmitted = bundle?.interview?.completionStatus === "complete" && !editingExisting;
  const progress = useMemo(() => ((step + 1) / copy.stepTitle.length) * 100, [step, copy.stepTitle.length]);

  if (!bundle) {
    return (
      <AppShell title="Interview not found" subtitle="The requested appointment could not be found.">
        <Card>
          <Button asChild>
            <Link to="/patient">Return to home</Link>
          </Button>
        </Card>
      </AppShell>
    );
  }

  function updateAnswer(key, value) {
    setAnswers((current) => ({ ...current, language, [key]: value }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    await actions.booking.submitInterview(bundle.appointment.id, { ...answers, language });
    setSubmitting(false);
    setEditingExisting(false);
  }

  return (
    <AppShell title={copy.title} subtitle={copy.subtitle} languageLabel="Adaptive interview in English / Hindi">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader
            eyebrow="Visit context"
            title={bundle.patient.fullName}
            description={`Appointment token ${bundle.appointment.token} · ${bundle.doctor.fullName}`}
          />
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="pill">
                <MessageSquareHeart className="h-4 w-4 text-brand-tide" />
                Conversational APCI intake
              </div>
              <LanguageToggle
                value={language}
                onChange={(value) => {
                  setLanguage(value);
                  setAnswers((current) => ({
                    ...current,
                    language: value,
                    duration: interviewCopy[value].durationOptions[1],
                    severity: interviewCopy[value].severityOptions[1]
                  }));
                }}
              />
            </div>

            {alreadySubmitted ? (
              <div className="space-y-4">
                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-700" />
                    <div>
                      <div className="text-base font-semibold text-emerald-950">{copy.submitted}</div>
                      <div className="mt-1 text-sm text-emerald-900/90">{copy.submittedBody}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 rounded-[24px] border border-line bg-surface-2 p-5">
                  <div className="section-title">Transcript preview</div>
                  {(bundle.interview?.transcript || []).map((entry, index) => (
                    <div
                      key={`${entry.role}-${index}`}
                      className={`rounded-2xl px-4 py-3 text-sm ${
                        entry.role === "ai" ? "bg-white text-muted" : "bg-brand-mint text-ink"
                      }`}
                    >
                      {entry.text}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => setEditingExisting(true)}>
                    {copy.refine}
                  </Button>
                  <Button onClick={() => navigate("/patient")}>{copy.home}</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm text-muted">
                    <span>{copy.stepTitle[step]}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <ProgressBar value={progress} />
                </div>

                {step === 0 ? (
                  <div className="space-y-4">
                    <Field label={copy.primaryConcern}>
                      <Input
                        value={answers.primaryConcern}
                        onChange={(event) => updateAnswer("primaryConcern", event.target.value)}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      {concernSuggestions[language].map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          className="pill hover:border-cyan-300 hover:bg-cyan-50"
                          onClick={() => updateAnswer("primaryConcern", suggestion)}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {step === 1 ? (
                  <Field label={copy.duration}>
                    <Select value={answers.duration} onChange={(event) => updateAnswer("duration", event.target.value)}>
                      {copy.durationOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </Select>
                  </Field>
                ) : null}

                {step === 2 ? (
                  <Field label={copy.severity}>
                    <Select value={answers.severity} onChange={(event) => updateAnswer("severity", event.target.value)}>
                      {copy.severityOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </Select>
                  </Field>
                ) : null}

                {step === 3 ? (
                  <Field label={copy.associatedSymptoms}>
                    <Textarea value={answers.associatedSymptoms} onChange={(event) => updateAnswer("associatedSymptoms", event.target.value)} />
                  </Field>
                ) : null}

                {step === 4 ? (
                  <div className="grid gap-4">
                    <Field label={copy.medications}>
                      <Input value={answers.medications} onChange={(event) => updateAnswer("medications", event.target.value)} />
                    </Field>
                    <Field label={copy.allergies}>
                      <Input value={answers.allergies} onChange={(event) => updateAnswer("allergies", event.target.value)} />
                    </Field>
                  </div>
                ) : null}

                {step === 5 ? (
                  <div className="space-y-4 rounded-[24px] border border-line bg-surface-2 p-5">
                    <div className="section-title">{copy.summary}</div>
                    <div className="rounded-2xl bg-white px-4 py-3 text-sm">
                      <div className="font-semibold text-ink">{answers.primaryConcern || "-"}</div>
                      <div className="mt-1 text-muted">{answers.duration}</div>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3 text-sm text-muted">
                      {answers.associatedSymptoms || "No extra symptoms added."}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" disabled={step === 0} onClick={() => setStep((current) => current - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                  {step < copy.stepTitle.length - 1 ? (
                    <Button
                      onClick={() => setStep((current) => current + 1)}
                      disabled={step === 0 && !answers.primaryConcern.trim()}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={handleSubmit} disabled={submitting}>
                      {submitting ? "Submitting..." : copy.submit}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Doctor handoff preview"
            title="What the clinician receives"
            description="This panel previews the high-level structure of the generated pre-chart before doctor validation."
          />
          <div className="space-y-4">
            <div className="rounded-[24px] border border-line bg-surface-2 p-5">
              <div className="section-title">Chief complaint</div>
              <div className="mt-3 text-lg font-semibold text-ink">{answers.primaryConcern || bundle.draft?.soap?.chiefComplaint}</div>
            </div>
            <div className="rounded-[24px] border border-line bg-surface-2 p-5">
              <div className="section-title">Structured extraction</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["Duration", answers.duration || bundle.interview?.extractedFindings?.[1] || "Pending"],
                  ["Severity", answers.severity || "Pending"],
                  ["Associated", answers.associatedSymptoms || bundle.interview?.extractedFindings?.[2] || "Pending"],
                  ["Medications", answers.medications || "To be confirmed"]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-white px-4 py-3 text-sm">
                    <div className="section-title">{label}</div>
                    <div className="mt-2 font-semibold text-ink">{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] border border-cyan-200 bg-brand-mint p-5">
              <div className="section-title">After submission</div>
              <p className="mt-3 text-sm leading-6 text-brand-midnight">
                The doctor dashboard will mark this patient as AI-ready, expose a unified EMR draft, and allow edits before one-click approval.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
