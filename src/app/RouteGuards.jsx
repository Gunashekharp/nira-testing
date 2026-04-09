import { Link, Navigate, Outlet } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { useDemoData } from "./DemoDataProvider";
import { getCurrentProfile, getRoleHomePath, hasAdminAccount } from "../features/shared/selectors";

export function RootRedirect() {
  const { state } = useDemoData();
  const path = state.session.isAuthenticated ? getRoleHomePath(state.session.role) : "/auth";
  return <Navigate to={path} replace />;
}

export function GuestOnlyRoute() {
  const { state } = useDemoData();

  if (state.session.isAuthenticated) {
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

  if (state.session.role !== role) {
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

  if (doctor?.status === "active") {
    return <Outlet />;
  }

  return (
    <AppShell
      title="Doctor workspace unavailable"
      subtitle="This account can sign in, but the clinic has not enabled clinical access yet."
      languageLabel="Doctor status in English"
    >
      <Card className="max-w-2xl">
        <CardHeader
          eyebrow="Account status"
          title={doctor?.status === "pending_approval" ? "Pending admin approval" : "Access blocked"}
          description={
            doctor?.status === "pending_approval"
              ? "Your doctor account has been created, but an admin still needs to approve it before the clinical queue and availability tools unlock."
              : "This doctor account is inactive or archived. Contact the clinic administrator for access."
          }
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
