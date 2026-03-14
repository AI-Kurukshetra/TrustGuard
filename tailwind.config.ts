import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#08111f",
        steel: "#132238",
        pulse: "#08b6d9",
        alarm: "#fb923c",
        success: "#22c55e",
        surface: "#0e1729"
      },
      boxShadow: {
        panel: "0 24px 80px rgba(8, 17, 31, 0.28)"
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(148,163,184,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.09) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
