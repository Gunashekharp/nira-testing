import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Zap,
  Beaker,
} from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { useDemoData } from "../../app/DemoDataProvider";
import {
  getDoctorWorkspace,
} from "../shared/selectors";
import { formatTime } from "../../lib/format";
import { initials } from "../../lib/utils";
import { useEmrQueueFeed } from "../../hooks/useEmrQueueFeed";

export function UnifiedEMRValidationPage() {
  const navigate = useNavigate();
  const { appointmentId } = useParams();
  const { state } = useDemoData();
  const [selectedTab, setSelectedTab] = useState("overview");

  const { doctor, appointments } = getDoctorWorkspace(state);

  const {
    queue: liveQueue,
    loading: liveQueueLoading,
  } = useEmrQueueFeed(doctor?.fullName, {
    enabled: Boolean(doctor?.fullName),
    pollIntervalMs: 10000,
  });

  const liveQueueByEncounter = useMemo(() => {
    const entries = liveQueue.filter((entry) => entry?.encounter_fhir_id);
    return new Map(entries.map((entry) => [entry.encounter_fhir_id, entry]));
  }, [liveQueue]);

  const selectedAppointment = appointments.find(
    (apt) => apt.appointmentId === parseInt(appointmentId)
  );

  const selectedLiveData = selectedAppointment
    ? liveQueueByEncounter.get(selectedAppointment.encounter_fhir_id)
    : null;

  if (!selectedAppointment) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">Patient not found</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const handleBack = () => {
    navigate("/doctor/queue");
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-400 to-blue-500 text-white sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 mb-4 hover:opacity-90 transition"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Queue</span>
            </button>
            <div>
              <div className="text-sm font-semibold opacity-90 uppercase tracking-wide mb-2">
                Frontend-Only Clinical Demo
              </div>
              <h1 className="text-3xl font-bold mb-2">Unified EMR validation</h1>
              <p className="text-cyan-100">
                Review the APCI draft, edit clinical sections inline, capture
                doctor notes, and approve a patient-facing prescription without
                leaving this single workspace.
              </p>
            </div>
          </div>
        </div>

        {/* 3-Column Layout */}
        <div className="flex h-[calc(100vh-200px)]">
          {/* Left: Patient Queue (scrollable) */}
          <div className="w-96 border-r border-gray-200 bg-white overflow-y-auto">
            <div className="p-4 space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-3">
                Patients in Queue
              </h3>
              {appointments.map((apt) => (
                <motion.button
                  key={apt.appointmentId}
                  onClick={() =>
                    navigate(`/doctor/emr/unified/${apt.appointmentId}`)
                  }
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    apt.appointmentId === selectedAppointment.appointmentId
                      ? "bg-blue-50 border-blue-400 shadow-md"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                      {initials(apt.patientName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {apt.patientName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {apt.appointmentTime}
                      </p>
                    </div>
                  </div>
                  {apt.appointmentId === selectedAppointment.appointmentId && (
                    <div className="h-1 bg-blue-500 rounded-full mt-2 w-full"></div>
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Middle: Encounter Review (scrollable) */}
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="max-w-3xl mx-auto p-8 space-y-6">
              {/* Encounter Header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-6 mb-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedAppointment.patientName} · 32 yrs
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Dr. {doctor?.fullName} | booked | {selectedAppointment.tokenNumber}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-blue-100 text-blue-800">Encounter</Badge>
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                </div>
              </motion.div>

              {/* Chief Complaint */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="border-blue-100">
                  <CardHeader title="Chief complaint" />
                  <div className="px-6 py-4">
                    <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                      {selectedAppointment.chiefComplaint}
                    </p>
                  </div>
                </Card>
              </motion.div>

              {/* History / Subjective */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <Card>
                  <CardHeader title="History / subjective" />
                  <div className="px-6 py-4">
                    <textarea
                      defaultValue={
                        selectedLiveData?.history ||
                        "Patient reports epigastric burning with nausea, worse after spicy meals. No vomiting or melena."
                      }
                      className="w-full p-4 border border-gray-200 rounded-lg text-gray-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                    />
                  </div>
                </Card>
              </motion.div>

              {/* Examination / Objective */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card>
                  <CardHeader title="Examination / objective" />
                  <div className="px-6 py-4 space-y-4">
                    <textarea
                      defaultValue={
                        selectedLiveData?.examination ||
                        "Appears mildly uncomfortable. Vitals are stable."
                      }
                      className="w-full p-4 border border-gray-200 rounded-lg text-gray-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs text-gray-600">Temperature</p>
                        <p className="font-semibold text-gray-900">98.4 F</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs text-gray-600">BP</p>
                        <p className="font-semibold text-gray-900">120/80</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs text-gray-600">HR</p>
                        <p className="font-semibold text-gray-900">84 bpm</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs text-gray-600">O2 Sat</p>
                        <p className="font-semibold text-gray-900">99%</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>

              {/* Assessment */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <Card>
                  <CardHeader title="Assessment" />
                  <div className="px-6 py-4">
                    <textarea
                      defaultValue={
                        selectedLiveData?.assessment ||
                        "Likely acute gastritis; reflux flare remains possible."
                      }
                      className="w-full p-4 border border-gray-200 rounded-lg text-gray-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                </Card>
              </motion.div>

              {/* Plan */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card>
                  <CardHeader title="Plan" />
                  <div className="px-6 py-4">
                    <textarea
                      defaultValue={
                        selectedLiveData?.plan ||
                        "Hydration advice, acid suppression, avoid trigger foods, review response in 5 days."
                      }
                      className="w-full p-4 border border-gray-200 rounded-lg text-gray-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                </Card>
              </motion.div>

              {/* Prescription Draft */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <Card className="border-green-100 bg-green-50">
                  <CardHeader 
                    title="Prescription draft"
                    eyebrow={<CheckCircle2 className="w-5 h-5 text-green-600 inline mr-2" />}
                  />
                  <div className="px-6 py-4">
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded-lg border border-green-200">
                        <p className="font-medium text-gray-900">
                          Pantoprazo 40 mg
                        </p>
                        <p className="text-sm text-gray-600">
                          Once daily for 5 days · After food
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          Reduce gastric acid irritation
                        </p>
                      </div>
                    </div>
                    <Button className="w-full mt-4 bg-green-600 hover:bg-green-700">
                      Approve & Publish Rx
                    </Button>
                  </div>
                </Card>
              </motion.div>
            </div>
          </div>

          {/* Right: Care Side Panel */}
          <div className="w-80 border-l border-gray-200 bg-gradient-to-b from-white to-gray-50 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-6 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Care Side Panel
              </h3>
              <p className="text-sm text-gray-700 font-medium">Lab workflow</p>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* AI Signals & Safety */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-500" />
                  AI signals & safety
                </h4>
                <div className="space-y-2">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-blue-900">
                      ✓ No DDI risk detected
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-blue-900">
                      ✓ Renal function adequate
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Suggested Tests */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Beaker className="w-4 h-4 text-amber-500" />
                  Suggested tests
                </h4>
                <div className="space-y-2">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="font-medium text-gray-900 text-sm">
                      Complete Blood Count
                    </p>
                    <p className="text-xs text-gray-600">HEMATOLOGY</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="font-medium text-gray-900 text-sm">
                      Liver Function Test
                    </p>
                    <p className="text-xs text-gray-600">BIOCHEMISTRY</p>
                  </div>
                </div>
              </motion.div>

              {/* Edit Lab Request */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
                  Edit Lab Request
                </h4>
                <p className="text-xs text-gray-600 mb-3">
                  You can still update or cancel this request until sample
                  collection begins.
                </p>
                <Button
                  variant="outline"
                  className="w-full bg-cyan-50 border-cyan-200 text-cyan-900 hover:bg-cyan-100"
                >
                  Edit Tests
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
