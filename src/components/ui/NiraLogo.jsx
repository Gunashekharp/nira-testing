import { cn } from "../../lib/utils";

export function NiraLogo({ className = "h-10", showText = true }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {/* Icon mark: rounded square with N cutout */}
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto flex-shrink-0">
        <rect width="40" height="40" rx="10" fill="#29355D" />
        <path
          d="M11 29V11H15.5L24.5 24V11H29V29H24.5L15.5 16V29H11Z"
          fill="white"
        />
        <circle cx="33" cy="7" r="4" fill="#E63228" />
      </svg>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className="text-[21px] font-extrabold tracking-[-0.02em]" style={{ fontFamily: "Manrope, sans-serif" }}>
            <span className="text-[#00AAAE]">N</span><span className="text-[#29355D]">I</span><span className="text-[#29355D]">R</span><span className="text-[#E63228]">A</span>
          </span>
          <span className="text-[7.5px] font-bold uppercase tracking-[0.28em] text-[#808080] mt-[1px]">
            AI Healthcare Platform
          </span>
        </div>
      )}
    </div>
  );
}

export function NiraLogoMini({ className = "h-8" }) {
  return <NiraLogo className={className} showText={false} />;
}
