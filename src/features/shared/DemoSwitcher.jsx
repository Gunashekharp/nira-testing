import { RotateCcw } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Field, Select } from "../../components/ui/FormFields";
import { useDemoData } from "../../app/DemoDataProvider";

export function DemoSwitcher() {
  const { state, actions } = useDemoData();

  if (!state) {
    return null;
  }

  return (
    <div className="glass-card flex flex-wrap items-end gap-4 p-4 lg:p-5">
      <Field label="Role">
        <Select
          value={state.demoSession.role}
          onChange={(event) => actions.setRole(event.target.value)}
          className="min-w-[140px]"
        >
          <option value="patient">Patient view</option>
          <option value="doctor">Doctor view</option>
        </Select>
      </Field>
      <Field label="Patient persona">
        <Select
          value={state.demoSession.activePatientId}
          onChange={(event) => actions.setActivePatient(event.target.value)}
          className="min-w-[220px]"
        >
          {state.patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.fullName}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Doctor persona">
        <Select
          value={state.demoSession.activeDoctorId}
          onChange={(event) => actions.setActiveDoctor(event.target.value)}
          className="min-w-[220px]"
        >
          {state.doctors.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.fullName}
            </option>
          ))}
        </Select>
      </Field>
      <Button variant="secondary" onClick={actions.reset} className="ml-auto">
        <RotateCcw className="h-4 w-4" />
        Reset demo
      </Button>
    </div>
  );
}
