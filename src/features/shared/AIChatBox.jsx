import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Bot, CalendarClock, CalendarDays, CheckCircle2, MessageCircle, Mic, Send, Sparkles, User, Volume2, X } from "lucide-react";
import { useDemoData } from "../../app/DemoDataProvider";
import { formatDate, formatTime } from "../../lib/format";
import { cn } from "../../lib/utils";
import {
  chatWithContextGunaEmr,
  fetchSymptomChatMemory,
  submitSymptomChatToEmr,
  generateDynamicPrecheckQuestions,
} from "../../services/gunaEmrBridge";
import { getBookableDoctors, getDoctorSchedules, getPatientWorkspace, getScheduleByDate } from "./selectors";
import { useRealtimeTable } from "../../hooks/useSupabaseRealtime";

const BOOKING_INTENT_REGEX = /\b(book|schedule|appointment|slot|doctor visit|consult)\b/i;
const LOGIN_HELP_INTENT_REGEX = /\b(login|log in|signin|sign in|signup|sign up|register|account|password)\b/i;
const CONTACT_HELP_INTENT_REGEX = /\b(contact|support|helpdesk|helpline|call|email|reach)\b/i;
const PRECHECK_INTENT_REGEX = /\b(pre[\s-]?check|questionnaire|doctor questions|questions from doctor)\b/i;
const EMERGENCY_INTENT_REGEX = /\b(chest pain|shortness of breath|can't breathe|unable to breathe|stroke|face droop|slurred speech|severe bleeding|faint|unconscious)\b/i;
const SYMPTOM_SIGNAL_REGEX = /\b(fever|cough|cold|pain|ache|headache|migraine|vomit|vomiting|nausea|diarrhea|diarrhoea|constipation|bloating|gas|acidity|acid reflux|heartburn|breath|breathless|rash|dizzy|dizziness|fatigue|weakness|stomach|abdomen|abdominal|chest|bp|pressure|sore throat|infection|burning urine|urinary|urine|back pain|joint pain|allergy|itching)\b/i;
const NON_CLINICAL_CHAT_REGEX = /^\s*(hi|hello|hey|ok|okay|thanks|thank you|help)\s*[.!?]*\s*$/i;

const BOOKING_STEPS = [
  { key: "symptoms", label: "Symptoms", description: "Tell me what's bothering you." },
  { key: "doctor", label: "Doctor", description: "Choose the best matching doctor." },
  { key: "slot", label: "Slot", description: "Pick an available time." },
  { key: "confirm", label: "Confirm", description: "Review and book." },
];

const SYMPTOM_EXAMPLE_PROMPTS = [
  "Main symptom + duration (e.g., constipation for 2 days)",
  "Severity + what worsens/relieves it",
  "Any related symptoms (fever, nausea, dizziness, etc.)",
];

export function AIChatBox() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, session, actions } = useDemoData();
  const { patient, pendingPrecheckQuestionnaire, nextAppointment: wsNextAppointment } = getPatientWorkspace(state || {});
  const language = "en";
  const isAuthenticated = !!session?.isAuthenticated;
  const role = session?.role || null;
  const patientMode = isAuthenticated && role === "patient";
  const guestMode = !isAuthenticated;
  const hiddenByRole = ["doctor", "admin", "nurse"].includes(role || "");
  const hiddenByPath = ["/doctor", "/admin", "/nurse"].some((prefix) => location.pathname.startsWith(prefix));
  const avoidsPatientFloatingBook = location.pathname.startsWith("/patient/appointments");
  const shouldHideChat = hiddenByRole || hiddenByPath || (!guestMode && !patientMode);
  const initialMessage = useMemo(
    () => ({
      role: "ai",
      text: guestMode
        ? "Hi! I can help with login and contact support. Please tell me whether you need help signing in, creating an account, or contacting us."
        : "Hi! I'm NIRA AI. First share your symptoms or reason for visit. Then I'll show doctors, available slots, and only book after you confirm.",
      time: new Date(),
    }),
    [guestMode]
  );
  const contextKey = `${session?.role || "unknown"}:${session?.userId || "anonymous"}`;
  const bookableDoctors = useMemo(() => getBookableDoctors(state || {}), [state]);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([initialMessage]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [intakeSubmitted, setIntakeSubmitted] = useState(false);
  const [chatEntryMode, setChatEntryMode] = useState("booking");
  const [precheckFlow, setPrecheckFlow] = useState({
    active: false,
    phase: null,
    appointmentId: null,
    questionnaireId: null,
    appointmentContext: null,
    seedAnswers: { reason: "", duration: "" },
    dynamicQuestions: [],
    currentDynamicIndex: 0,
    responses: {},
    completed: false,
    submitting: false,
  });
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const [bookingFlow, setBookingFlow] = useState({
    stage: "symptoms",
    symptoms: "",
    doctorId: "",
    slotDate: "",
    slotId: "",
  });
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const { data: realtimeEvents } = useRealtimeTable("chat_events", {
    column: "context_key",
    value: contextKey,
  });

  const rankedDoctors = useMemo(
    () => rankDoctorsForSymptoms(bookableDoctors, bookingFlow.symptoms || input || ""),
    [bookableDoctors, bookingFlow.symptoms, input]
  );
  const selectedDoctor = bookableDoctors.find((doctor) => doctor.id === bookingFlow.doctorId) || null;
  const selectedDoctorSchedules = useMemo(
    () => (selectedDoctor ? getDoctorSchedules(state || {}, selectedDoctor.id, 14) : []),
    [state, selectedDoctor?.id]
  );
  const selectedDate = bookingFlow.slotDate || selectedDoctorSchedules.find((schedule) => schedule.slotSummary.available > 0)?.date || state?.meta?.today || "";
  const selectedSchedule = selectedDoctor ? getScheduleByDate(state || {}, selectedDoctor.id, selectedDate) : null;
  const availableDates = selectedDoctorSchedules.filter((schedule) => schedule.slotSummary.available > 0);
  const availableSlots = (selectedSchedule?.slots || []).filter((slot) => slot.status === "available");
  const bookingStageIndex = BOOKING_STEPS.findIndex((step) => step.key === bookingFlow.stage);
  const currentBookingStep = bookingStageIndex >= 0 ? BOOKING_STEPS[bookingStageIndex] : BOOKING_STEPS[0];
  const activePrecheckQuestion = precheckFlow.phase === "dynamic"
    ? precheckFlow.dynamicQuestions[precheckFlow.currentDynamicIndex] || null
    : null;

  useEffect(() => {
    setMessages([initialMessage]);
    setInput("");
    setOpen(false);
    setTyping(false);
    setIntakeSubmitted(false);
    setBookingFlow({
      stage: "symptoms",
      symptoms: "",
      doctorId: "",
      slotDate: "",
      slotId: "",
    });
    setChatEntryMode("booking");
    setPrecheckFlow({
      active: false,
      phase: null,
      appointmentId: null,
      questionnaireId: null,
      appointmentContext: null,
      seedAnswers: { reason: "", duration: "" },
      dynamicQuestions: [],
      currentDynamicIndex: 0,
      responses: {},
      completed: false,
      submitting: false,
    });
  }, [initialMessage]);

  function startPrecheckFlow(context = {}) {
    const doctorName = context.doctorName || wsNextAppointment?.doctor?.fullName || "your doctor";
    const specialty = context.specialty || wsNextAppointment?.doctor?.specialty || "General Practice";
    const appointmentId = context.appointmentId || wsNextAppointment?.id || pendingPrecheckQuestionnaire?.appointmentId;
    const startAt = context.startAt || wsNextAppointment?.startAt;

    setMessages([]);
    setChatEntryMode("precheck");
    setBookingFlow({ stage: "symptoms", symptoms: "", doctorId: "", slotDate: "", slotId: "" });
    setIntakeSubmitted(false);

    const apptCtx = {
      appointmentId,
      doctorName,
      specialty,
      startAt,
      patientId: patient?.id,
      encounterId: appointmentId ? `encounter-${appointmentId}` : null,
    };

    setPrecheckFlow({
      active: true,
      phase: "seed_reason",
      appointmentId,
      questionnaireId: pendingPrecheckQuestionnaire?.id || null,
      appointmentContext: apptCtx,
      seedAnswers: { reason: "", duration: "" },
      dynamicQuestions: [],
      currentDynamicIndex: 0,
      responses: {},
      completed: false,
      submitting: false,
    });

    const timeStr = startAt ? ` on ${formatDate(startAt)} at ${formatTime(startAt)}` : "";

    setMessages([
      {
        role: "ai",
        text: `Welcome to your Pre-Appointment Check!\n\nThis quick questionnaire helps ${doctorName} (${specialty}) understand your condition before your visit${timeStr}. Your answers are shared securely with your care team.\n\nI'll ask about 6 tailored questions \u2014 let's begin.`,
        time: new Date(),
        meta: "precheck-intro",
      },
      {
        role: "ai",
        text: "Q1/6: What health problem or concern brings you to this visit? Please describe what you're experiencing.",
        time: new Date(),
        meta: "precheck-q1",
      },
    ]);
  }

  async function processPrecheckAnswer(answerText, existingUserMessage = null) {
    const trimmed = String(answerText || "").trim();
    if (!trimmed) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Please share your answer to continue.", time: new Date() },
      ]);
      return;
    }

    const userMessage = existingUserMessage || { role: "user", text: trimmed, time: new Date() };
    if (!existingUserMessage) {
      setMessages((prev) => [...prev, userMessage]);
    }

    const { phase, dynamicQuestions, currentDynamicIndex, seedAnswers, appointmentContext } = precheckFlow;

    if (phase === "seed_reason") {
      const updatedSeed = { ...seedAnswers, reason: trimmed };
      setPrecheckFlow((curr) => ({
        ...curr,
        phase: "seed_duration",
        seedAnswers: updatedSeed,
        responses: { ...curr.responses, "precheck-reason": trimmed },
      }));
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Q2/6: How long have you been experiencing this? (e.g., 2 days, 1 week, since last month)",
          time: new Date(),
        },
      ]);
      return;
    }

    if (phase === "seed_duration") {
      const updatedSeed = { ...seedAnswers, duration: trimmed };
      setPrecheckFlow((curr) => ({
        ...curr,
        phase: "generating",
        seedAnswers: updatedSeed,
        responses: { ...curr.responses, "precheck-duration": trimmed },
      }));
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Thank you. Analyzing your responses to prepare personalized follow-up questions...",
          time: new Date(),
          meta: "precheck-generating",
        },
      ]);
      setTyping(true);

      try {
        const ctx = appointmentContext || {};
        const raw = await generateDynamicPrecheckQuestions({
          patientId: ctx.patientId || patient?.id,
          encounterId: ctx.encounterId,
          chiefComplaint: updatedSeed.reason,
          duration: updatedSeed.duration,
          specialty: ctx.specialty,
          patientContext: buildPatientContextString(patient),
        });

        const parsed = normalizeDynamicQuestions(raw, updatedSeed);
        const finalQuestions = parsed.length > 0 ? parsed.slice(0, 4) : buildFallbackDynamicQuestions(updatedSeed, ctx);
        const totalQuestions = finalQuestions.length + 2;

        setTyping(false);
        setPrecheckFlow((curr) => ({
          ...curr,
          phase: "dynamic",
          dynamicQuestions: finalQuestions,
          currentDynamicIndex: 0,
        }));
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: buildDynamicQuestionPrompt(finalQuestions[0], 3, totalQuestions),
            time: new Date(),
          },
        ]);
      } catch {
        setTyping(false);
        const ctx = appointmentContext || {};
        const fallback = buildFallbackDynamicQuestions(updatedSeed, ctx);
        const totalQuestions = fallback.length + 2;
        setPrecheckFlow((curr) => ({
          ...curr,
          phase: "dynamic",
          dynamicQuestions: fallback,
          currentDynamicIndex: 0,
        }));
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: buildDynamicQuestionPrompt(fallback[0], 3, totalQuestions),
            time: new Date(),
          },
        ]);
      }
      return;
    }

    if (phase === "dynamic") {
      const currentQuestion = dynamicQuestions[currentDynamicIndex];
      if (!currentQuestion) return;

      const validation = normalizePrecheckAnswer(currentQuestion, trimmed);
      if (!validation.isValid) {
        setMessages((prev) => [
          ...prev,
          { role: "ai", text: validation.message || "Please share a valid answer for this question.", time: new Date() },
        ]);
        return;
      }

      const nextResponses = { ...precheckFlow.responses, [currentQuestion.id]: validation.value };
      const nextIndex = currentDynamicIndex + 1;
      const totalQuestions = dynamicQuestions.length + 2;

      if (nextIndex < dynamicQuestions.length) {
        const nextQuestion = dynamicQuestions[nextIndex];
        setPrecheckFlow((curr) => ({
          ...curr,
          responses: nextResponses,
          currentDynamicIndex: nextIndex,
        }));
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: buildDynamicQuestionPrompt(nextQuestion, nextIndex + 3, totalQuestions),
            time: new Date(),
          },
        ]);
        return;
      }

      setPrecheckFlow((curr) => ({ ...curr, responses: nextResponses, submitting: true, phase: "submitting" }));
      setTyping(true);

      try {
        if (precheckFlow.appointmentId) {
          await actions.booking.submitPrecheckResponses(precheckFlow.appointmentId, nextResponses);
        }
        setPrecheckFlow((curr) => ({
          ...curr,
          active: false,
          responses: nextResponses,
          completed: true,
          submitting: false,
          phase: "complete",
        }));
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: `All done! Your pre-check answers have been submitted and shared with ${precheckFlow.appointmentContext?.doctorName || "your doctor"}. They'll review your responses before the appointment.\n\nThank you for preparing \u2014 this helps ensure a smoother consultation.`,
            time: new Date(),
            meta: `precheck-complete-${precheckFlow.questionnaireId}`,
          },
        ]);
      } catch {
        setPrecheckFlow((curr) => ({ ...curr, submitting: false, phase: "dynamic" }));
        setMessages((prev) => [
          ...prev,
          { role: "ai", text: "I couldn't submit your pre-check right now. Please try once again.", time: new Date() },
        ]);
      } finally {
        setTyping(false);
      }
    }
  }

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, typing]);

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      inputRef.current?.focus?.();
    }, 150);

    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!patientMode) return;
    if (!open) return;

    let cancelled = false;
    fetchSymptomChatMemory({
      contextKey,
      userId: session?.userId,
      role: session?.role,
      patientPhone: patient?.phone,
    })
      .then((result) => {
        if (cancelled) return;
        if (result?.memory?.summary) {
          setMessages((prev) => {
            const alreadyInjected = prev.some((item) => item.meta === "memory");
            if (alreadyInjected) return prev;

            return [
              ...prev,
              {
                role: "ai",
                text: `Continuing from your previous clinical context: ${result.memory.summary}`,
                time: new Date(),
                meta: "memory",
              },
            ];
          });
        }
      })
      .catch(() => {
        // no-op
      });

    return () => {
      cancelled = true;
    };
  }, [open, contextKey, session?.userId, session?.role, patient?.phone, language, patientMode]);

  useEffect(() => {
    if (!patientMode) return;
    if (!realtimeEvents?.length) return;

    const latest = realtimeEvents[0];
    if (!latest?.message) return;

    setMessages((prev) => {
      const duplicate = prev.find((item) => item.meta === `event-${latest.id}`);
      if (duplicate) return prev;

      return [
        ...prev,
        {
          role: "ai",
          text: `Realtime update: ${latest.message}`,
          time: new Date(),
          triageLevel: latest.triage_level || "routine",
          escalationBand: latest.escalation_band || "green",
          meta: `event-${latest.id}`,
        },
      ];
    });
  }, [realtimeEvents, patientMode]);

  const inPrecheckQuestionnaire = precheckFlow.active && !precheckFlow.completed;
  const showBookingStrip =
    patientMode &&
    !inPrecheckQuestionnaire &&
    (chatEntryMode === "booking" ||
      pendingPrecheckQuestionnaire?.status !== "sent_to_patient" ||
      precheckFlow.completed);

  useEffect(() => {
    function handleOpenPrecheck(event) {
      const detail = event.detail || {};
      setOpen(true);
      startPrecheckFlow(detail);
    }

    window.addEventListener("nira:open-precheck", handleOpenPrecheck);
    return () => window.removeEventListener("nira:open-precheck", handleOpenPrecheck);
  }, [pendingPrecheckQuestionnaire, wsNextAppointment, patient]);

  function speak(text) {
    if (!window?.speechSynthesis || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function toggleListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
      }
      setInput(text.trim());
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || typing) return;

    const userMessage = { role: "user", text, time: new Date() };
    const nextMessages = [...messages, userMessage];
    setInput("");
    setMessages(nextMessages);

    if (patientMode && precheckFlow.active && !precheckFlow.completed && !precheckFlow.submitting) {
      await processPrecheckAnswer(text, userMessage);
      return;
    }

    if (
      patientMode &&
      PRECHECK_INTENT_REGEX.test(text) &&
      !precheckFlow.active &&
      wsNextAppointment
    ) {
      startPrecheckFlow({
        appointmentId: wsNextAppointment.id,
        doctorName: wsNextAppointment.doctor?.fullName,
        specialty: wsNextAppointment.doctor?.specialty,
        startAt: wsNextAppointment.startAt,
      });
      return;
    }

    if (guestMode) {
      const helpReply = buildGuestSupportReply(text);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: helpReply,
          time: new Date(),
        },
      ]);
      return;
    }

    setTyping(true);

    try {
      const response = await chatWithContextGunaEmr({
        messages: nextMessages.map((message) => ({
          role: message.role === "ai" ? "assistant" : "user",
          content: message.text,
        })),
        patientPhone: patient?.phone || patient?.emergencyContactPhone || "",
        userId: session?.userId,
        role: session?.role,
        language,
        contextKey,
      });

      const guidedUpdate = patientMode
        ? buildGuidedBookingUpdate({
            latestText: text,
            bookingFlow,
            doctors: bookableDoctors,
          })
        : {};

      if (guidedUpdate.flow && patientMode) {
        setBookingFlow(guidedUpdate.flow);
      }

      let replyText = response.reply || "I can help summarize this for the doctor and guide the next step.";
      if (guidedUpdate.replyText) {
        replyText = guidedUpdate.replyText;
      }

      if (response.triageLevel === "emergency") {
        replyText = `${replyText}\n\nPlease do not wait for an online booking if you feel unsafe right now.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: replyText,
          time: new Date(),
          summary: response.summary,
          triageLevel: response.triageLevel,
          escalationBand: response.escalationBand,
          ddiWarnings: response.ddiWarnings,
          adherenceTips: response.adherenceTips,
          fallbackChannels: response.fallbackChannels,
        },
      ]);

      if (patientMode && response.readyForSubmission && !intakeSubmitted) {
        const submission = await submitSymptomChatToEmr({
          messages: nextMessages.map((message) => ({
            role: message.role === "ai" ? "assistant" : "user",
            content: message.text,
          })),
          patientPhone: patient?.phone || patient?.emergencyContactPhone || "",
          patientName: patient?.fullName,
          userId: session?.userId,
          role: session?.role,
          language,
          contextKey,
        });

        if (submission?.success) {
          try {
            await actions.booking.syncChatbotSubmission({
              patientId: patient?.id,
              userId: session?.userId,
              language,
              messages: nextMessages.map((message) => ({
                role: message.role === "ai" ? "assistant" : "user",
                content: message.text,
              })),
              submission,
            });
          } catch (syncError) {
            console.warn("[NIRA] Chatbot submission synced to EMR but local doctor workspace sync failed.", syncError);
          }

          setIntakeSubmitted(true);
          setMessages((prev) => [
            ...prev,
            {
              role: "ai",
              text: `Your triage has been converted to EMR draft and added to queue in realtime. Queue token: ${submission.queueToken || "--"}.`,
              time: new Date(),
              summary: submission.chat?.summary,
              triageLevel: submission.chat?.triageLevel,
              escalationBand: submission.chat?.escalationBand,
            },
          ]);
        }
      }
    } catch (error) {
      console.warn("[NIRA] Live chat unavailable, falling back to local response.", error);

      const offline = buildOfflineFallbackReply({ latestText: text });
      const guidedUpdate = patientMode
        ? buildGuidedBookingUpdate({
            latestText: text,
            bookingFlow,
            doctors: bookableDoctors,
            offlineMode: true,
          })
        : {};

      if (guidedUpdate.flow && patientMode) {
        setBookingFlow(guidedUpdate.flow);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: guidedUpdate.replyText || offline.text,
          time: new Date(),
          summary: offline.summary,
          triageLevel: offline.triageLevel,
        },
      ]);
    } finally {
      setTyping(false);
    }
  }

  function resetBookingFlow() {
    setBookingFlow({
      stage: "symptoms",
      symptoms: "",
      doctorId: "",
      slotDate: "",
      slotId: "",
    });
    setIntakeSubmitted(false);
  }

  function chooseDoctor(doctor) {
    const nextSchedule = getDoctorSchedules(state || {}, doctor.id, 14).find((schedule) => schedule.slotSummary.available > 0) || doctor.nextSchedule || null;
    const nextSlot = nextSchedule?.slots.find((slot) => slot.status === "available") || null;

    setBookingFlow({
      stage: "slot",
      symptoms: bookingFlow.symptoms,
      doctorId: doctor.id,
      slotDate: nextSchedule?.date || state?.meta?.today || "",
      slotId: nextSlot?.id || "",
    });

    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        text: `Great choice. I'm showing the live slots for ${doctor.fullName} next.`,
        time: new Date(),
      },
    ]);
  }

  function chooseSlot(date, slotId) {
    setBookingFlow((current) => ({
      ...current,
      stage: "confirm",
      slotDate: date,
      slotId,
    }));

    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        text: "Perfect \u2014 review the summary below, then confirm to book the appointment.",
        time: new Date(),
      },
    ]);
  }

  async function confirmBooking() {
    if (!selectedDoctor || !bookingFlow.slotId || !selectedSchedule || session?.role !== "patient" || !patient) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Please sign in as a patient before confirming an appointment.",
          time: new Date(),
        },
      ]);
      return;
    }

    const slot = selectedSchedule.slots.find((entry) => entry.id === bookingFlow.slotId);
    if (!slot) {
      return;
    }

    setTyping(true);

    try {
      const snapshot = await actions.booking.bookAppointment({
        patientId: patient.id,
        doctorId: selectedDoctor.id,
        slotId: slot.id,
        date: selectedSchedule.date,
        bookedByUserId: session.userId,
        visitType: "booked",
        language: "en",
      });

      const appointmentId = snapshot.ui.lastViewedAppointmentId;
      const appointment = snapshot.appointments.byId[appointmentId];
      const doctor = snapshot.doctors.byId[appointment.doctorId];

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: `Done \u2014 I booked ${doctor.fullName} on ${formatDate(appointment.startAt)} at ${formatTime(appointment.startAt)}. Token ${appointment.token}.`,
          time: new Date(),
          appointment: {
            appointment,
            doctor,
          },
        },
      ]);

      resetBookingFlow();
    } finally {
      setTyping(false);
    }
  }

  if (shouldHideChat) {
    return null;
  }

  return (
    <>
      <motion.button
        onClick={() => {
          setOpen((value) => {
            const next = !value;
            setChatEntryMode("booking");
            return next;
          });
        }}
        aria-label={open ? "Close AI chat" : "Open AI chat"}
        title={open ? "Close AI chat" : "Open AI chat"}
        className={cn(
          "fixed z-50 flex h-14 w-14 items-center justify-center rounded-full transition-all",
          avoidsPatientFloatingBook ? "bottom-24 right-4 sm:right-5" : "bottom-6 right-6",
          open
            ? "bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/25 hover:shadow-xl"
            : "bg-gradient-to-br from-brand-tide to-brand-sky shadow-lg shadow-brand-sky/30 hover:shadow-xl hover:shadow-brand-sky/40"
        )}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
      >
        {!open && (
          <motion.span
            className="absolute inset-0 rounded-full bg-brand-sky/30"
            animate={{ scale: [1, 1.6, 1.6], opacity: [0.5, 0, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <span className="relative">
          {open ? <X className="h-6 w-6 text-white" /> : <MessageCircle className="h-6 w-6 text-white" />}
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className={cn(
              "fixed z-50 flex h-[min(82vh,640px)] w-[min(calc(100vw-1rem),420px)] flex-col overflow-hidden rounded-3xl border border-white/50 bg-white/95 shadow-[0_25px_60px_rgba(11,21,44,0.18),0_0_0_1px_rgba(255,255,255,0.5)] backdrop-blur-2xl",
              avoidsPatientFloatingBook
                ? "bottom-40 right-2 sm:right-5"
                : "bottom-20 right-2 sm:bottom-24 sm:right-6"
            )}
          >
            <div className="relative flex items-center gap-3 bg-gradient-to-r from-brand-midnight via-brand-tide to-brand-sky px-5 py-4 shadow-sm">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.08),transparent_70%)]" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="relative flex-1 min-w-0">
                <div className="text-sm font-bold tracking-wide text-white">{inPrecheckQuestionnaire ? "NIRA Pre-Check" : "NIRA AI"}</div>
                <div className="flex items-center gap-1.5 text-xs text-white/70">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  {inPrecheckQuestionnaire ? "Pre-appointment questionnaire" : guestMode ? "Support assistant" : "Clinical assistant \u00B7 Online"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setChatEntryMode("booking");
                  setOpen(false);
                }}
                className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {inPrecheckQuestionnaire ? (
              <div className="border-b border-brand-sky/20 bg-gradient-to-r from-brand-sky/5 to-brand-mint/5 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-tide" />
                    <span className="text-sm font-semibold text-brand-midnight">Pre-Check Questionnaire</span>
                  </div>
                  <span className="text-xs font-medium text-muted">
                    {getPrecheckProgressLabel(precheckFlow)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-tide to-brand-sky transition-all duration-500"
                    style={{ width: `${getPrecheckProgressPercent(precheckFlow)}%` }}
                  />
                </div>
              </div>
            ) : showBookingStrip ? (
              <div className="border-b border-slate-100 bg-white/90 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {BOOKING_STEPS.map((step, index) => {
                    const active = index === bookingStageIndex || (bookingStageIndex === -1 && index === 0);
                    const done = bookingStageIndex > index;

                    return (
                      <div key={step.key} className="flex flex-1 items-center gap-1.5">
                        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                          <div
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                              active
                                ? "bg-gradient-to-br from-brand-tide to-brand-sky text-white shadow-sm shadow-brand-sky/25"
                                : done
                                  ? "bg-emerald-500 text-white"
                                  : "bg-slate-100 text-slate-400"
                            )}
                          >
                            {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                          </div>
                          <div className={cn("text-[10px] font-semibold text-center leading-tight", active ? "text-brand-tide" : done ? "text-emerald-600" : "text-slate-400")}>
                            {step.label}
                          </div>
                        </div>
                        {index < BOOKING_STEPS.length - 1 && (
                          <div className={cn("h-px w-full flex-1 min-w-2", done ? "bg-emerald-300" : "bg-slate-200")} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50/50 to-white p-3 sm:p-4" role="log" aria-live="polite" aria-label="AI chat messages">

              {patientMode && precheckFlow.active && precheckFlow.phase === "dynamic" && activePrecheckQuestion?.options?.length ? (
                <div className="rounded-2xl border border-brand-tide/10 bg-white p-3 shadow-sm ring-1 ring-black/[0.03]">
                  <div className="text-xs font-semibold text-brand-tide">Quick answers</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {activePrecheckQuestion.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        disabled={precheckFlow.submitting}
                        onClick={() => processPrecheckAnswer(option)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition-all hover:border-brand-sky hover:bg-brand-mint/30 hover:shadow-md hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {patientMode && precheckFlow.active && precheckFlow.phase === "dynamic" && activePrecheckQuestion?.type === "yesno" ? (
                <div className="rounded-2xl border border-brand-tide/10 bg-white p-3 shadow-sm ring-1 ring-black/[0.03]">
                  <div className="text-xs font-semibold text-brand-tide">Quick answers</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {["Yes", "No"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        disabled={precheckFlow.submitting}
                        onClick={() => processPrecheckAnswer(option.toLowerCase())}
                        className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-ink shadow-sm transition-all hover:border-brand-sky hover:bg-brand-mint/30 hover:shadow-md hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {messages.map((message, index) => (
                <motion.div
                  key={`${message.role}-${index}-${message.time?.toString?.() || index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex gap-2", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  {message.role === "ai" && (
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-tide to-brand-sky shadow-sm">
                      <Bot className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                  <div className="max-w-[80%]">
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:px-4",
                        message.role === "user"
                          ? "rounded-br-md bg-gradient-to-r from-brand-midnight to-brand-tide/90 text-white shadow-sm"
                          : "rounded-bl-md bg-white text-ink shadow-sm ring-1 ring-black/[0.04]"
                      )}
                    >
                      {message.text.split("\n").map((line, lineIndex, lines) => (
                        <span key={`${index}-${lineIndex}`}>
                          {line}
                          {lineIndex < lines.length - 1 && <br />}
                        </span>
                      ))}
                    </div>
                    {message.role === "ai" ? (
                      <button
                        type="button"
                        onClick={() => speak(message.text)}
                        className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-muted hover:bg-white/80"
                      >
                        <Volume2 className="h-3 w-3" />
                        Listen
                      </button>
                    ) : null}
                    {message.summary ? (
                      <div className="mt-2 rounded-2xl border border-brand-tide/10 bg-brand-mint/50 px-3 py-2 text-xs leading-5 text-muted">
                        Summary: {message.summary}
                      </div>
                    ) : null}
                    {message.escalationBand ? (
                      <div
                        className={cn(
                          "mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          message.escalationBand === "red"
                            ? "bg-red-100 text-red-700"
                            : message.escalationBand === "yellow"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                        )}
                      >
                        Escalation {message.escalationBand.toUpperCase()}
                      </div>
                    ) : null}
                    {Array.isArray(message.ddiWarnings) && message.ddiWarnings.length > 0 ? (
                      <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 shadow-soft">
                        <div className="font-semibold">Drug interaction warnings</div>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          {message.ddiWarnings.map((item, itemIndex) => (
                            <li key={`${item.medications.join("-")}-${itemIndex}`}>
                              <span className="font-semibold">{item.severity.toUpperCase()}:</span> {item.warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {Array.isArray(message.adherenceTips) && message.adherenceTips.length > 0 ? (
                      <div className="mt-2 rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900 shadow-soft">
                        <div className="font-semibold">Medication adherence</div>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          {message.adherenceTips.map((tip, tipIndex) => (
                            <li key={`${tipIndex}-${tip}`}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {message.fallbackChannels?.reason ? (
                      <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                        Fallback: {message.fallbackChannels.reason}
                      </div>
                    ) : null}
                    {message.appointment ? (
                      <div className="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 shadow-soft">
                        <div className="flex items-center gap-2 font-semibold">
                          <CalendarClock className="h-4 w-4" />
                          Appointment booked
                        </div>
                        <div className="mt-2">
                          {message.appointment.doctor.fullName} on {formatDate(message.appointment.appointment.startAt)} at {formatTime(message.appointment.appointment.startAt)}
                        </div>
                        <div className="mt-1">Token {message.appointment.appointment.token}</div>
                        <button
                          type="button"
                          onClick={() => navigate(`/patient/appointments/${message.appointment.appointment.id}?bucket=action`)}
                          className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1.5 text-white transition hover:bg-emerald-700"
                        >
                          Open appointment
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {message.role === "user" && (
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-midnight/10 ring-1 ring-brand-midnight/5">
                      <User className="h-3.5 w-3.5 text-brand-midnight" />
                    </div>
                  )}
                </motion.div>
              ))}

              {patientMode && !inPrecheckQuestionnaire && bookingFlow.stage === "symptoms" ? (
                <div className="rounded-2xl border border-brand-tide/10 bg-brand-mint/40 p-4 shadow-soft">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <MessageCircle className="h-4 w-4 text-brand-tide" />
                    Step 1 \u2014 Tell me your symptoms
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted">
                    You can type the main complaint, how long it has been going on, and anything that makes it better or worse.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SYMPTOM_EXAMPLE_PROMPTS.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => setInput(example)}
                        className="rounded-full border border-brand-tide/10 bg-white px-3 py-1.5 text-xs font-medium text-ink transition hover:border-brand-tide/30 hover:bg-brand-mint"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {patientMode && !inPrecheckQuestionnaire && bookingFlow.stage === "doctor" ? (
                <div className="space-y-3 rounded-2xl border border-brand-tide/10 bg-white/85 p-4 shadow-soft">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <User className="h-4 w-4 text-brand-tide" />
                        Step 2 \u2014 Available doctors
                      </div>
                      <p className="mt-1 text-xs text-muted">Match based on your symptoms: {bookingFlow.symptoms || "not captured yet"}</p>
                    </div>
                    <button type="button" onClick={resetBookingFlow} className="text-xs font-semibold text-brand-midnight hover:underline">
                      Start over
                    </button>
                  </div>

                  <div className="grid gap-2">
                    {rankedDoctors.map((doctor) => {
                      const slots = doctor.nextSchedule?.slots.filter((slot) => slot.status === "available").slice(0, 3) || [];
                      return (
                        <button
                          key={doctor.id}
                          type="button"
                          onClick={() => chooseDoctor(doctor)}
                          className="rounded-2xl border border-white/70 bg-surface-2 p-3 text-left transition hover:border-brand-sky hover:bg-brand-mint/30"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-ink">{doctor.fullName}</div>
                              <div className="text-xs text-muted">{doctor.specialty || "General Practice"}</div>
                            </div>
                            <div className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-muted shadow-soft">
                              {doctor.nextAvailableSlot ? `${formatDate(doctor.nextAvailableSlot.startAt)} \u00B7 ${formatTime(doctor.nextAvailableSlot.startAt)}` : "No slots"}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {slots.length ? (
                              slots.map((slot) => (
                                <span key={slot.id} className="rounded-full bg-brand-sky px-2.5 py-1 text-[11px] font-semibold text-white">
                                  {formatTime(slot.startAt)}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted">Live slots loading\u2026</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {patientMode && !inPrecheckQuestionnaire && bookingFlow.stage === "slot" && selectedDoctor ? (
                <div className="space-y-3 rounded-2xl border border-brand-tide/10 bg-white/85 p-4 shadow-soft">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <CalendarDays className="h-4 w-4 text-brand-tide" />
                      Step 3 \u2014 Pick a slot for {selectedDoctor.fullName}
                    </div>
                    <p className="mt-1 text-xs text-muted">Choose a date first, then tap a live available time.</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {availableDates.map(({ date, slotSummary }) => (
                      <button
                        key={date}
                        type="button"
                        onClick={() =>
                          setBookingFlow((current) => ({
                            ...current,
                            slotDate: date,
                            slotId: "",
                          }))
                        }
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          bookingFlow.slotDate === date
                            ? "border-brand-sky bg-brand-mint text-ink"
                            : "border-line bg-white text-muted hover:bg-surface-2"
                        )}
                      >
                        {formatDate(`${date}T00:00:00+05:30`)} ({slotSummary.available})
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => chooseSlot(selectedSchedule.date, slot.id)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-left text-sm font-semibold transition",
                          bookingFlow.slotId === slot.id
                            ? "border-brand-sky bg-brand-sky text-white"
                            : "border-cyan-200 bg-cyan-50 text-ink hover:-translate-y-0.5"
                        )}
                      >
                        <div>
                          {formatTime(slot.startAt)} - {formatTime(slot.endAt)}
                        </div>
                        <div className="mt-1 text-[11px] font-normal opacity-80">Tap to continue</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {patientMode && !inPrecheckQuestionnaire && bookingFlow.stage === "confirm" && selectedDoctor && bookingFlow.slotId && selectedSchedule ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-soft">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                    <CheckCircle2 className="h-4 w-4" />
                    Step 4 \u2014 Confirm booking
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-emerald-900">
                    <div>
                      <span className="font-semibold">Symptoms:</span> {bookingFlow.symptoms || "Not shared"}
                    </div>
                    <div>
                      <span className="font-semibold">Doctor:</span> {selectedDoctor.fullName}
                    </div>
                    <div>
                      <span className="font-semibold">Slot:</span> {formatDate(`${selectedSchedule.date}T00:00:00+05:30`)} at {formatTime((selectedSchedule.slots.find((slot) => slot.id === bookingFlow.slotId) || selectedSchedule.slots[0]).startAt)}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={confirmBooking}
                      disabled={typing}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Book appointment
                    </button>
                    <button
                      type="button"
                      onClick={resetBookingFlow}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
                    >
                      Change details
                    </button>
                  </div>
                </div>
              ) : null}

              {typing && (
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-tide to-brand-sky shadow-sm">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-black/[0.04]">
                    <div className="flex gap-1.5">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-brand-tide/60" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-brand-sky/60" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-brand-tide/60" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-slate-100 bg-white/90 p-3 backdrop-blur-sm">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={guestMode}
                  aria-label="Voice input"
                  className={cn(
                    "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border transition-all",
                    isListening
                      ? "animate-pulse border-brand-sky bg-brand-sky/10 text-brand-sky shadow-sm shadow-brand-sky/20"
                      : "border-slate-200 bg-white text-slate-500 hover:border-brand-sky/40 hover:bg-brand-mint/30 hover:text-brand-tide",
                    guestMode ? "cursor-not-allowed opacity-50" : ""
                  )}
                  title="Voice input"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  aria-label="Type your message"
                  placeholder={
                    precheckFlow.active && !precheckFlow.completed
                      ? precheckFlow.phase === "generating"
                        ? "Generating questions..."
                        : "Type your answer..."
                      : guestMode
                      ? "Ask about login, signup, or support..."
                      : bookingFlow.stage === "symptoms"
                      ? "Describe your symptoms..."
                      : bookingFlow.stage === "doctor"
                        ? "Tap a doctor or type more..."
                        : bookingFlow.stage === "slot"
                          ? "Choose a slot above..."
                          : "Review and confirm..."
                  }
                  disabled={precheckFlow.phase === "generating"}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-slate-400 outline-none transition-all focus:border-brand-tide/50 focus:ring-2 focus:ring-brand-tide/10 disabled:bg-slate-50 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || typing || precheckFlow.submitting || precheckFlow.phase === "generating"}
                  aria-label="Send message"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-brand-tide to-brand-sky text-white shadow-sm transition-all hover:shadow-md hover:shadow-brand-sky/25 disabled:opacity-40 disabled:shadow-none"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function buildGuestSupportReply(latestText) {
  const lower = latestText.toLowerCase();

  if (LOGIN_HELP_INTENT_REGEX.test(lower)) {
    return "To login: open the Auth page, choose Patient or Hospital, then select Doctor, Nurse, or Admin inside Hospital. Enter your registered credentials to continue.";
  }

  if (CONTACT_HELP_INTENT_REGEX.test(lower)) {
    return "For support, please contact your clinic front desk or NIRA support team. If access is blocked, share your role, registered phone/email, and clinic name so admin can help quickly.";
  }

  if (BOOKING_INTENT_REGEX.test(lower)) {
    return "Booking is available only after patient login. Please sign in first, then I can guide symptoms, doctor selection, live slots, and confirmation.";
  }

  return "Before login, I can help only with login/signup steps and support contact guidance. Once you log in as a patient, I can assist with booking appointments.";
}

function buildGuidedBookingUpdate({ latestText, bookingFlow, doctors, offlineMode = false }) {
  const lower = latestText.toLowerCase();
  const bookingIntent = BOOKING_INTENT_REGEX.test(lower);
  const hasSymptoms = isLikelySymptomInput(latestText, bookingIntent);

  if (EMERGENCY_INTENT_REGEX.test(lower)) {
    return {
      replyText: "Your symptoms may indicate an emergency. Please call emergency services now or go to the nearest emergency department immediately.",
      flow: {
        stage: "symptoms",
        symptoms: "",
        doctorId: "",
        slotDate: "",
        slotId: "",
      },
    };
  }

  if (bookingFlow.stage === "symptoms") {
    if (hasSymptoms) {
      return {
        replyText: `Thanks \u2014 I noted: "${latestText}". Step 2 of 4: choose a doctor from the cards below, then I'll show the live slots.`,
        flow: {
          stage: "doctor",
          symptoms: latestText,
          doctorId: "",
          slotDate: "",
          slotId: "",
        },
      };
    }

    if (bookingIntent) {
      return {
        replyText: offlineMode
          ? "I can help with booking, but first I need your symptoms or reason for visit. Share that and I'll show doctors and slots."
          : "I can help with booking, but first tell me your symptoms or reason for visit. After that I'll show doctors and live slots.",
      };
    }
  }

  if (bookingFlow.stage === "doctor") {
    return {
      replyText: "Great \u2014 choose one of the doctors below and I'll move to the available slots next.",
    };
  }

  if (bookingFlow.stage === "slot" && bookingFlow.doctorId) {
    return {
      replyText: `Nice. Step 3 is ready \u2014 choose a slot for ${doctors.find((doctor) => doctor.id === bookingFlow.doctorId)?.fullName || "your selected doctor"} and then confirm.`,
    };
  }

  if (bookingFlow.stage === "confirm") {
    return {
      replyText: "Review the summary and tap Book appointment when you're ready.",
    };
  }

  return {};
}

function isLikelySymptomInput(latestText, bookingIntent) {
  const text = latestText.trim();
  const lower = text.toLowerCase();

  if (!text || NON_CLINICAL_CHAT_REGEX.test(text)) return false;
  if (SYMPTOM_SIGNAL_REGEX.test(lower)) return true;

  const hasTimeline = /\b(today|yesterday|since|for|day|days|week|weeks|month|months|hour|hours)\b/i.test(lower);
  const hasSeverity = /\b(mild|moderate|severe|worse|better|improving|persistent)\b/i.test(lower);

  if (hasTimeline || hasSeverity) return true;

  return !bookingIntent && text.length >= 12;
}

function rankDoctorsForSymptoms(doctors, symptomsText) {
  const lower = symptomsText.toLowerCase();

  return [...doctors].sort((left, right) => {
    const leftScore = scoreDoctorForSymptoms(left, lower);
    const rightScore = scoreDoctorForSymptoms(right, lower);

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    const leftTime = left.nextAvailableSlot ? new Date(left.nextAvailableSlot.startAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = right.nextAvailableSlot ? new Date(right.nextAvailableSlot.startAt).getTime() : Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime;
  });
}

function scoreDoctorForSymptoms(doctor, lowerSymptoms) {
  let score = 0;
  const normalizedName = doctor.fullName.toLowerCase().replace(/^dr\.?\s*/, "");
  const specialty = (doctor.specialty || "").toLowerCase();

  if (normalizedName.split(/\s+/).some((token) => token && lowerSymptoms.includes(token))) {
    score += 4;
  }

  const specialtyMatchers = [
    { pattern: /\b(chest pain|palpitations|heart|bp|pressure)\b/i, specialty: "internal medicine" },
    { pattern: /\b(fever|cough|cold|infection|weakness|sore throat)\b/i, specialty: "general medicine" },
    { pattern: /\b(family doctor|family medicine)\b/i, specialty: "family medicine" },
    { pattern: /\b(checkup|general doctor|general practice|routine)\b/i, specialty: "general practice" },
  ];

  specialtyMatchers.forEach((rule) => {
    if (rule.pattern.test(lowerSymptoms) && specialty.includes(rule.specialty)) {
      score += 3;
    }
  });

  if (doctor.nextAvailableSlot) {
    score += 1;
  }

  return score;
}

function buildOfflineFallbackReply({ latestText }) {
  const lower = latestText.toLowerCase();

  if (EMERGENCY_INTENT_REGEX.test(lower)) {
    return {
      text: "Your symptoms may indicate an emergency. Please call emergency services now or go to the nearest emergency department immediately.",
      summary: "Potential emergency red-flag symptoms mentioned in offline mode.",
      triageLevel: "emergency",
    };
  }

  if (BOOKING_INTENT_REGEX.test(lower)) {
    return {
      text: "I can help with booking, but first share your symptoms or reason for visit. Then I'll show doctors and available slots.",
      summary: "Appointment booking requested while live intake service unavailable.",
      triageLevel: "routine",
    };
  }

  return {
    text: "I couldn't reach the live intake service, but I can still help. Please share your main symptom, when it started, and severity (mild/moderate/severe).",
    summary: "Clinical intake assessment in progress (offline fallback mode).",
    triageLevel: "routine",
  };
}

function normalizePrecheckAnswer(question, answerText) {
  const type = String(question?.type || "text").toLowerCase();
  const options = Array.isArray(question?.options) ? question.options : [];
  const required = question?.required !== false;
  const raw = String(answerText || "").trim();
  const lower = raw.toLowerCase();

  const isSkip = lower === "skip" || lower === "na" || lower === "n/a";
  if (!raw) {
    if (required) {
      return { isValid: false, message: "This question is required. Please share your answer." };
    }
    return { isValid: true, value: "Skipped" };
  }

  if (isSkip) {
    if (required) {
      return { isValid: false, message: "This question is required, so please answer it instead of skipping." };
    }
    return { isValid: true, value: "Skipped" };
  }

  if (type === "yesno") {
    if (["yes", "y"].includes(lower)) return { isValid: true, value: "yes" };
    if (["no", "n"].includes(lower)) return { isValid: true, value: "no" };
    return { isValid: false, message: "Please answer with yes or no." };
  }

  if (type === "multiple_choice" && options.length > 0) {
    const matched = options.find((option) => String(option).toLowerCase() === lower);
    if (!matched) {
      return { isValid: false, message: `Please choose one of: ${options.join(", ")}.` };
    }
    return { isValid: true, value: matched };
  }

  if (type === "rating") {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric < 1 || numeric > 10) {
      return { isValid: false, message: "Please enter a number between 1 and 10." };
    }
    return { isValid: true, value: String(Math.round(numeric)) };
  }

  return { isValid: true, value: raw };
}

function buildPatientContextString(patient) {
  if (!patient) return "";
  const parts = [];
  if (patient.age) parts.push(`Age: ${patient.age}`);
  if (patient.gender) parts.push(`Gender: ${patient.gender}`);
  if (patient.medicalHistory) parts.push(`History: ${patient.medicalHistory}`);
  if (patient.currentMedications) parts.push(`Medications: ${patient.currentMedications}`);
  if (patient.allergies) parts.push(`Allergies: ${patient.allergies}`);
  return parts.join(". ");
}

function normalizeDynamicQuestions(raw, seedAnswers) {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  return raw
    .filter((q) => {
      const text = String(q.question || q.text || "").toLowerCase();
      const isRedundantReason = /what.*(concern|problem|complaint|brings you)/i.test(text);
      const isRedundantDuration = /how long|when did.*start|duration/i.test(text);
      return !isRedundantReason && !isRedundantDuration;
    })
    .map((q, index) => ({
      id: `dynamic-${index + 1}`,
      question: q.question || q.text || `Follow-up question ${index + 1}`,
      type: q.type || (q.answer_type === "boolean" ? "yesno" : q.options?.length ? "multiple_choice" : "text"),
      options: q.options || [],
      required: q.required !== false,
      category: q.category || "general",
    }));
}

function buildFallbackDynamicQuestions(seedAnswers, context) {
  const complaint = (seedAnswers.reason || "").toLowerCase();
  const questions = [];

  questions.push({
    id: "dynamic-1",
    question: "How severe is your main symptom right now on a scale of 1 (mild) to 10 (worst)?",
    type: "rating",
    required: true,
    category: "severity",
  });

  questions.push({
    id: "dynamic-2",
    question: "Do you have any urgent warning signs such as severe breathlessness, high fever, chest pain, confusion, or fainting?",
    type: "yesno",
    required: true,
    category: "red_flags",
  });

  if (/fever|temperature|chills|viral|infection/i.test(complaint)) {
    questions.push({
      id: "dynamic-3",
      question: "What is the highest temperature recorded, and do you have body aches, sore throat, or rash along with it?",
      type: "text",
      required: true,
      category: "symptoms",
    });
  } else if (/pain|ache|hurt|sore/i.test(complaint)) {
    questions.push({
      id: "dynamic-3",
      question: "Can you describe the pain \u2014 is it sharp, dull, throbbing, or burning? Does anything make it better or worse?",
      type: "text",
      required: true,
      category: "symptoms",
    });
  } else if (/cough|breath|wheez|asthma|chest tight/i.test(complaint)) {
    questions.push({
      id: "dynamic-3",
      question: "Is the cough dry or productive? Do you experience difficulty breathing, especially when lying down or during activity?",
      type: "text",
      required: true,
      category: "symptoms",
    });
  } else if (/stomach|abdomen|nausea|vomit|diarr|constip|acid|gastro|bloat/i.test(complaint)) {
    questions.push({
      id: "dynamic-3",
      question: "Is the discomfort related to meals? Have you noticed vomiting, changes in stool, or severe abdominal pain?",
      type: "text",
      required: true,
      category: "symptoms",
    });
  } else {
    questions.push({
      id: "dynamic-3",
      question: "Are there any other symptoms alongside your main concern? (e.g., nausea, dizziness, fatigue, appetite changes)",
      type: "text",
      required: true,
      category: "symptoms",
    });
  }

  questions.push({
    id: "dynamic-4",
    question: "What medicines, supplements, or home remedies are you currently taking?",
    type: "text",
    required: true,
    category: "medications",
  });

  return questions;
}

function buildDynamicQuestionPrompt(question, questionNumber, totalQuestions) {
  const title = `Q${questionNumber}/${totalQuestions}: ${question?.question || `Question ${questionNumber}`}`;
  const type = String(question?.type || "text").toLowerCase();
  const options = Array.isArray(question?.options) ? question.options : [];
  const required = question?.required !== false;

  if (type === "yesno") {
    return `${title}\nPlease reply: yes or no.${required ? "" : " (You can type 'skip' if not sure.)"}`;
  }
  if (type === "multiple_choice" && options.length > 0) {
    return `${title}\nChoose one: ${options.join(" | ")}.${required ? "" : " (You can type 'skip' if needed.)"}`;
  }
  if (type === "rating") {
    return `${title}\nPlease answer with a number from 1 to 10.${required ? "" : " (Or type 'skip'.)"}`;
  }
  return `${title}${required ? "" : "\nOptional: you may type 'skip' if this does not apply."}`;
}

function getPrecheckProgressLabel(flow) {
  const totalDynamic = flow.dynamicQuestions?.length || 4;
  const total = totalDynamic + 2;
  if (flow.phase === "seed_reason") return "Question 1 of ~6";
  if (flow.phase === "seed_duration") return "Question 2 of ~6";
  if (flow.phase === "generating") return "Preparing tailored questions...";
  if (flow.phase === "dynamic") return `Question ${flow.currentDynamicIndex + 3} of ${total}`;
  if (flow.phase === "submitting") return "Submitting...";
  if (flow.phase === "complete" || flow.completed) return "Complete!";
  return "";
}

function getPrecheckProgressPercent(flow) {
  const totalDynamic = flow.dynamicQuestions?.length || 4;
  const total = totalDynamic + 2;
  if (flow.phase === "seed_reason") return Math.round((0 / total) * 100);
  if (flow.phase === "seed_duration") return Math.round((1 / total) * 100);
  if (flow.phase === "generating") return Math.round((2 / total) * 100);
  if (flow.phase === "dynamic") return Math.round(((flow.currentDynamicIndex + 2) / total) * 100);
  if (flow.phase === "submitting" || flow.phase === "complete" || flow.completed) return 100;
  return 0;
}
