import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useDemoData } from "./DemoDataProvider";

/**
 * Reloads persisted demo state when entering the patient area so prescriptions,
 * tests, and notifications match localStorage after doctor approval or tab sync.
 */
export function PatientSessionSync() {
  const { actions } = useDemoData();

  useEffect(() => {
    actions.refresh();
  }, [actions]);

  return <Outlet />;
}
