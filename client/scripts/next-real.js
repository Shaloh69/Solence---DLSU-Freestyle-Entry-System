/**
 * Launches Next.js with the client directory resolved to its REAL path.
 *
 * C:\Projects is an NTFS junction to D:\Projects-Shem. When Next runs
 * with a junction-spelled cwd (C:\Projects\Solence\client), parts of it
 * resolve the real (D:) path while others keep the cwd (C:) path; the
 * two get joined across drive letters and .next manifest lookups break
 * (ENOENT routes-manifest.json with a doubled path). Resolving the cwd
 * up front gives Next one consistent spelling from either launch path.
 *
 * Usage: node scripts/next-real.js <next args...>
 */
const { realpathSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const realDir = realpathSync.native(path.join(__dirname, ".."));
const nextBin = path.join(
  realDir,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next"
);

const result = spawnSync(
  process.execPath,
  [nextBin, ...process.argv.slice(2)],
  { cwd: realDir, stdio: "inherit" }
);

process.exit(result.status ?? 1);
