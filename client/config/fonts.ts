/**
 * Typography per /DESIGN.md §3:
 *  - Space Grotesk — display/headlines
 *  - IBM Plex Sans — body/UI
 *  - JetBrains Mono — numeric/technical (schedules, status bar, coords)
 */
import {
  IBM_Plex_Sans as FontSans,
  JetBrains_Mono as FontMono,
  Space_Grotesk as FontDisplay,
} from "next/font/google";

export const fontSans = FontSans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const fontDisplay = FontDisplay({
  subsets: ["latin"],
  variable: "--font-display",
});
