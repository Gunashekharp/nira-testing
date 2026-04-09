import { Navigate, Route, Routes } from "react-router-dom";
import { useDemoData } from "./DemoDataProvider";
import { DoctorStatusGate, FirstAdminGate, GuestOnlyRoute, ProtectedRoute, RoleRoute, RootRedirect } from "./RouteGuards";
import { LoadingScreen } from "../features/shared/LoadingScreen";
import { AuthGatewayPage } from "../features/auth/AuthGatewayPage";
import { LoginPage } from "../features/auth/LoginPage";
import { SignupPage } from "../features/auth/SignupPage";
import { PatientHomePage } from "../features/patient/PatientHomePage";
import { PatientAppointmentsPage } from "../features/patient/PatientAppointmentsPage";
import { BookingPage } from "../features/patient/BookingPage";
import { InterviewPage } from "../features/patient/InterviewPage";
import { PrescriptionsPage } from "../features/patient/PrescriptionsPage";
import { PrescriptionDetailPage } from "../features/patient/PrescriptionDetailPage";
import { ProfilePage } from "../features/shared/ProfilePage";
import { DoctorDashboardPage } from "../features/doctor/DoctorDashboardPage";
import { DoctorAvailabilityPage } from "../features/doctor/DoctorAvailabilityPage";
import { DoctorChartPage } from "../features/doctor/DoctorChartPage";
import { AdminDashboardPage } from "../features/admin/AdminDashboardPage";
import { AdminDoctorsPage } from "../features/admin/AdminDoctorsPage";
import { AdminPatientsPage } from "../features/admin/AdminPatientsPage";
import { AdminAppointmentsPage } from "../features/admin/AdminAppointmentsPage";

export default function App() {
  const { loading } = useDemoData();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route element={<GuestOnlyRoute />}>
        <Route path="/auth" element={<AuthGatewayPage />} />
        <Route path="/auth/login/:role" element={<LoginPage />} />
        <Route path="/auth/signup/patient" element={<SignupPage />} />
        <Route path="/auth/signup/doctor" element={<SignupPage />} />
        <Route element={<FirstAdminGate />}>
          <Route path="/auth/signup/admin" element={<SignupPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute role="patient" />}>
          <Route path="/patient" element={<PatientHomePage />} />
          <Route path="/patient/appointments" element={<PatientAppointmentsPage />} />
          <Route path="/patient/appointments/:appointmentId" element={<PatientAppointmentsPage />} />
          <Route path="/patient/booking" element={<BookingPage />} />
          <Route path="/patient/interview/:appointmentId" element={<InterviewPage />} />
          <Route path="/patient/prescriptions" element={<PrescriptionsPage />} />
          <Route path="/patient/prescriptions/:prescriptionId" element={<PrescriptionDetailPage />} />
          <Route path="/patient/profile" element={<ProfilePage />} />
        </Route>

        <Route element={<RoleRoute role="doctor" />}>
          <Route path="/doctor/profile" element={<ProfilePage />} />
          <Route element={<DoctorStatusGate />}>
            <Route path="/doctor" element={<DoctorDashboardPage />} />
            <Route path="/doctor/availability" element={<DoctorAvailabilityPage />} />
            <Route path="/doctor/patient/:appointmentId" element={<DoctorChartPage />} />
          </Route>
        </Route>

        <Route element={<RoleRoute role="admin" />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/doctors" element={<AdminDoctorsPage />} />
          <Route path="/admin/patients" element={<AdminPatientsPage />} />
          <Route path="/admin/appointments" element={<AdminAppointmentsPage />} />
          <Route path="/admin/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
