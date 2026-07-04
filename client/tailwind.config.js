import { heroui } from "@heroui/theme";

/**
 * Solence design tokens — the implementation of /DESIGN.md §2–§6.
 * Do not add colors/radii/shadows here that DESIGN.md doesn't list;
 * change DESIGN.md first, then this file.
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
        display: ["var(--font-display)"],
      },
      colors: {
        brand: {
          navy: "#0B1B33",
          "navy-light": "#13294B",
          "navy-raised": "#1B3358",
          "navy-border": "#24406B",
          teal: "#14B8A6",
          "teal-dark": "#0D9488",
          amber: "#F59E0B",
          "amber-dark": "#B45309",
        },
      },
      borderRadius: {
        panel: "10px",
        control: "6px",
        chip: "2px",
      },
      boxShadow: {
        // Floating elements only (modals, popovers, toasts, drag ghosts)
        // — docked panels separate with borders, not shadows (DESIGN.md §4).
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
            background: "#F4F6FA",
            content1: "#FFFFFF",
            content2: "#EDF1F7",
            foreground: "#14213A",
            primary: { DEFAULT: "#0D9488", foreground: "#FFFFFF" },
            secondary: { DEFAULT: "#B45309", foreground: "#FFFFFF" },
            success: { DEFAULT: "#22C55E", foreground: "#052E12" },
            warning: { DEFAULT: "#F59E0B", foreground: "#331F00" },
            danger: { DEFAULT: "#E15759", foreground: "#FFFFFF" },
            focus: "#0D9488",
          },
        },
        dark: {
          colors: {
            background: "#0B1B33",
            content1: "#13294B",
            content2: "#1B3358",
            foreground: "#E6EDF7",
            primary: { DEFAULT: "#14B8A6", foreground: "#04211C" },
            secondary: { DEFAULT: "#F59E0B", foreground: "#331F00" },
            success: { DEFAULT: "#22C55E", foreground: "#052E12" },
            warning: { DEFAULT: "#F59E0B", foreground: "#331F00" },
            danger: { DEFAULT: "#E15759", foreground: "#FFFFFF" },
            focus: "#14B8A6",
          },
        },
      },
    }),
  ],
};
