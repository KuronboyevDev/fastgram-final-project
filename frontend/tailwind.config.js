/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // FastGram brand palette — deliberately NOT Instagram's pink/purple.
        // A fresh teal → cyan → indigo identity on a clean slate canvas.
        brand: {
          50: "#ecfeff",
          100: "#cffafe",
          400: "#22d3ee",
          500: "#06b6d4", // primary cyan-teal
          600: "#0891b2",
          700: "#0e7490",
        },
        ink: {
          DEFAULT: "#0f172a", // slate-900 text
          soft: "#475569", // slate-600
          faint: "#94a3b8", // slate-400
        },
      },
      fontFamily: {
        brand: ["var(--font-poppins)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #06b6d4 0%, #14b8a6 50%, #6366f1 100%)",
      },
    },
  },
  plugins: [],
};
