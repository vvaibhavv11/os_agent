/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        chat: {
          bg: "#0f172a",
          sidebar: "#0b1120",
          surface: "#1e293b",
          border: "#334155",
          accent: "#818cf8",
          "accent-hover": "#a5b4fc",
          text: "#f1f5f9",
          "text-muted": "#64748b",
          "user-bubble": "#6366f1",
          "ai-bubble": "#1e293b",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-dot": "pulseDot 1.4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%, 80%, 100%": { transform: "scale(0.6)" },
          "40%": { transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
