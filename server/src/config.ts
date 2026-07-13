import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  /** solence-vision base URL (brief §7.4) — Express is its only caller. */
  visionUrl: process.env.VISION_URL ?? "http://localhost:8000",
};
