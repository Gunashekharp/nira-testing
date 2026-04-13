import { motion } from "framer-motion";
import { AppShell } from "../../components/layout/AppShell";
import { DDIChecker } from "../shared/DDIChecker";
import { VitalsRecorder } from "../shared/VitalsRecorder";
import { ABHAPanel } from "../shared/ABHAPanel";
import { NearbyMap } from "../shared/NearbyMap";
import { AuditTrail } from "../shared/AuditTrail";
import { VoiceTranscription } from "../shared/VoiceTranscription";
import { Card, CardHeader } from "../../components/ui/Card";
import { useDemoData } from "../../app/DemoDataProvider";
import { getCurrentProfile } from "../shared/selectors";

export function AdvancedToolsPage() {
  const { state } = useDemoData();
  const profile = state ? getCurrentProfile(state) : null;

  return (
    <AppShell
      title="Advanced Clinical Tools"
      subtitle="AI-powered features — drug interaction checks, vitals, ABHA integration, voice input, nearby facilities, and audit compliance."
    >
      <div className="space-y-8">
        {/* Row 1: DDI + Vitals */}
        <div className="grid gap-8 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <DDIChecker />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <VitalsRecorder onSave={(data) => console.log("Vitals saved:", data)} />
          </motion.div>
        </div>

        {/* Row 2: ABHA + Voice */}
        <div className="grid gap-8 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <ABHAPanel patientName={profile?.fullName || "Patient"} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="p-6">
              <CardHeader
                eyebrow="AI Input"
                title="Voice Transcription"
                description="Speak symptoms or clinical notes — transcribed in real-time."
              />
              <div className="space-y-4">
                <VoiceTranscription language="en-IN" onTranscript={(t) => console.log("EN transcript:", t)} />
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Row 3: Map + Audit */}
        <div className="grid gap-8 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <NearbyMap />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <AuditTrail />
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
