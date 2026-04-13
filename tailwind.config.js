/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        brand: {
          midnight: "var(--brand-midnight)",
          tide: "var(--brand-tide)",
          sky: "var(--brand-sky)",
          mint: "var(--brand-mint)",
          amber: "var(--brand-amber)",
          coral: "var(--brand-coral)",
          accent: "var(--brand-accent)"
        }
      },
      fontFamily: {
        sans: ["Manrope", "Noto Sans Devanagari", "Segoe UI", "sans-serif"],
        display: ["Manrope", "Noto Sans Devanagari", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"]
      },
      boxShadow: {
        panel: "0 0 0 1px rgba(10,24,56,0.06), 0 18px 42px -22px rgba(41,53,93,0.2)",
        elevated: "0 0 0 1px rgba(10,24,56,0.08), 0 26px 58px -28px rgba(20,34,72,0.34)",
        soft: "0 2px 8px rgba(41,53,93,0.06)",
        md: "0 4px 16px rgba(41,53,93,0.08)",
        glow: "0 0 20px rgba(0,170,174,0.15)",
        "glow-lg": "0 0 40px rgba(230,50,40,0.12)"
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(circle at 0% 0%, rgba(0,170,174,0.06), transparent 50%), radial-gradient(circle at 100% 100%, rgba(230,50,40,0.04), transparent 50%)"
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
        "4xl": "24px"
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-soft": "pulseSoft 3s ease-in-out infinite"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" }
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" }
        }
      }
    }
  },
  plugins: []
};
