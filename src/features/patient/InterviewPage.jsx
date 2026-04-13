import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { PrecheckResponseForm } from "./PrecheckResponseForm";
import { useDemoData } from "../../app/DemoDataProvider";
import { getAppointmentBundle } from "../shared/selectors";

export function InterviewPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { state, actions } = useDemoData();
  const bundle = getAppointmentBundle(state, appointmentId);
  const questionnaire = bundle?.precheckQuestionnaire || null;
  const isAwaitingResponses = questionnaire?.status === "sent_to_patient";
  const isCompleted = questionnaire?.status === "completed";

  if (!bundle) {
    return (
      <AppShell title="Pre-check not found" subtitle="The requested appointment could not be found.">
        <Card>
          <Button asChild>
            <Link to="/patient">Return to home</Link>
          </Button>
        </Card>
      </AppShell>
    );
  }

  async function handleSubmitPrecheck(responses) {
    await actions.booking.submitPrecheckResponses(bundle.appointment.id, responses);
  }

  return (
    <AppShell
      title="Pre-check"
      subtitle="Answer the questions your doctor sent before the consultation begins."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_0.92fr]">
        <Card>
          <CardHeader
            eyebrow="Visit context"
            title={bundle.patient.fullName}
            description={`Appointment token ${bundle.appointment.token} · ${bundle.doctor.fullName}`}
          />

          {isAwaitingResponses ? (
            <div className="space-y-4">
              <div className="rounded-[24px] border border-cyan-200 bg-cyan-50 p-5">
                <div className="flex items-start gap-3">
                  <FileText className="mt-1 h-5 w-5 text-cyan-700" />
                  <div>
                    <div className="text-base font-semibold text-cyan-950">Pre-check from your doctor</div>
                    <div className="mt-1 text-sm text-cyan-900/90">
                      Please answer these questions before the appointment so your doctor can review the summary in advance.
                    </div>
                  </div>
                </div>
              </div>

              <PrecheckResponseForm questionnaire={questionnaire} onSubmit={handleSubmitPrecheck} isLoading={false} />

              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => navigate("/patient")}>Back home</Button>
                <Button asChild variant="secondary">
                  <Link to={`/patient/appointments/${bundle.appointment.id}?bucket=${bundle.appointment.journeyBucket}`}>
                    View appointment
                  </Link>
                </Button>
              </div>
            </div>
          ) : isCompleted ? (
            <div className="space-y-4">
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-700" />
                  <div>
                    <div className="text-base font-semibold text-emerald-950">Pre-check complete</div>
                    <div className="mt-1 text-sm text-emerald-900/90">
                      Your answers have been submitted and are now visible in the doctor workspace.
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-line bg-surface-2 p-5 text-sm leading-6 text-muted">
                The doctor will see your pre-check summary in the EMR and can review it before the visit starts.
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => navigate("/patient")}>Back home</Button>
                <Button asChild>
                  <Link to={`/patient/appointments/${bundle.appointment.id}?bucket=${bundle.appointment.journeyBucket}`}>
                    View appointment
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[24px] border border-dashed border-line bg-surface-2 p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-1 h-5 w-5 text-brand-tide" />
                  <div>
                    <div className="text-base font-semibold text-ink">No pre-check available yet</div>
                    <div className="mt-1 text-sm leading-6 text-muted">
                      Your doctor has not sent pre-check questions for this appointment yet. Check back after the clinic opens the questionnaire.
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => navigate("/patient")}>Back home</Button>
                <Button asChild>
                  <Link to={`/patient/appointments/${bundle.appointment.id}?bucket=${bundle.appointment.journeyBucket}`}>
                    View appointment
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            eyebrow="How it works"
            title="Pre-check workflow"
            description="This page is now dedicated to the doctor-sent pre-check and its completion status."
          />
          <div className="space-y-4 rounded-[24px] border border-line bg-surface-2 p-5 text-sm leading-6 text-muted">
            <div>
              <div className="font-semibold text-ink">1. Doctor sends questions</div>
              <div className="mt-1">The clinic sends a short questionnaire before the visit.</div>
            </div>
            <div>
              <div className="font-semibold text-ink">2. You answer once</div>
              <div className="mt-1">Your answers are saved and shown back to the doctor as a structured summary.</div>
            </div>
            <div>
              <div className="font-semibold text-ink">3. Doctor reviews it first</div>
              <div className="mt-1">The doctor sees your pre-check before the appointment starts, so the consult can begin faster.</div>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
