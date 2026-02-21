import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        primary: "var(--primary)",
        secondary: "var(--secondary)",
        success: "var(--success)",
        textPrimary: "var(--text-primary)",
        textSecondary: "var(--text-secondary)"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(47, 95, 206, 0.35), 0 14px 38px rgba(47, 95, 206, 0.2)",
        card: "0 18px 45px rgba(28, 34, 52, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.78)"
      },
      borderRadius: {
        xl2: "1.25rem"
      }
    }
  },
  plugins: []
};

export default config;
