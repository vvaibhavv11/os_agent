/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        chat: {
          bg: "#1d2021",
          sidebar: "#1d2021",
          surface: "#3c3836",
          border: "#504945",
          accent: "#83a598",
          "accent-hover": "#8ec07c",
          text: "#ebdbb2",
          "text-muted": "#928374",
          "user-bubble": "#83a598",
          "ai-bubble": "#3c3836",
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
