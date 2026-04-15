import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  HeartPulse,
  Search,
  Stethoscope,
  UserCircle2
} from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { StatCard } from "../../components/ui/StatCard";
import { useDemoData } from "../../app/DemoDataProvider";
import { getCurrentProfile } from "../../features/shared/selectors";
import { formatDate, formatTime } from "../../lib/format";
import { cn } from "../../lib/utils";
import { listCollection } from "../../services/stateHelpers";

const SECTION_LINKS = [
  { id: "bookings", label: "Bookings" },
  { id: "vitals", label: "Vitals" }
];

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "captured", label: "Captured" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" }
];

const BOOKING_LIST_HEIGHT_PX = 620;
const BOOKING_ROW_HEIGHT_PX = 158;
const BOOKING_OVERSCAN_ROWS = 4;

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

function hasVitals(vitals = {}) {
  return Boolean(vitals.bloodPressure || vitals.pulse || vitals.temperature || vitals.spo2 || vitals.painScore);
}

function getClinicDayStartMs(dayKey) {
  const parsed = new Date(`${dayKey || "1970-01-01"}T00:00:00+05:30`).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function getBookingStatusLabel(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "scheduled") return "Booked";
  if (normalized === "checked_in") return "Checked-in";
  if (normalized === "rescheduled") return "Rescheduled";
  if (normalized === "completed") return "Completed";
  if (normalized === "cancelled") return "Cancelled";
  return "Active";
}

function getEncounterStatusLabel(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "awaiting_interview") return "Awaiting intake";
  if (normalized === "ai_ready") return "Vitals ready";
  if (normalized === "in_consult") return "In consult";
  if (normalized === "approved") return "Approved";
  return "Pending";
}

function isCancelledCase(bookingStatus) {
  return String(bookingStatus || "").toLowerCase() === "cancelled";
}

function isCompletedCase(bookingStatus, encounterStatus) {
  return (
    String(bookingStatus || "").toLowerCase() === "completed" ||
    String(encounterStatus || "").toLowerCase() === "approved"
  );
}

function isPendingVitalsCase({ isCancelled, isCompleted, vitalsCaptured, encounterStatus }) {
  if (isCancelled || isCompleted) {
    return false;
  }

  return !vitalsCaptured || String(encounterStatus || "").toLowerCase() === "awaiting_interview";
}

function isCapturedVitalsCase({ isCancelled, isCompleted, vitalsCaptured }) {
  return !isCancelled && !isCompleted && vitalsCaptured;
}

function matchesStatusFilter(item, statusFilter) {
  if (statusFilter === "pending") return item.needsVitals;
  if (statusFilter === "captured") return item.capturedVitals;
  if (statusFilter === "completed") return item.isCompleted;
  if (statusFilter === "cancelled") return item.isCancelled;
  return true;
}

function getVitalsProgressMeta(item) {
  if (item.isCancelled) {
    return { tone: "neutral", label: "Cancelled" };
  }

  if (item.isCompleted) {
    return { tone: "info", label: "Completed" };
  }

  if (item.needsVitals) {
    return { tone: "warning", label: "Awaiting vitals" };
  }

  if (item.vitalsCaptured) {
    return { tone: "success", label: "Vitals saved" };
  }

  return { tone: "neutral", label: "No vitals" };
}

function formatDayKeyLabel(dayKey) {
  if (!dayKey) {
    return "Unknown date";
  }

  return formatDate(`${dayKey}T00:00:00+05:30`);
}

