import { useState, useEffect, useCallback } from "react";
import {
  createPrecheckQuestionnaire,
  getPrecheckQuestionnaire,
  getPrecheckByEncounter,
  updatePrecheckQuestions,
  confirmPrecheckQuestions,
  submitPrecheckResponses,
  createNotification,
  getUserNotifications,
  markNotificationAsRead
} from "../services/supabaseApi";
import { generatePrecheckQuestions } from "../services/precheckQuestions";
import { gunaEmrBridge } from "../services/gunaEmrBridge";
import { supabase } from "../lib/supabase";

/**
 * Hook for managing pre-check questionnaire workflow
 */
export function usePrecheckWorkflow(encounterId) {
  const [questionnaire, setQuestionnaire] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Load existing questionnaire ──
  const loadQuestionnaire = useCallback(async () => {
    if (!encounterId) return;

    setLoading(true);
    try {
      const data = await getPrecheckByEncounter(encounterId);
      setQuestionnaire(data);
      setError(null);
    } catch (err) {
      console.error("Error loading questionnaire:", err);
      setError(err?.message || "Failed to load questionnaire");
    } finally {
      setLoading(false);
    }
  }, [encounterId]);

  // ── Generate AI questions ──
  const generateQuestions = useCallback(async (appointmentContext) => {
    setLoading(true);
    try {
      const aiQuestions = await generatePrecheckQuestions(encounterId, appointmentContext);

      const newQuestionnaire = await createPrecheckQuestionnaire({
        encounterId,
        patientId: appointmentContext.patientId,
        doctorId: appointmentContext.doctorId,
        clinicId: appointmentContext.clinicId,
        aiQuestions
      });

      setQuestionnaire(newQuestionnaire);

      // Create notification for doctor
      await createNotification({
        userId: appointmentContext.doctorId,
        type: "precheck_questions_ready",
        title: "Pre-Check Questions Ready",
        message: `AI has generated pre-check questions for ${appointmentContext.patientName}. Please review and customize.`,
        encounterId,
        questionnaireId: newQuestionnaire.id
      });

      setError(null);
      return newQuestionnaire;
    } catch (err) {
      console.error("Error generating questions:", err);
      const message = err?.message || "Failed to generate questions";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [encounterId]);

  // ── Update questions (doctor editing) ──
  const editQuestions = useCallback(async (editedQuestions) => {
    if (!questionnaire?.id) return;

    setLoading(true);
    try {
      const updated = await updatePrecheckQuestions(questionnaire.id, editedQuestions);
      setQuestionnaire(updated);
      setError(null);
      return updated;
    } catch (err) {
      console.error("Error updating questions:", err);
      setError(err?.message || "Failed to update questions");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [questionnaire?.id]);

  // ── Confirm & send to patient ──
  const sendToPatient = useCallback(async () => {
    if (!questionnaire?.id) return;

    setLoading(true);
    try {
      const updated = await confirmPrecheckQuestions(questionnaire.id);
      setQuestionnaire(updated);

      // Create notification for patient
      await createNotification({
        userId: questionnaire.patient_id,
        type: "precheck_sent",
        title: "Pre-Appointment Questionnaire",
        message: "Your doctor has sent pre-check-up questions. Please answer them before your appointment.",
        encounterId,
        questionnaireId: questionnaire.id
      });

      setError(null);
      return updated;
    } catch (err) {
      console.error("Error sending to patient:", err);
      setError(err?.message || "Failed to send to patient");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [questionnaire?.id, questionnaire?.patient_id, encounterId]);

  // ── Submit patient responses ──
  const submitResponses = useCallback(async (patientResponses) => {
    if (!questionnaire?.id) return;

    setLoading(true);
    try {
      const updated = await submitPrecheckResponses(questionnaire.id, patientResponses);
      setQuestionnaire(updated);

      // Sync to EMR
      await syncPrecheckToEMR(updated);

      // Create notification for doctor
      await createNotification({
        userId: questionnaire.doctor_id,
        type: "precheck_completed",
        title: "Pre-Check Answers Received",
        message: "Patient has completed the pre-check questionnaire.",
        encounterId,
        questionnaireId: questionnaire.id
      });

      setError(null);
      return updated;
    } catch (err) {
      console.error("Error submitting responses:", err);
      setError(err?.message || "Failed to submit responses");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [questionnaire?.id, questionnaire?.doctor_id, encounterId]);

  // ── Sync to EMR ──
  const syncPrecheckToEMR = useCallback(async (updatedQuestionnaire) => {
    try {
      await gunaEmrBridge.syncToGunaEmr(
        "/api/convert/precheck-responses",
        "POST",
        {
          encounterId,
          questionnaire: updatedQuestionnaire
        }
      );
    } catch (err) {
      console.warn("Non-critical: Failed to sync pre-check to EMR:", err);
    }
  }, [encounterId]);

  return {
    questionnaire,
    loading,
    error,
    loadQuestionnaire,
    generateQuestions,
    editQuestions,
    sendToPatient,
    submitResponses
  };
}

/**
 * Hook for retrieving and managing patient notifications
 */
export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadNotifications = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      setNotifications(data || []);
      setError(null);
    } catch (err) {
      console.error("Error loading notifications:", err);
      setError(err?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ── Real-time subscription ──
  useEffect(() => {
    if (!userId) return;

    const subscription = supabase
      .channel(`notifications:user_id=eq.${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setNotifications((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setNotifications((prev) =>
              prev.map((n) => (n.id === payload.new.id ? payload.new : n))
            );
          } else if (payload.eventType === "DELETE") {
            setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      const { data } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .select()
        .single();

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? data : n))
      );
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  return {
    notifications,
    loading,
    error,
    markAsRead,
    loadNotifications
  };
}
