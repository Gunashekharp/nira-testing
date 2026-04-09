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
          coral: "var(--brand-coral)"
        }
      },
      fontFamily: {
        sans: ["Manrope", "Noto Sans Devanagari", "Segoe UI", "sans-serif"],
        display: ["Manrope", "Noto Sans Devanagari", "Segoe UI", "sans-serif"]
      },
      boxShadow: {
        panel: "0 24px 80px rgba(12, 38, 54, 0.16)",
        soft: "0 10px 30px rgba(12, 38, 54, 0.08)"
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(circle at top left, rgba(82, 191, 196, 0.24), transparent 42%), radial-gradient(circle at bottom right, rgba(245, 193, 104, 0.18), transparent 32%)"
      },
      animation: {
        float: "float 7s ease-in-out infinite"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" }
        }
      }
    }
  },
  plugins: []
};
