import { AppShell } from "../../components/layout/AppShell";
import { useDemoData } from "../../app/DemoDataProvider";
import { getDoctorWorkspace } from "../shared/selectors";
import { AvailabilityEditor } from "../shared/AvailabilityEditor";

export function DoctorAvailabilityPage() {
  const { state, actions } = useDemoData();
  const { doctor } = getDoctorWorkspace(state);

  return (
    <AppShell
      title="Doctor availability"
      subtitle="Edit your weekly template, manage date overrides, and block or reopen individual future slots."
      languageLabel="Doctor schedule in English"
    >
      <AvailabilityEditor
        doctor={doctor}
        state={state}
        title={`${doctor.fullName} schedule`}
        description="Changes here are reflected immediately in patient booking and admin scheduling views."
        onSaveTemplate={(payload) => actions.doctor.updateAvailability(doctor.id, payload)}
        onSaveOverride={(payload) => actions.doctor.updateScheduleOverride(doctor.id, payload)}
        onToggleSlot={(doctorId, date, slotId, nextStatus) =>
          actions.doctor.toggleSlotAvailability(doctorId, date, slotId, nextStatus)
        }
      />
    </AppShell>
  );
}
