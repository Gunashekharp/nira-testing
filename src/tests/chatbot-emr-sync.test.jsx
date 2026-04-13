import { expect, test, vi, afterEach } from "vitest";
import { demoStore } from "../services/demoStore";
import { getAppointmentBundle, getDoctorWorkspace } from "../features/shared/selectors";
import { fetchSymptomChatMemory } from "../services/gunaEmrBridge";

afterEach(() => {
  vi.restoreAllMocks();
});

test("chatbot submission is saved into EMR sync state and visible in doctor workspace", async () => {
  const seed = demoStore.reset();
  const patient = Object.values(seed.patients.byId).find((item) => item.fullName === "Aasha Verma");

  expect(patient).toBeTruthy();

  const payload = {
    patientId: patient.id,
    userId: patient.userId,
    language: "en",
    messages: [
      { role: "user", content: "I have stomach pain and burning since yesterday." },
      { role: "assistant", content: "Noted. Any vomiting or black stools?" },
      { role: "user", content: "No vomiting, no black stools." }
    ],
    submission: {
      success: true,
      patientId: "fhir-patient-101",
      encounterId: "fhir-enc-555",
      queueToken: 42,
      chat: {
        summary: "Chief Complaint: stomach pain with burning | Duration: since yesterday",
        redFlags: []
      },
      cdss: {
        confidenceScores: {
          subjective: 0.89,
          assessment: 0.78
        }
      }
    }
  };

  await demoStore.syncChatbotSubmission(payload);
  const snapshot = await demoStore.getState();

  const appointmentId = snapshot.ui.lastViewedAppointmentId;
  expect(appointmentId).toBeTruthy();

  const bundle = getAppointmentBundle(snapshot, appointmentId);
  expect(bundle).toBeTruthy();
  expect(bundle.encounter?.status).toBe("ai_ready");
  expect(bundle.interview?.completionStatus).toBe("complete");
  expect(bundle.interview?.transcript?.length).toBeGreaterThan(0);
  expect(String(bundle.draft?.soap?.subjective || "")).toMatch(/stomach pain/i);

  const emrSync = snapshot.emrSync.byId[`emr-${appointmentId}`];
  expect(emrSync).toBeTruthy();
  expect(emrSync.patientId).toBe("fhir-patient-101");
  expect(emrSync.encounterId).toBe("fhir-enc-555");
  expect(emrSync.queueToken).toBe(42);
  expect(emrSync.interviewSyncedAt).toBeTruthy();

  const doctorUser = Object.values(snapshot.users.byId).find((item) => item.profileId === bundle.appointment.doctorId);
  const doctorViewState = {
    ...snapshot,
    session: {
      userId: doctorUser?.id || null,
      role: "doctor",
      isAuthenticated: true,
      activeProfileId: doctorUser?.profileId || null,
      identifier: doctorUser?.email || ""
    }
  };

  const doctorWorkspace = getDoctorWorkspace(doctorViewState);
  const doctorQueueItem = doctorWorkspace.appointments.find((item) => item.id === appointmentId);
  expect(doctorQueueItem).toBeTruthy();
  expect(doctorQueueItem.queueStatus).toBe("ai_ready");
  expect(String(doctorQueueItem.draft?.soap?.subjective || "")).toMatch(/stomach pain/i);
});

test("chatbot memory retrieval calls EMR endpoint and returns stored memory payload", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      contextKey: "patient:u1",
      memory: {
        summary: "Past history includes acidity and episodic gastritis."
      }
    })
  });

  vi.stubGlobal("fetch", fetchMock);

  const result = await fetchSymptomChatMemory({
    contextKey: "patient:u1",
    userId: "u1",
    role: "patient",
    patientPhone: "+91 9876543210"
  });

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const calledUrl = String(fetchMock.mock.calls[0][0]);
  expect(calledUrl).toContain("/api/convert/symptom-chat/memory");
  expect(calledUrl).toContain("contextKey=patient%3Au1");
  expect(calledUrl).toContain("userId=u1");
  expect(calledUrl).toContain("role=patient");

  expect(result?.memory?.summary).toMatch(/gastritis/i);
});
