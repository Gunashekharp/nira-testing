import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { demoStore } from "../services/demoStore";

const DemoDataContext = createContext(null);

export function DemoDataProvider({ children }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    demoStore.getState().then((snapshot) => {
      if (mounted) {
        setState(snapshot);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const refresh = async () => {
    const snapshot = await demoStore.getState();
    setState(snapshot);
    return snapshot;
  };

  const actions = useMemo(
    () => ({
      dev: {
        async resetDemo(mode = "default") {
          const snapshot = demoStore.reset(mode);
          setState(snapshot);
          return snapshot;
        }
      },
      auth: {
        async login(payload) {
          const snapshot = await demoStore.login(payload);
          setState(snapshot);
          return snapshot;
        },
        async logout() {
          const snapshot = await demoStore.logout();
          setState(snapshot);
          return snapshot;
        },
        async signupPatient(payload) {
          const snapshot = await demoStore.signupPatient(payload);
          setState(snapshot);
          return snapshot;
        },
        async signupDoctor(payload) {
          const snapshot = await demoStore.signupDoctor(payload);
          setState(snapshot);
          return snapshot;
        },
        async signupAdmin(payload) {
          const snapshot = await demoStore.signupAdmin(payload);
          setState(snapshot);
          return snapshot;
        },
        async updateCurrentProfile(payload) {
          const snapshot = await demoStore.updateCurrentProfile(payload);
          setState(snapshot);
          return snapshot;
        }
      },
      booking: {
        async bookAppointment(payload) {
          const snapshot = await demoStore.bookAppointment(payload);
          setState(snapshot);
          return snapshot;
        },
        async submitInterview(appointmentId, payload) {
          const snapshot = await demoStore.submitInterview(appointmentId, payload);
          setState(snapshot);
          return snapshot;
        },
        async cancelAppointment(appointmentId) {
          const snapshot = await demoStore.cancelAppointment(appointmentId);
          setState(snapshot);
          return snapshot;
        },
        async rescheduleAppointment(appointmentId, payload) {
          const snapshot = await demoStore.rescheduleAppointment(appointmentId, payload);
          setState(snapshot);
          return snapshot;
        }
      },
      doctor: {
        async updateAvailability(doctorId, payload) {
          const snapshot = await demoStore.updateDoctorAvailability(doctorId, payload);
          setState(snapshot);
          return snapshot;
        },
        async updateScheduleOverride(doctorId, payload) {
          const snapshot = await demoStore.updateScheduleOverride(doctorId, payload);
          setState(snapshot);
          return snapshot;
        },
        async toggleSlotAvailability(doctorId, date, slotId, nextStatus) {
          const snapshot = await demoStore.toggleSlotAvailability(doctorId, date, slotId, nextStatus);
          setState(snapshot);
          return snapshot;
        },
        async saveDoctorReview(appointmentId, payload) {
          const snapshot = await demoStore.saveDoctorReview(appointmentId, payload);
          setState(snapshot);
          return snapshot;
        },
        async approveEncounter(appointmentId, payload) {
          const snapshot = await demoStore.approveEncounter(appointmentId, payload);
          setState(snapshot);
          return snapshot;
        }
      },
      admin: {
        async addDoctor(payload) {
          const snapshot = await demoStore.addDoctor(payload);
          setState(snapshot);
          return snapshot;
        },
        async updateDoctor(doctorId, payload) {
          const snapshot = await demoStore.updateDoctor(doctorId, payload);
          setState(snapshot);
          return snapshot;
        },
        async approveDoctor(doctorId) {
          const snapshot = await demoStore.approveDoctor(doctorId);
          setState(snapshot);
          return snapshot;
        },
        async rejectDoctor(doctorId) {
          const snapshot = await demoStore.rejectDoctor(doctorId);
          setState(snapshot);
          return snapshot;
        },
        async deactivateDoctor(doctorId) {
          const snapshot = await demoStore.deactivateDoctor(doctorId);
          setState(snapshot);
          return snapshot;
        },
        async archiveDoctor(doctorId) {
          const snapshot = await demoStore.archiveDoctor(doctorId);
          setState(snapshot);
          return snapshot;
        },
        async updateDoctorAvailability(doctorId, payload) {
          const snapshot = await demoStore.updateDoctorAvailability(doctorId, payload);
          setState(snapshot);
          return snapshot;
        },
        async updateScheduleOverride(doctorId, payload) {
          const snapshot = await demoStore.updateScheduleOverride(doctorId, payload);
          setState(snapshot);
          return snapshot;
        },
        async cancelAppointment(appointmentId) {
          const snapshot = await demoStore.cancelAppointment(appointmentId);
          setState(snapshot);
          return snapshot;
        },
        async rescheduleAppointment(appointmentId, payload) {
          const snapshot = await demoStore.rescheduleAppointment(appointmentId, payload);
          setState(snapshot);
          return snapshot;
        }
      },
      refresh
    }),
    []
  );

  const value = useMemo(
    () => ({
      state,
      session: state?.session || null,
      loading,
      actions
    }),
    [state, loading, actions]
  );

  return <DemoDataContext.Provider value={value}>{children}</DemoDataContext.Provider>;
}

export function useDemoData() {
  const context = useContext(DemoDataContext);

  if (!context) {
    throw new Error("useDemoData must be used within DemoDataProvider");
  }

  return context;
}
