import type { Config } from "tailwindcss";

// Scandinavian + football era: minimal, clean, Nordic palette
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Scandinavian base
        nord: {
          snow: "#ECEFF4",
          frost: "#8FBCBB",
          frostLight: "#88C0D0",
          frostMid: "#81A1C1",
          frostDark: "#5E81AC",
          polar: "#2E3440",
          polarMid: "#3B4252",
          polarLight: "#434C5E",
          polarLighter: "#4C566A",
        },
        // Football era accents (muted, not loud)
        pitch: {
          grass: "#4A7C59",
          grassLight: "#6B9B7A",
          line: "#2D4A3E",
          white: "#F8FAF6",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
