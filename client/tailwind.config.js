import { heroui } from "@heroui/theme";

/**
 * Solence design tokens (section 4.3): dark navy + teal from the pitch
 * deck, warm amber accent for headers/highlights, applied through the
 * HeroUI theme so every component (cards, panels, modals, toasts)
 * shares the same palette instead of HeroUI defaults.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        brand: {
          navy: "#0B1B33",
          "navy-light": "#13294B",
          teal: "#14B8A6",
          "teal-dark": "#0D9488",
          amber: "#F59E0B",
        },
      },
      borderRadius: {
        panel: "0.75rem",
      },
      boxShadow: {
        panel: "0 4px 18px -6px rgb(0 0 0 / 0.25)",
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            primary: { DEFAULT: "#0D9488", foreground: "#FFFFFF" },
            secondary: { DEFAULT: "#13294B", foreground: "#FFFFFF" },
            focus: "#14B8A6",
          },
        },
        dark: {
          colors: {
            background: "#0B1B33",
            content1: "#13294B",
            primary: { DEFAULT: "#14B8A6", foreground: "#04211C" },
            secondary: { DEFAULT: "#F59E0B", foreground: "#331F00" },
            focus: "#14B8A6",
          },
        },
      },
    }),
  ],
};
