import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, FlaskConical, PlayCircle, TestTube2 } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../components/ui/FormFields";
import { useDemoData } from "../../app/DemoDataProvider";
import { getLabOrderBundle } from "../shared/selectors";
import { formatDate, formatTime } from "../../lib/format";
import { buildLabResultTemplate } from "../../services/labHelpers";

function LabProgressInline({ progress }) {
  return (
    <div className="flex flex-wrap gap-2">
      {progress.map((step) => (
        <span
          key={step.key}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            step.current
              ? "border-cyan-200 bg-brand-mint text-brand-midnight"
              : step.done
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-line bg-white text-muted"
          }`}
        >
          {step.label}
        </span>
      ))}
    </div>
  );
}

function createInitialForm(state, order) {
  if (!order) {
    return {
      resultItems: [],
      summary: ""
    };
  }

  return {
    resultItems: order.report?.resultItems || buildLabResultTemplate(order.selectedTestIds, state.labCatalog.byId),
    summary: order.report?.summary || ""
  };
}

export function LabOrderPage() {
  const { labOrderId } = useParams();
  const { state, actions } = useDemoData();
  const order = getLabOrderBundle(state, labOrderId);
  const [form, setForm] = useState(() => createInitialForm(state, order));
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setForm(createInitialForm(state, order));
  }, [labOrderId, order?.report?.completedAt, order?.status, state.labCatalog]);

  const canEdit = order && !["completed", "cancelled"].includes(order.status);
  const selectedTests = useMemo(() => order?.tests || [], [order]);

  async function handleMarkSampleReceived() {
    if (!order || order.status !== "ordered") {
      return;
    }

    setWorking(true);
    await actions.lab.markSampleReceived(order.id);
    setWorking(false);
  }

  async function handleStartProcessing() {
    if (!order || !["ordered", "sample_received"].includes(order.status)) {
      return;
    }

    setWorking(true);
    await actions.lab.startLabOrder(order.id);
    setWorking(false);
  }

  async function handleComplete() {
    if (!order) {
      return;
    }

    setWorking(true);
    await actions.lab.completeLabOrder(order.id, form);
    setWorking(false);
  }

  function updateResult(index, key, value) {
    setForm((current) => ({
      ...current,
      resultItems: current.resultItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    }));
  }

  return (
    <AppShell
      title="Lab order detail"
      subtitle="Move requests through sample collection and processing, enter structured result values, and publish a downloadable report."
      languageLabel="Lab UI in English"
    >
      <Card>
        <CardHeader
          eyebrow="Order detail"
          title={order ? order.patient?.fullName : "Lab order not found"}
          description={
            order
              ? `${order.doctor?.fullName} | ${formatDate(order.orderedAt)} | ${order.doctorStatusLabel}`
              : "No lab order could be found for this route."
          }
          actions={
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link to="/lab">
                  <ArrowLeft className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              {order?.report ? (
                <Button onClick={() => actions.documents.downloadLabReport(order.report.id)}>
                  <FileDown className="h-4 w-4" />
                  Download report
                </Button>
              ) : null}
            </div>
          }
        />
        {order ? (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="rounded-[22px] border border-line bg-surface-2 p-4 text-sm">
                <div className="section-title">Status</div>
                <div className="mt-2">
                  <Badge tone={order.tone}>{order.doctorStatusLabel}</Badge>
                </div>
              </div>
              <div className="rounded-[22px] border border-line bg-surface-2 p-4 text-sm">
                <div className="section-title">Requested</div>
                <div className="mt-2 font-semibold text-ink">{formatDate(order.orderedAt)}</div>
              </div>
              <div className="rounded-[22px] border border-line bg-surface-2 p-4 text-sm">
                <div className="section-title">Assigned lab</div>
                <div className="mt-2 font-semibold text-ink">{order.assignedLabProfile?.fullName || "Unassigned"}</div>
              </div>
              <div className="rounded-[22px] border border-line bg-surface-2 p-4 text-sm">
                <div className="section-title">Visit</div>
                <div className="mt-2 font-semibold text-ink">
                  {order.appointment ? `${formatDate(order.appointment.startAt)} at ${formatTime(order.appointment.startAt)}` : "-"}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-line bg-surface-2 p-5">
              <div className="section-title">Progress</div>
              <div className="mt-4">
                <LabProgressInline progress={order.progress} />
              </div>
              <div className="mt-4 grid gap-3 text-sm text-muted md:grid-cols-3">
                <div className="rounded-2xl bg-white px-4 py-3">
                  Sample received: {order.sampleReceivedAt ? formatDate(order.sampleReceivedAt) : "Pending"}
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  Processing started: {order.processingStartedAt ? formatDate(order.processingStartedAt) : "Pending"}
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  Report ready: {order.completedAt ? formatDate(order.completedAt) : "Pending"}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-line bg-surface-2 p-5">
              <div className="section-title">Requested tests</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedTests.map((test) => (
                  <span key={test.id} className="pill">
                    {test.name}
                  </span>
                ))}
              </div>
              {order.clinicianNote ? <div className="mt-4 text-sm leading-6 text-muted">{order.clinicianNote}</div> : null}
            </div>

            <Card>
              <CardHeader
                eyebrow="Structured results"
                title={order.status === "completed" ? "Published report" : "Enter result values"}
                description="This remains a mock local workflow until real LIMS integration is introduced."
              />
              <div className="space-y-4">
                {form.resultItems.map((item, index) => (
                  <div key={item.testId} className="rounded-[24px] border border-line bg-surface-2 p-5">
                    <div className="text-base font-semibold text-ink">{item.name}</div>
                    <div className="mt-4 grid gap-4 md:grid-cols-4">
                      <Field label="Result">
                        <Input
                          value={item.result}
                          disabled={!canEdit}
                          onChange={(event) => updateResult(index, "result", event.target.value)}
                        />
                      </Field>
                      <Field label="Unit">
                        <Input
                          value={item.unit}
                          disabled={!canEdit}
                          onChange={(event) => updateResult(index, "unit", event.target.value)}
                        />
                      </Field>
                      <Field label="Reference range">
                        <Input
                          value={item.referenceRange}
                          disabled={!canEdit}
                          onChange={(event) => updateResult(index, "referenceRange", event.target.value)}
                        />
                      </Field>
                      <Field label="Flag">
                        <Select
                          value={item.flag}
                          disabled={!canEdit}
                          onChange={(event) => updateResult(index, "flag", event.target.value)}
                        >
                          <option value="normal">Normal</option>
                          <option value="high">High</option>
                          <option value="low">Low</option>
                          <option value="abnormal">Abnormal</option>
                        </Select>
                      </Field>
                    </div>
                  </div>
                ))}

                <Field label="Lab summary">
                  <Textarea
                    value={form.summary}
                    disabled={!canEdit}
                    onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                  />
                </Field>

                <div className="flex flex-wrap gap-3">
                  {order.status === "ordered" ? (
                    <Button variant="secondary" onClick={handleMarkSampleReceived} disabled={working}>
                      <TestTube2 className="h-4 w-4" />
                      {working ? "Updating..." : "Mark sample received"}
                    </Button>
                  ) : null}
                  {order.status === "sample_received" ? (
                    <Button variant="secondary" onClick={handleStartProcessing} disabled={working}>
                      <PlayCircle className="h-4 w-4" />
                      {working ? "Updating..." : "Start processing"}
                    </Button>
                  ) : null}
                  {canEdit && order.status !== "ordered" ? (
                    <Button onClick={handleComplete} disabled={working}>
                      <FlaskConical className="h-4 w-4" />
                      {working ? "Publishing..." : "Complete and publish report"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          </div>
        ) : null}
      </Card>
    </AppShell>
  );
}
