import { Link, Navigate, Outlet } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { useDemoData } from "./DemoDataProvider";
import { getCurrentProfile, getRoleHomePath, hasAdminAccount } from "../features/shared/selectors";

const VALID_ROLES = new Set(["patient", "doctor", "nurse", "admin"]);

function hasValidRole(role) {
  return VALID_ROLES.has(role);
}

export function RootRedirect() {
  const { state } = useDemoData();
  const path = state.session.isAuthenticated && hasValidRole(state.session.role) ? getRoleHomePath(state.session.role) : "/auth";
  return <Navigate to={path} replace />;
}

export function GuestOnlyRoute() {
  const { state } = useDemoData();

  if (state.session.isAuthenticated && hasValidRole(state.session.role)) {
    return <Navigate to={getRoleHomePath(state.session.role)} replace />;
  }

  return <Outlet />;
}

export function ProtectedRoute() {
  const { state } = useDemoData();

  if (!state.session.isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}

export function RoleRoute({ role }) {
  const { state } = useDemoData();

  if (!hasValidRole(state.session.role) || state.session.role !== role) {
    return <Navigate to={getRoleHomePath(state.session.role)} replace />;
  }

  return <Outlet />;
}

export function FirstAdminGate() {
  const { state } = useDemoData();

  if (hasAdminAccount(state)) {
    return <Navigate to="/auth/login/admin" replace />;
  }

  return <Outlet />;
}

export function DoctorStatusGate() {
  const { state } = useDemoData();
  const doctor = getCurrentProfile(state);
  const normalizedStatus = String(doctor?.status || "").toLowerCase();
  const isActive = ["active", "approved"].includes(normalizedStatus);
  const isPending = ["pending_approval", "pending"].includes(normalizedStatus);

  // Allow pending doctors to access workspace with restricted view
  if (isActive || isPending) {
    return <Outlet />;
  }

  // Block access for inactive/archived accounts
  return (
    <AppShell
      title="Doctor workspace unavailable"
      subtitle="This account is not active. Contact the clinic administrator for access."
      languageLabel="Doctor status in English"
    >
      <Card className="max-w-2xl">
        <CardHeader
          eyebrow="Account status"
          title="Access blocked"
          description="This doctor account is inactive or archived. Contact the clinic administrator for access."
          actions={
            <Button asChild variant="secondary">
              <Link to="/auth">Back to auth</Link>
            </Button>
          }
        />
      </Card>
    </AppShell>
  );
}