export function NurseDashboardPage() {
  const { state, actions } = useDemoData();
  const nurse = getCurrentProfile(state);
  const todayStartMs = useMemo(() => getClinicDayStartMs(state?.meta?.today), [state?.meta?.today]);

  const bookingCases = useMemo(() => {
    if (!state) {
      return [];
    }

    const mapped = listCollection(state.appointments)
      .map((appointment) => {
        const startAtMs = new Date(appointment.startAt || "").getTime();
        if (!Number.isFinite(startAtMs)) {
          return null;
        }

        const patient = state.patients.byId[appointment.patientId] || null;
        const doctor = state.doctors.byId[appointment.doctorId] || null;
        const encounter = state.encounters.byId[`encounter-${appointment.id}`] || null;
        const emrSync = state.emrSync?.byId?.[`emr-${appointment.id}`] || null;
        const vitals = encounter?.apciDraft?.vitals || {};
        const bp = parseBloodPressure(vitals.bloodPressure);
        const highBp = (bp.systolic || 0) >= 160 || (bp.diastolic || 0) >= 100;
        const vitalsCaptured = hasVitals(vitals);
        const isCancelled = isCancelledCase(appointment.bookingStatus);
        const isCompleted = isCompletedCase(appointment.bookingStatus, encounter?.status);
        const needsVitals = isPendingVitalsCase({
          isCancelled,
          isCompleted,
          vitalsCaptured,
          encounterStatus: encounter?.status
        });
        const capturedVitals = isCapturedVitalsCase({
          isCancelled,
          isCompleted,
          vitalsCaptured
        });

        return {
          ...appointment,
          startAtMs,
          dayKey: String(appointment.startAt || "").slice(0, 10),
          patient,
          doctor,
          encounter,
          emrSync,
          vitals,
          bp,
          highBp,
          vitalsCaptured,
          needsVitals,
          capturedVitals,
          isCancelled,
          isCompleted,
          bookingStatusLabel: getBookingStatusLabel(appointment.bookingStatus),
          encounterStatusLabel: getEncounterStatusLabel(encounter?.status)
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        const priority = (item) => {
          if (item.needsVitals) return 0;
          if (item.capturedVitals) return 1;
          if (item.isCompleted) return 2;
          if (item.isCancelled) return 3;
          return 4;
        };

        const leftPriority = priority(left);
        const rightPriority = priority(right);
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        return left.startAtMs - right.startAtMs;
      });

    return mapped;
  }, [state, todayStartMs]);

  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(() => state?.meta?.today || "all");
  const [calendarDate, setCalendarDate] = useState(() => state?.meta?.today || "");
  const [statusBanner, setStatusBanner] = useState("Ready to capture vitals.");
  const [submitting, setSubmitting] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({
    bloodPressure: "",
    pulse: "",
    temperature: "",
    spo2: "",
    painScore: "3"
  });

  const listViewportRef = useRef(null);
  const [listScrollTop, setListScrollTop] = useState(0);

  useEffect(() => {
    if (!calendarDate && state?.meta?.today) {
      setCalendarDate(state.meta.today);
    }

    if (!dateFilter && state?.meta?.today) {
      setDateFilter(state.meta.today);
    }
  }, [calendarDate, dateFilter, state?.meta?.today]);

  const availableDateOptions = useMemo(() => {
    const unique = new Set(bookingCases.map((item) => item.dayKey).filter(Boolean));
    return Array.from(unique).sort((left, right) => new Date(right).getTime() - new Date(left).getTime());
  }, [bookingCases]);

  const dateScopedCases = useMemo(() => {
    if (dateFilter === "all") {
      return bookingCases;
    }

    return bookingCases.filter((item) => item.dayKey === dateFilter);
  }, [bookingCases, dateFilter]);

  const searchedCases = useMemo(() => {
    const needle = searchValue.trim().toLowerCase();
    if (!needle) {
      return dateScopedCases;
    }

    return dateScopedCases.filter((item) => {
      const haystacks = [
        item.patient?.fullName,
        item.patient?.id,
        item.doctor?.fullName,
        item.token,
        item.id
      ]
        .filter(Boolean)
        .map((entry) => String(entry).toLowerCase());

      return haystacks.some((entry) => entry.includes(needle));
    });
  }, [dateScopedCases, searchValue]);

  const statusCounts = useMemo(() => {
    const counts = {
      all: searchedCases.length,
      pending: searchedCases.filter((item) => item.needsVitals).length,
      captured: searchedCases.filter((item) => item.capturedVitals).length,
      completed: searchedCases.filter((item) => item.isCompleted).length,
      cancelled: searchedCases.filter((item) => item.isCancelled).length
    };

    return counts;
  }, [searchedCases]);

  const filteredCases = useMemo(() => {
    return searchedCases.filter((item) => matchesStatusFilter(item, statusFilter));
  }, [searchedCases, statusFilter]);

  useEffect(() => {
    if (!bookingCases.length) {
      if (selectedAppointmentId) {
        setSelectedAppointmentId("");
      }
      return;
    }

    if (bookingCases.some((item) => item.id === selectedAppointmentId)) {
      return;
    }

    setSelectedAppointmentId(bookingCases[0].id);
  }, [bookingCases, selectedAppointmentId]);

  useEffect(() => {
    if (!filteredCases.length) {
      return;
    }

    if (filteredCases.some((item) => item.id === selectedAppointmentId)) {
      return;
    }

    setSelectedAppointmentId(filteredCases[0].id);
  }, [filteredCases, selectedAppointmentId]);

  useEffect(() => {
    if (!listViewportRef.current) {
      return;
    }

    listViewportRef.current.scrollTop = 0;
    setListScrollTop(0);
  }, [searchValue, statusFilter, dateFilter]);

  const selectedCase = useMemo(
    () =>
      filteredCases.find((item) => item.id === selectedAppointmentId) ||
      bookingCases.find((item) => item.id === selectedAppointmentId) ||
      filteredCases[0] ||
      bookingCases[0] ||
      null,
    [bookingCases, filteredCases, selectedAppointmentId]
  );

  useEffect(() => {
    if (!selectedCase) {
      setVitalsForm({ bloodPressure: "", pulse: "", temperature: "", spo2: "", painScore: "3" });
      return;
    }

    setVitalsForm({
      bloodPressure: String(selectedCase.vitals?.bloodPressure || ""),
      pulse: String(selectedCase.vitals?.pulse || ""),
      temperature: String(selectedCase.vitals?.temperature || ""),
      spo2: String(selectedCase.vitals?.spo2 || ""),
      painScore: String(selectedCase.vitals?.painScore || "3")
    });
  }, [
    selectedCase?.id,
    selectedCase?.vitals?.bloodPressure,
    selectedCase?.vitals?.pulse,
    selectedCase?.vitals?.temperature,
    selectedCase?.vitals?.spo2,
    selectedCase?.vitals?.painScore
  ]);

  const stats = useMemo(() => {
    const activeCases = bookingCases.filter((item) => !item.isCancelled);
    const total = activeCases.length;
    const awaitingVitals = activeCases.filter((item) => item.needsVitals).length;
    const vitalsCaptured = activeCases.filter((item) => item.vitalsCaptured).length;
    const highBp = activeCases.filter((item) => item.highBp).length;

    return {
      total,
      awaitingVitals,
      vitalsCaptured,
      highBp
    };
  }, [bookingCases]);

  const canEditVitals = Boolean(selectedCase && !selectedCase.isCancelled && !selectedCase.isCompleted);
  const selectedProgress = selectedCase ? getVitalsProgressMeta(selectedCase) : null;

  const totalVirtualHeight = filteredCases.length * BOOKING_ROW_HEIGHT_PX;
  const visibleStartIndex = Math.max(
    0,
    Math.floor(listScrollTop / BOOKING_ROW_HEIGHT_PX) - BOOKING_OVERSCAN_ROWS
  );
  const visibleEndIndex = Math.min(
    filteredCases.length,
    Math.ceil((listScrollTop + BOOKING_LIST_HEIGHT_PX) / BOOKING_ROW_HEIGHT_PX) + BOOKING_OVERSCAN_ROWS
  );

  const virtualRows = useMemo(
    () =>
      filteredCases
        .slice(visibleStartIndex, visibleEndIndex)
        .map((item, offset) => ({
          item,
          index: visibleStartIndex + offset
        })),
    [filteredCases, visibleStartIndex, visibleEndIndex]
  );

  const topActions = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-2 rounded-full border border-line/50 bg-white/70 px-3 py-2 text-xs font-semibold text-muted">
        <CalendarClock className="h-4 w-4 text-brand-tide" />
        Active bookings: {stats.total}
      </div>
      <div className="inline-flex items-center gap-2 rounded-full border border-line/50 bg-white/70 px-3 py-2 text-xs font-semibold text-muted">
        <HeartPulse className="h-4 w-4 text-brand-sky" />
        Awaiting vitals: {stats.awaitingVitals}
      </div>
      <div className="inline-flex items-center gap-2 rounded-full border border-line/50 bg-white/70 px-3 py-2 text-xs font-semibold text-muted">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        Captured: {stats.vitalsCaptured}
      </div>
    </div>
  );

  async function handleSaveVitals() {
    if (!selectedCase) {
      setStatusBanner("Select a booked patient before saving vitals.");
      return;
    }

    if (!canEditVitals) {
      if (selectedCase.isCancelled) {
        setStatusBanner("Cancelled appointment is read-only.");
        return;
      }

      if (selectedCase.isCompleted) {
        setStatusBanner("Completed appointment is locked for vitals editing.");
        return;
      }
    }

    setSubmitting(true);

    try {
      await actions.nurse.saveVitals(selectedCase.id, vitalsForm);
      setStatusBanner(`Vitals saved for ${selectedCase.patient?.fullName || "patient"} and synced to the EMR draft.`);
    } catch (error) {
      setStatusBanner(`Vitals save failed: ${String(error?.message || error)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Nurse command center"
      subtitle="Booked patients appear here automatically. Select a patient, enter vitals, and save to update EMR instantly."
      languageLabel="Nurse UI in English"
      actions={topActions}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {SECTION_LINKS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="inline-flex items-center rounded-full border border-line/50 bg-white/70 px-4 py-2 text-sm font-semibold text-muted transition hover:border-brand-tide/30 hover:text-ink"
            >
              {section.label}
            </a>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active bookings" value={String(stats.total)} tone="soft" href="#bookings" />
          <StatCard label="Awaiting vitals" value={String(stats.awaitingVitals)} tone="accent" href="#vitals" />
          <StatCard label="Vitals captured" value={String(stats.vitalsCaptured)} href="#vitals" />
          <StatCard label="High BP alerts" value={String(stats.highBp)} tone={stats.highBp ? "accent" : "soft"} href="#vitals" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card id="bookings">
            <CardHeader
              eyebrow="Incoming bookings"
              title="Patients booked from portal"
              description="Every new appointment booking is visible here for nursing intake and vitals capture."
            />

            <div className="space-y-4">
              <div className="rounded-2xl border border-line/50 bg-white/70 p-3">
                <label htmlFor="nurse-booking-search" className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
                  Search booking
                </label>
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-line/50 bg-white px-3">
                  <Search className="h-4 w-4 text-muted" />
                  <input
                    id="nurse-booking-search"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Patient ID, token, doctor, or name"
                    className="h-10 w-full bg-transparent text-sm outline-none"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-line/50 bg-white/70 p-3">
                <div className="grid gap-3 lg:grid-cols-[auto_auto_1fr] lg:items-end">
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Date scope</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setDateFilter("all")}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          dateFilter === "all"
                            ? "border-brand-sky bg-brand-mint text-ink"
                            : "border-line bg-white text-muted hover:bg-surface-2"
                        )}
                      >
                        All dates
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (state?.meta?.today) {
                            setCalendarDate(state.meta.today);
                            setDateFilter(state.meta.today);
                          }
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          dateFilter !== "all" && dateFilter === state?.meta?.today
                            ? "border-brand-sky bg-brand-mint text-ink"
                            : "border-line bg-white text-muted hover:bg-surface-2"
                        )}
                      >
                        Today
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="nurse-date-filter" className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
                      Calendar day
                    </label>
                    <input
                      id="nurse-date-filter"
                      type="date"
                      value={calendarDate}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCalendarDate(value);
                        setDateFilter(value || "all");
                      }}
                      className="h-10 rounded-xl border border-line/50 bg-white px-3 text-sm text-ink outline-none focus:border-brand-tide/40"
                    />
                  </div>

                  <div className="rounded-xl border border-dashed border-line/60 bg-surface-2 px-3 py-2 text-xs text-muted">
                    {dateFilter === "all"
                      ? `Showing all dates (${availableDateOptions.length} date buckets).`
                      : `Showing ${formatDayKeyLabel(dateFilter)}.`}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Filter by status</div>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_FILTERS.map((filter) => (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setStatusFilter(filter.key)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          statusFilter === filter.key
                            ? "border-brand-sky bg-brand-mint text-ink"
                            : "border-line bg-white text-muted hover:bg-surface-2"
                        )}
                      >
                        {filter.label} ({statusCounts[filter.key] || 0})
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {!filteredCases.length ? (
                <div className="rounded-2xl border border-dashed border-line/60 bg-surface-2 p-5 text-sm text-muted">
                  No bookings match current date, status, and search filters.
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-line/40 bg-surface-2 p-2">
                    <div
                      ref={listViewportRef}
                      onScroll={(event) => setListScrollTop(event.currentTarget.scrollTop)}
                      className="overflow-y-auto"
                      style={{ height: `${BOOKING_LIST_HEIGHT_PX}px` }}
                    >
                      <div className="relative" style={{ height: `${totalVirtualHeight}px` }}>
                        {virtualRows.map(({ item, index }) => {
                          const progress = getVitalsProgressMeta(item);

                          return (
                            <div
                              key={item.id}
                              style={{
                                position: "absolute",
                                left: 0,
                                right: 0,
                                top: `${index * BOOKING_ROW_HEIGHT_PX}px`,
                                height: `${BOOKING_ROW_HEIGHT_PX}px`,
                                padding: "4px"
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAppointmentId(item.id);
                                  setStatusBanner(`Loaded ${item.patient?.fullName || "patient"} from booking list.`);
                                }}
                                className={cn(
                                  "h-full w-full rounded-[22px] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md",
                                  selectedCase?.id === item.id
                                    ? "border-brand-tide bg-brand-mint/30"
                                    : "border-line/50 bg-white/70"
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="truncate text-base font-semibold text-ink">
                                        {item.patient?.fullName || "Unknown patient"}
                                      </div>
                                      <Badge tone={progress.tone}>{progress.label}</Badge>
                                    </div>
                                    <div className="mt-1 text-sm text-muted">
                                      {formatDate(item.startAt)} at {formatTime(item.startAt)} - Token {item.token}
                                    </div>
                                    <div className="mt-1 text-sm text-muted">
                                      Doctor: {item.doctor?.fullName || "Unassigned"} - {item.doctor?.specialty || "General"}
                                    </div>
                                    <div className="mt-1 text-xs text-muted">
                                      Patient ID: {item.patient?.id || "N/A"} - Appointment ID: {item.id}
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    <Badge tone={item.isCancelled ? "neutral" : "info"}>{item.bookingStatusLabel}</Badge>
                                    <Badge tone="neutral">{item.encounterStatusLabel}</Badge>
                                  </div>
                                </div>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-muted">
                    Virtualized list enabled. Showing {filteredCases.length} result(s).
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card id="vitals" className="xl:sticky xl:top-24 xl:self-start">
            <CardHeader
              eyebrow="Vitals capture"
              title="Enter and save to EMR"
              description="Select a booked patient, enter vitals, and save to update the EMR draft instantly."
            />

            {!selectedCase ? (
              <div className="rounded-2xl border border-dashed border-line/60 bg-surface-2 p-5 text-sm text-muted">
                No active booking available. Once a patient books a slot, details appear here.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-[22px] border border-line/50 bg-white/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="rounded-xl bg-brand-midnight/90 p-2 text-white">
                        <UserCircle2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-ink">
                          {selectedCase.patient?.fullName || "Unknown patient"}
                        </div>
                        <div className="mt-1 text-sm text-muted">
                          Token {selectedCase.token} - {formatDate(selectedCase.startAt)} at {formatTime(selectedCase.startAt)}
                        </div>
                        <div className="mt-1 text-sm text-muted">
                          Doctor: {selectedCase.doctor?.fullName || "Unassigned"} - {selectedCase.doctor?.specialty || "General"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge tone={selectedCase.emrSync?.patientId || selectedCase.emrSync?.encounterId ? "info" : "neutral"}>
                        {selectedCase.emrSync?.patientId || selectedCase.emrSync?.encounterId ? "EMR linked" : "Local draft"}
                      </Badge>
                      {selectedProgress ? <Badge tone={selectedProgress.tone}>{selectedProgress.label}</Badge> : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    { key: "bloodPressure", label: "BP", placeholder: "140/90" },
                    { key: "pulse", label: "Pulse", placeholder: "88" },
                    { key: "temperature", label: "Temp", placeholder: "98.6" },
                    { key: "spo2", label: "SpO2", placeholder: "98" },
                    { key: "painScore", label: "Pain", placeholder: "3" }
                  ].map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-[0.2em] text-muted">{field.label}</label>
                      <input
                        value={vitalsForm[field.key] ?? ""}
                        onChange={(event) => setVitalsForm((current) => ({ ...current, [field.key]: event.target.value }))}
                        placeholder={field.placeholder}
                        disabled={!canEditVitals || submitting}
                        className={cn(
                          "h-11 w-full rounded-xl border border-line/50 bg-white/80 px-4 text-sm outline-none focus:border-brand-tide/40",
                          (!canEditVitals || submitting) && "cursor-not-allowed opacity-70"
                        )}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={handleSaveVitals} disabled={!canEditVitals || submitting}>
                    <Stethoscope className="h-4 w-4" />
                    {submitting ? "Saving vitals..." : "Save vitals"}
                  </Button>
                  <span className="text-sm text-muted">{statusBanner}</span>
                </div>

                <div className="rounded-[22px] border border-line/50 bg-surface-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-ink">EMR draft preview</div>
                    <Badge tone="info">Live after save</Badge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: "BP", value: selectedCase.vitals?.bloodPressure || "Pending" },
                      { label: "Pulse", value: selectedCase.vitals?.pulse || "Pending" },
                      { label: "Temp", value: selectedCase.vitals?.temperature || "Pending" },
                      { label: "SpO2", value: selectedCase.vitals?.spo2 || "Pending" }
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-line/50 bg-white/70 p-3">
                        <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted">{item.label}</div>
                        <div className="mt-1 text-sm font-semibold text-ink">{item.value}</div>
                      </div>
                    ))}
                  </div>

                  <div
                    className={cn(
                      "mt-3 rounded-xl border px-3 py-2 text-sm",
                      selectedCase.highBp ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
                    )}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="h-4 w-4" />
                      {selectedCase.highBp ? "High BP alert" : "No critical BP flag"}
                    </div>
                    <div className="mt-1 text-xs">
                      {selectedCase.highBp
                        ? "Systolic/diastolic is in escalation range. Notify doctor after confirming reading."
                        : "Latest saved values are within routine nursing watch range."}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader
            eyebrow="Workflow note"
            title="How this nurse screen now works"
            description="No ward-board complexity: bookings come in, nurse captures vitals, and EMR draft updates immediately."
          />
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-line/50 bg-surface-2 p-4 text-sm text-muted">
              <div className="font-semibold text-ink">1. Booking arrives</div>
              <div className="mt-1">Bookings are visible in a virtualized list, filtered by date and status.</div>
            </div>
            <div className="rounded-2xl border border-line/50 bg-surface-2 p-4 text-sm text-muted">
              <div className="font-semibold text-ink">2. Nurse enters vitals</div>
              <div className="mt-1">Select patient, enter BP/pulse/temp/SpO2/pain, and tap save.</div>
            </div>
            <div className="rounded-2xl border border-line/50 bg-surface-2 p-4 text-sm text-muted">
              <div className="font-semibold text-ink">3. EMR is updated</div>
              <div className="mt-1">Saved values update encounter vitals in the shared EMR draft used by doctor and patient views.</div>
            </div>
          </div>
          <div className="mt-4 text-sm text-muted">Signed in as {nurse?.fullName || "Nurse"}.</div>
        </Card>
      </div>
    </AppShell>
  );
}
