import { Navigate, Route, Routes } from "react-router-dom";
import { useDemoData } from "./DemoDataProvider";
import { PatientSessionSync } from "./PatientSessionSync";
import { DoctorStatusGate, FirstAdminGate, GuestOnlyRoute, ProtectedRoute, RoleRoute, RootRedirect } from "./RouteGuards";
import { LoadingScreen } from "../features/shared/LoadingScreen";
import { AuthGatewayPage } from "../features/auth/AuthGatewayPage";
import { AuthHospitalPage } from "../features/auth/AuthHospitalPage";
import { LoginPage } from "../features/auth/LoginPage";
import { SignupPage } from "../features/auth/SignupPage";
import { PatientHomePage } from "../features/patient/PatientHomePage";
import { PatientAppointmentsPage } from "../features/patient/PatientAppointmentsPage";
import { BookingPage } from "../features/patient/BookingPage";
import { PrescriptionsPage } from "../features/patient/PrescriptionsPage";
import { PrescriptionDetailPage } from "../features/patient/PrescriptionDetailPage";
import { LabReportsPage } from "../features/patient/LabReportsPage";
import { PatientTestsPage } from "../features/patient/PatientTestsPage";
import { ProfilePage } from "../features/shared/ProfilePage";
import { DoctorDashboardPage } from "../features/doctor/DoctorDashboardPage";
import { DoctorAvailabilityPage } from "../features/doctor/DoctorAvailabilityPage";
import { DoctorChartPage } from "../features/doctor/DoctorChartPage";
import { DoctorLabReportsPage } from "../features/doctor/DoctorLabReportsPage";
import { AdminDashboardPage } from "../features/admin/AdminDashboardPage";
import { AdminDoctorsPage } from "../features/admin/AdminDoctorsPage";
import { AdminAdminsPage } from "../features/admin/AdminAdminsPage";
import { AdminPatientsPage } from "../features/admin/AdminPatientsPage";
import { AdminAppointmentsPage } from "../features/admin/AdminAppointmentsPage";
import { AdvancedToolsPage } from "../features/shared/AdvancedToolsPage";
import { AIChatBox } from "../features/shared/AIChatBox";
import { NurseDashboardPage } from "../features/nurse/NurseDashboardPage";
import { QueueControlPage } from "../features/doctor/QueueControlPage";

export default function App() {
  const { loading } = useDemoData();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        <Route element={<GuestOnlyRoute />}>
          <Route path="/auth" element={<AuthGatewayPage />} />
          <Route path="/auth/hospital" element={<AuthHospitalPage />} />
          <Route path="/auth/login/:role" element={<LoginPage />} />
          <Route path="/auth/signup/patient" element={<SignupPage />} />
          <Route path="/auth/signup/doctor" element={<SignupPage />} />
          <Route element={<FirstAdminGate />}>
            <Route path="/auth/signup/admin" element={<SignupPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<RoleRoute role="patient" />}>
            <Route element={<PatientSessionSync />}>
              <Route path="/patient" element={<PatientHomePage />} />
              <Route path="/patient/appointments" element={<PatientAppointmentsPage />} />
              <Route path="/patient/appointments/:appointmentId" element={<PatientAppointmentsPage />} />
              <Route path="/patient/booking" element={<BookingPage />} />
              <Route path="/patient/prescriptions" element={<PrescriptionsPage />} />
              <Route path="/patient/prescriptions/:prescriptionId" element={<PrescriptionDetailPage />} />
              <Route path="/patient/tests" element={<PatientTestsPage />} />
              <Route path="/patient/lab-reports" element={<LabReportsPage />} />
              <Route path="/patient/profile" element={<ProfilePage />} />
            </Route>
          </Route>

          <Route element={<RoleRoute role="doctor" />}>
            <Route path="/doctor/profile" element={<ProfilePage />} />
            <Route element={<DoctorStatusGate />}>
              <Route path="/doctor" element={<DoctorDashboardPage />} />
              <Route path="/doctor/availability" element={<DoctorAvailabilityPage />} />
              <Route path="/doctor/patient/:appointmentId" element={<DoctorChartPage />} />
              <Route path="/doctor/lab-reports" element={<DoctorLabReportsPage />} />
              <Route path="/doctor/tools" element={<AdvancedToolsPage />} />
              <Route path="/doctor/queue" element={<QueueControlPage />} />
              <Route path="/doctor/emr/unified/:appointmentId" element={<DoctorChartPage />} />
            </Route>
          </Route>

          <Route element={<RoleRoute role="admin" />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/admins" element={<AdminAdminsPage />} />
            <Route path="/admin/doctors" element={<AdminDoctorsPage />} />
            <Route path="/admin/patients" element={<AdminPatientsPage />} />
            <Route path="/admin/appointments" element={<AdminAppointmentsPage />} />
            <Route path="/admin/tools" element={<AdvancedToolsPage />} />
            <Route path="/admin/profile" element={<ProfilePage />} />
          </Route>

          <Route element={<RoleRoute role="nurse" />}>
            <Route path="/nurse" element={<NurseDashboardPage />} />
            <Route path="/nurse/tools" element={<AdvancedToolsPage />} />
            <Route path="/nurse/profile" element={<ProfilePage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AIChatBox />
    </>
  );
}
