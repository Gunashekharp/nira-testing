import { expect, test } from "vitest";
import { demoStore } from "../services/demoStore";
import { getAppointmentBundle, getPatientAppointmentById } from "../features/shared/selectors";

test("nurse vitals save is reflected in doctor and patient data views", async () => {
  const seed = demoStore.reset();
  const appointmentId = seed.appointments.allIds[0];

  await demoStore.saveNurseVitals(appointmentId, {
    bloodPressure: "146/92",
    pulse: "96",
    temperature: "99.1",
    spo2: "97",
    painScore: "4"
  });

  const snapshot = await demoStore.getState();
  const doctorBundle = getAppointmentBundle(snapshot, appointmentId);
  const patientAppointment = getPatientAppointmentById(snapshot, appointmentId);

  expect(doctorBundle?.draft?.vitals?.bloodPressure).toBe("146/92");
  expect(doctorBundle?.draft?.vitals?.pulse).toBe("96");
  expect(doctorBundle?.draft?.vitals?.temperature).toBe("99.1");
  expect(doctorBundle?.draft?.vitals?.spo2).toBe("97");
  expect(doctorBundle?.draft?.vitals?.painScore).toBe("4");

  expect(patientAppointment?.encounter?.apciDraft?.vitals?.bloodPressure).toBe("146/92");
  expect(patientAppointment?.encounter?.apciDraft?.vitals?.pulse).toBe("96");
});
