import { Link } from "react-router-dom";
import { ArrowRight, Building2, UserRound } from "lucide-react";
import { NiraLogo } from "../../components/ui/NiraLogo";
import { motion } from "framer-motion";
import { useTranslation } from "../../hooks/useTranslation";

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } }
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

export function AuthGatewayPage() {
  const { t } = useTranslation();

  const roles = [
    {
      role: "patient",
      icon: UserRound,
      title: t("patient"),
      description: "Book visits, complete pre-checks, and manage your health records.",
      href: "/auth/login/patient",
      color: "#00AAAE",
      bg: "from-[#00AAAE]/10 to-[#00AAAE]/5",
      border: "hover:border-[#00AAAE]/40",
      iconBg: "bg-[#00AAAE]/10 text-[#00AAAE]"
    },
    {
      role: "hospital",
      icon: Building2,
      title: "Hospital",
      description: "Open the hospital workspace for doctors, nurses, and admins.",
      href: "/auth/hospital",
      color: "#29355D",
      bg: "from-[#29355D]/10 to-[#29355D]/5",
      border: "hover:border-[#29355D]/40",
      iconBg: "bg-[#29355D]/10 text-[#29355D]"
    }
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-12">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-[#00AAAE]/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-[#29355D]/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-[#E63228]/3 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-3xl space-y-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <NiraLogo className="h-12" />
          </div>
          <div className="space-y-2">
            <span className="sr-only">Role-based clinic access</span>
            <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              {t("welcome")} NIRA
            </h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted sm:text-base">
              Choose Patient for visits and bookings, or Hospital for clinic staff access.
            </p>
          </div>
        </div>

        {/* Role cards */}
        <motion.div
          className="grid gap-4 sm:grid-cols-2"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {roles.map((entry) => {
            const Icon = entry.icon;
            return (
              <motion.div key={entry.role} variants={cardVariants}>
                <Link
                  to={entry.href}
                  className={`group relative flex items-start gap-4 rounded-2xl border border-line/60 bg-gradient-to-br ${entry.bg} p-5 transition-all duration-300 ${entry.border} hover:shadow-lg hover:-translate-y-0.5`}
                >
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${entry.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-ink">{entry.title}</h3>
                      <ArrowRight className="h-4 w-4 text-muted opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0.5" />
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">{entry.description}</p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Footer hint */}
        <div className="space-y-4 text-center">
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
            <Link to="/auth/login/patient" className="underline underline-offset-4">
              Patient login
            </Link>
            <Link to="/auth/signup/patient" className="underline underline-offset-4">
              Patient signup
            </Link>
            <Link to="/auth/hospital" className="underline underline-offset-4">
              Hospital access
            </Link>
          </div>
          <p className="text-xs text-muted/70">
            Powered by <span className="font-semibold text-[#00AAAE]">NIRA</span> AI Healthcare Platform
          </p>
        </div>
      </div>
    </div>
  );
}
