/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: "#0a0b0d",
          900: "#111318",
          850: "#161920",
          800: "#1c2029",
          700: "#262b36",
          600: "#343b49",
          500: "#4a5265",
          400: "#6b7385",
          100: "#e4e6eb",
        },
        signal: {
          DEFAULT: "#3ddc84", // Android green, used sparingly as the one accent
          dim: "#2a9d5f",
        },
        alert: "#ff5d5d",
        amber: "#f5a623",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 0 0 1px rgba(255,255,255,0.04), 0 12px 32px rgba(0,0,0,0.45)",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.8" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        tapFlash: {
          "0%": { transform: "scale(0.4)", opacity: "0.9" },
          "100%": { transform: "scale(1.4)", opacity: "0" },
        },
      },
      animation: {
        pulseRing: "pulseRing 1.8s cubic-bezier(0.2,0.6,0.4,1) infinite",
        tapFlash: "tapFlash 380ms ease-out forwards",
      },
    },
  },
  plugins: [],
};
