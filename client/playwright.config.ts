/**
 * Playwright E2E (W4). Starts its own API and web server on separate
 * ports so it never touches a dev session or a real database:
 *   - API :4100 with empty Supabase vars → in-memory storage
 *     (dotenv never overrides a variable that is already set)
 *   - web :3100 pointed at that API
 * PW_CHROMIUM_PATH, if set, selects the Chromium binary.
 * Results and reports go to ../.artifacts/playwright (gitignored).
 */
import { defineConfig } from "@playwright/test";

const API_PORT = 4100;
const WEB_PORT = 3100;
const chromiumPath = process.env.PW_CHROMIUM_PATH;

export const API_URL = `http://localhost:${API_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../.artifacts/playwright/results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "../.artifacts/playwright/report", open: "never" }],
  ],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    viewport: { width: 1440, height: 900 },
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  webServer: [
    {
      command: "npm run dev --prefix ../server",
      url: `${API_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PORT: String(API_PORT),
        SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        DEFAULT_TIER: "pro",
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
      },
    },
    {
      command: `node scripts/next-real.js dev --turbopack -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 240_000,
      env: { NEXT_PUBLIC_API_URL: API_URL },
    },
  ],
});
