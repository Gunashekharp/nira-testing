import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Filter,
  ChevronRight,
  Zap,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useDemoData } from "../../app/DemoDataProvider";
import { getDoctorWorkspace } from "../shared/selectors";
import { formatStatus, formatTime } from "../../lib/format";
import { initials } from "../../lib/utils";
import { useEmrQueueFeed } from "../../hooks/useEmrQueueFeed";
import { useTranslation } from "../../hooks/useTranslation";

export function QueueControlPage() {
  const navigate = useNavigate();
  const { state } = useDemoData();
  const { t } = useTranslation();

  const [filter, setFilter] = useState("all");

  const filters = [
    { key: "all", label: t("allPatients"), icon: Filter },
    { key: "pre_check", label: t("preCheckStage"), icon: Clock },
    { key: "in_consult", label: t("underConsultation"), icon: Zap },
    { key: "approved", label: t("completedToday"), icon: CheckCircle2 },
  ];

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

  const isPreCheckDone = (item) =>
    ["complete", "completed"].includes(
      String(item?.interview?.completionStatus || "").toLowerCase()
    );

  const getQueueDisplayStatus = (item) => {
    if (item.queueStatus === "approved" || item.bookingStatus === "completed")
      return t("completedToday");
    if (item.queueStatus === "in_consult") return t("underConsultation");
    if (isPreCheckDone(item) || item.queueStatus === "ai_ready")
      return t("aiChatCompleted");
    return formatStatus(item.queueStatus);
  };

  const filteredQueue = appointments.filter((apt) => {
    if (filter === "all") return true;
    if (filter === "pre_check") return apt.queueStatus === "awaiting_interview";
    if (filter === "in_consult") return apt.queueStatus === "in_consult";
    if (filter === "approved")
      return apt.queueStatus === "approved" || apt.bookingStatus === "completed";
    return true;
  });

  const getStatusBadge = (status) => {
    if (status === "approved" || status === "completed")
      return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
    if (status === "in_consult")
      return <Badge className="bg-blue-100 text-blue-800">In Consult</Badge>;
    if (status === "ai_ready")
      return <Badge className="bg-cyan-100 text-cyan-800">AI Ready</Badge>;
    return <Badge className="bg-gray-100 text-gray-800">Awaiting</Badge>;
  };

  const handlePatientClick = (appointmentId) => {
    navigate(`/doctor/emr/unified/${appointmentId}`);
  };

  const getChiefComplaintDisplay = (apt) => {
    const complaint = String(apt?.chiefComplaint || "").trim();
    const isPendingSymptomNote = /pending symptom (interview|check)/i.test(complaint) || /interview pending/i.test(complaint);
    if (apt?.queueStatus === "awaiting_interview" && isPendingSymptomNote) {
      return "-";
    }
    return complaint || "-";
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-white">
        {/* Header Section */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-cyan-600 tracking-wide uppercase">
                  Queue Control
                </span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">
                Dr. {doctor?.fullName || "Doctor"}
              </h1>
              <p className="text-gray-600">
                {doctor?.specialization || "Internal Medicine"}
              </p>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Use the filter chips to focus on the next patients who need
              your attention.
            </p>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {filters.map((f) => (
                <motion.button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                    filter === f.key
                      ? "bg-blue-900 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <f.icon className="w-4 h-4" />
                  {f.label}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Queue Table */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {liveQueueLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-cyan-600 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-gray-600">Loading patient queue...</p>
              </div>
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No patients in this queue</p>
              </div>
            </div>
          ) : (
            <motion.div
              className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Patient
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Queue status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Token & time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        ABHA
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Chief complaint
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Flags
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Open
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredQueue.map((apt) => {
                      const liveData = liveQueueByEncounter.get(
                        apt.encounter_fhir_id
                      );
                      const flagCount = liveData?.alerts?.length || 0;

                      return (
                        <tr
                          key={apt.appointmentId}
                          className="hover:bg-cyan-50/50 transition-colors"
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3 min-w-[220px]">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                {initials(apt.patientName)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 truncate">
                                  {apt.patientName}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 min-w-[190px]">
                            <div className="space-y-1">
                              {getStatusBadge(apt.queueStatus)}
                              <p className="text-xs text-gray-500">
                                {getQueueDisplayStatus(apt)}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700 min-w-[160px]">
                            <p className="font-medium">{apt.tokenNumber || "-"}</p>
                            <p className="text-xs text-gray-500">
                              {apt.appointmentTime || formatTime(apt.appointmentDateTime)}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700 min-w-[180px]">
                            {apt.abhaId || apt.abha || "-"}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-800 min-w-[240px]">
                            {getChiefComplaintDisplay(apt)}
                          </td>
                          <td className="px-4 py-4 min-w-[100px]">
                            {flagCount > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded-md">
                                <AlertCircle className="w-3 h-3" />
                                {flagCount}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <Button
                              variant="secondary"
                              className="h-8 px-3"
                              onClick={() => handlePatientClick(apt.appointmentId)}
                            >
                              <span className="text-xs">Open</span>
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
