import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input, Select } from "../../components/ui/FormFields";
import { formatDate, formatTime } from "../../lib/format";
import { clone } from "../../lib/utils";
import { getScheduleByDate } from "./selectors";

const weekdays = [
  ["monday", "Mon"],
  ["tuesday", "Tue"],
  ["wednesday", "Wed"],
  ["thursday", "Thu"],
  ["friday", "Fri"],
  ["saturday", "Sat"],
  ["sunday", "Sun"]
];

function toBreakFields(rule) {
  const firstBreak = rule.breaks?.[0] || { startTime: "", endTime: "" };
  return {
    breakStart: firstBreak.startTime || "",
    breakEnd: firstBreak.endTime || ""
  };
}

function fromBreakFields(rule) {
  return {
    ...rule,
    breaks: rule.breakStart && rule.breakEnd ? [{ startTime: rule.breakStart, endTime: rule.breakEnd }] : []
  };
}

export function AvailabilityEditor({
  doctor,
  state,
  title,
  description,
  onSaveTemplate,
  onSaveOverride,
  onToggleSlot
}) {
  const template = state.scheduleTemplates.byId[doctor.id];
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(String(doctor.slotDurationMinutes || 15));
  const [weeklyRules, setWeeklyRules] = useState(() =>
    clone(
      Object.fromEntries(
        Object.entries(template.weeklyRules).map(([key, rule]) => [key, { ...rule, ...toBreakFields(rule) }])
      )
    )
  );
  const [selectedDate, setSelectedDate] = useState(state.meta.today);
  const override = state.scheduleOverrides.byId[`override-${doctor.id}-${selectedDate}`];
  const schedule = getScheduleByDate(state, doctor.id, selectedDate);
  const [overrideMode, setOverrideMode] = useState(override?.mode || "open");
  const [closedReason, setClosedReason] = useState(override?.closedReason || "");
  const [customStart, setCustomStart] = useState(override?.customRule?.startTime || "09:00");
  const [customEnd, setCustomEnd] = useState(override?.customRule?.endTime || "13:00");
  const [customBreakStart, setCustomBreakStart] = useState(override?.customRule?.breaks?.[0]?.startTime || "");
  const [customBreakEnd, setCustomBreakEnd] = useState(override?.customRule?.breaks?.[0]?.endTime || "");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);

  useEffect(() => {
    setSlotDurationMinutes(String(doctor.slotDurationMinutes || 15));
    setWeeklyRules(
      clone(
        Object.fromEntries(
          Object.entries(template.weeklyRules).map(([key, rule]) => [key, { ...rule, ...toBreakFields(rule) }])
        )
      )
    );
  }, [doctor.id, doctor.slotDurationMinutes, template]);

  useEffect(() => {
    const nextOverride = state.scheduleOverrides.byId[`override-${doctor.id}-${selectedDate}`];
    setOverrideMode(nextOverride?.mode || "open");
    setClosedReason(nextOverride?.closedReason || "");
    setCustomStart(nextOverride?.customRule?.startTime || "09:00");
    setCustomEnd(nextOverride?.customRule?.endTime || "13:00");
    setCustomBreakStart(nextOverride?.customRule?.breaks?.[0]?.startTime || "");
    setCustomBreakEnd(nextOverride?.customRule?.breaks?.[0]?.endTime || "");
  }, [doctor.id, selectedDate, state.scheduleOverrides.byId]);

  const scheduleLabel = useMemo(() => {
    if (!schedule) return "No schedule generated";
    if (schedule.slotSummary.available > 0) return `${schedule.slotSummary.available} open`;
    if (schedule.slotSummary.booked > 0) return `${schedule.slotSummary.booked} booked`;
    return schedule.overrideReason || "Unavailable";
  }, [schedule]);

  async function handleTemplateSave() {
    setSavingTemplate(true);
    const nextRules = Object.fromEntries(
      Object.entries(weeklyRules).map(([key, rule]) => {
        const normalized = fromBreakFields(rule);
        delete normalized.breakStart;
        delete normalized.breakEnd;
        return [key, normalized];
      })
    );
    await onSaveTemplate({
      weeklyRules: nextRules,
      slotDurationMinutes: Number(slotDurationMinutes)
    });
    setSavingTemplate(false);
  }

  async function handleOverrideSave() {
    setSavingOverride(true);
    await onSaveOverride({
      date: selectedDate,
      mode: overrideMode,
      closedReason,
      customRule:
        overrideMode === "custom" || overrideMode === "open"
          ? {
              enabled: true,
              startTime: customStart,
              endTime: customEnd,
              breaks:
                customBreakStart && customBreakEnd
                  ? [{ startTime: customBreakStart, endTime: customBreakEnd }]
                  : []
            }
          : null
    });
    setSavingOverride(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader eyebrow="Weekly template" title={title} description={description} />
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[180px_1fr]">
            <Field label="Slot duration">
              <Select value={slotDurationMinutes} onChange={(event) => setSlotDurationMinutes(event.target.value)}>
                <option value="15">15 minutes</option>
                <option value="20">20 minutes</option>
                <option value="30">30 minutes</option>
              </Select>
            </Field>
            <div className="rounded-[24px] border border-line bg-surface-2 p-4 text-sm text-muted">
              Update the weekly working template here. Booked appointments stay preserved even if future unbooked slots regenerate.
            </div>
          </div>
          <div className="space-y-3">
            {weekdays.map(([key, label]) => (
              <div key={key} className="grid gap-3 rounded-[22px] border border-line bg-surface-2 p-4 md:grid-cols-[90px_110px_1fr_1fr_1fr_1fr] md:items-center">
                <div className="text-sm font-semibold text-ink">{label}</div>
                <Select
                  value={weeklyRules[key].enabled ? "open" : "closed"}
                  onChange={(event) =>
                    setWeeklyRules((current) => ({
                      ...current,
                      [key]: {
                        ...current[key],
                        enabled: event.target.value === "open"
                      }
                    }))
                  }
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </Select>
                <Input
                  type="time"
                  value={weeklyRules[key].startTime}
                  disabled={!weeklyRules[key].enabled}
                  onChange={(event) =>
                    setWeeklyRules((current) => ({
                      ...current,
                      [key]: { ...current[key], startTime: event.target.value }
                    }))
                  }
                />
                <Input
                  type="time"
                  value={weeklyRules[key].endTime}
                  disabled={!weeklyRules[key].enabled}
                  onChange={(event) =>
                    setWeeklyRules((current) => ({
                      ...current,
                      [key]: { ...current[key], endTime: event.target.value }
                    }))
                  }
                />
                <Input
                  type="time"
                  value={weeklyRules[key].breakStart}
                  disabled={!weeklyRules[key].enabled}
                  onChange={(event) =>
                    setWeeklyRules((current) => ({
                      ...current,
                      [key]: { ...current[key], breakStart: event.target.value }
                    }))
                  }
                />
                <Input
                  type="time"
                  value={weeklyRules[key].breakEnd}
                  disabled={!weeklyRules[key].enabled}
                  onChange={(event) =>
                    setWeeklyRules((current) => ({
                      ...current,
                      [key]: { ...current[key], breakEnd: event.target.value }
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <Button onClick={handleTemplateSave} disabled={savingTemplate}>
            {savingTemplate ? "Saving template..." : "Save weekly template"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          eyebrow="Date override"
          title={`Override for ${formatDate(`${selectedDate}T00:00:00+05:30`)}`}
          description="Open, close, or customize a specific day. Slot-level changes appear below for the selected date."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Selected date">
            <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </Field>
          <Field label="Mode">
            <Select value={overrideMode} onChange={(event) => setOverrideMode(event.target.value)}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="custom">Custom</option>
            </Select>
          </Field>
          <Field label="Closed reason">
            <Input value={closedReason} onChange={(event) => setClosedReason(event.target.value)} />
          </Field>
          <div className="rounded-[24px] border border-line bg-surface-2 p-4 text-sm text-muted">
            {scheduleLabel}
          </div>
          {overrideMode !== "closed" ? (
            <>
              <Field label="Custom start">
                <Input type="time" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              </Field>
              <Field label="Custom end">
                <Input type="time" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
              </Field>
              <Field label="Break start">
                <Input
                  type="time"
                  value={customBreakStart}
                  onChange={(event) => setCustomBreakStart(event.target.value)}
                />
              </Field>
              <Field label="Break end">
                <Input type="time" value={customBreakEnd} onChange={(event) => setCustomBreakEnd(event.target.value)} />
              </Field>
            </>
          ) : null}
        </div>
        <div className="mt-4">
          <Button onClick={handleOverrideSave} disabled={savingOverride}>
            {savingOverride ? "Saving override..." : "Save date override"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          eyebrow="Slot controls"
          title={`Slots for ${formatDate(`${selectedDate}T00:00:00+05:30`)}`}
          description="Booked slots are preserved. Future unbooked slots can be opened or blocked individually."
        />
        {schedule?.slots?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {schedule.slots.map((slot) => (
              <div key={slot.id} className="rounded-[22px] border border-line bg-surface-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-ink">
                    {formatTime(slot.startAt)} - {formatTime(slot.endAt)}
                  </div>
                  <span
                    className={`pill ${
                      slot.status === "available"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : slot.status === "booked"
                          ? "border-cyan-200 bg-cyan-50 text-cyan-900"
                          : "border-amber-200 bg-amber-50 text-amber-900"
                    }`}
                  >
                    {slot.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {slot.status !== "booked" ? (
                    <Button
                      size="sm"
                      variant={slot.status === "available" ? "secondary" : "primary"}
                      onClick={() =>
                        onToggleSlot(
                          doctor.id,
                          selectedDate,
                          slot.id,
                          slot.status === "available" ? "unavailable" : "available"
                        )
                      }
                    >
                      {slot.status === "available" ? "Block slot" : "Open slot"}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-line bg-surface-2 p-6 text-sm text-muted">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-brand-tide" />
              No slots exist for this day yet. Save an open or custom override to generate them.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
