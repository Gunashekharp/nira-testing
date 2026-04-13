import { Link } from "react-router-dom";
import { ArrowRight, HeartPulse, ShieldCheck, Stethoscope } from "lucide-react";
import { motion } from "framer-motion";
import { AppShell } from "../../components/layout/AppShell";
import { Card, CardHeader } from "../../components/ui/Card";
import { useDemoData } from "../../app/DemoDataProvider";

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } }
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

const hospitalRoles = [
  {
    role: "doctor",
    icon: Stethoscope,
    title: "Doctor",
    description: "Review queues, validate charts, and manage prescriptions.",
    bg: "from-[#29355D]/10 to-[#29355D]/5",
    border: "hover:border-[#29355D]/40",
    iconBg: "bg-[#29355D]/10 text-[#29355D]",
    loginLabel: "Doctor login",
    signupLabel: "Doctor signup"
  },
  {
    role: "nurse",
    icon: HeartPulse,
    title: "Nurse",
    description: "Record vitals, assist doctors, and coordinate patient care.",
    bg: "from-[#E63228]/10 to-[#E63228]/5",
    border: "hover:border-[#E63228]/40",
    iconBg: "bg-[#E63228]/10 text-[#E63228]",
    loginLabel: "Nurse login"
  },
  {
    role: "admin",
    icon: ShieldCheck,
    title: "Admin",
    description: "Manage staff, schedules, appointments, and clinic operations.",
    bg: "from-[#808080]/10 to-[#808080]/5",
    border: "hover:border-[#808080]/40",
    iconBg: "bg-[#808080]/10 text-[#808080]",
    loginLabel: "Admin login",
    signupLabel: ""
  }
];

export function AuthHospitalPage() {
  const { state, actions } = useDemoData();
  const showAdminSignup = state?.admins?.allIds?.length === 0;

  async function handleFirstAdminSetup() {
    await actions.dev.resetDemo("first-admin");
  }

  return (
    <AppShell title="Hospital access" subtitle="Choose the hospital user space you want to open." languageLabel="Auth in English">
      <div className="mx-auto max-w-5xl space-y-8">
        <Card>
          <CardHeader
            eyebrow="Hospital users"
            title="Choose your hospital role"
            description="This section groups the staff users together so the public entry point stays simple: Patient or Hospital."
          />

          <motion.div className="grid gap-4 md:grid-cols-3" variants={containerVariants} initial="hidden" animate="show">
            {hospitalRoles.map((entry) => {
              const Icon = entry.icon;

              return (
                <motion.div key={entry.role} variants={cardVariants}>
                  <div className={`group h-full rounded-2xl border border-line/60 bg-gradient-to-br ${entry.bg} p-5 transition-all duration-300 ${entry.border} hover:shadow-lg hover:-translate-y-0.5`}>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${entry.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-ink">{entry.title}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted">{entry.description}</p>
                    <div className="mt-5 space-y-2">
                      <Link
                        to={`/auth/login/${entry.role}`}
                        className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-white"
                      >
                        {entry.loginLabel}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      {entry.signupLabel && entry.role !== "nurse" ? (
                        <div>
                          <Link to={`/auth/signup/${entry.role}`} className="text-xs font-medium text-muted underline underline-offset-4">
                            {entry.signupLabel}
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </Card>

        <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
          <Link to="/auth" className="underline underline-offset-4">
            Back to auth
          </Link>
          {showAdminSignup ? (
            <Link to="/auth/signup/admin" className="underline underline-offset-4">
              First admin signup
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleFirstAdminSetup}
            className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition hover:bg-white"
          >
            First admin setup
          </button>
        </div>
      </div>
    </AppShell>
  );
}
