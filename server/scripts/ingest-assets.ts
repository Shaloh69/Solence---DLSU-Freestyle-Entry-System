/**
 * Asset ingestion (Phase 2 brief §2.5): reads every meta.json under
 * client/public/assets/, uploads the item folder to Supabase Storage
 * (mirroring the local path), and upserts one component_library row per
 * item. Run once per new batch of downloaded assets:
 *
 *   npx tsx scripts/ingest-assets.ts            # from server/
 *   npx tsx scripts/ingest-assets.ts --dry-run  # print what would happen
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in server/.env —
 * exits with a clear message when Supabase isn't provisioned yet.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

const ASSETS_ROOT = path.resolve(
  import.meta.dirname,
  "../../client/public/assets"
);
const BUCKET = "assets";

interface AssetMeta {
  id: string;
  category: string;
  subtype: string;
  style_pack: string;
  dimensions_m: { width: number; depth: number; height: number };
  source: string;
  source_url: string;
  license: string;
  variant_of: string | null;
}

async function findMetaFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) found.push(...(await findMetaFiles(full)));
    else if (entry.name === "meta.json") found.push(full);
  }

  return found;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const metaFiles = await findMetaFiles(ASSETS_ROOT).catch(() => []);

  if (metaFiles.length === 0) {
    console.log(
      `No meta.json files under ${ASSETS_ROOT} — nothing to ingest. ` +
        "(Each placeable asset needs its own folder with model.glb + " +
        "thumbnail.png + meta.json; see the assets README.)"
    );

    return;
  }

  if (!dryRun && (!url || !key)) {
    console.error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (server/.env) — " +
        "Supabase isn't provisioned yet. Re-run with --dry-run to preview."
    );
    process.exit(1);
  }

  const supabase = dryRun ? null : createClient(url!, key!);

  for (const metaFile of metaFiles) {
    const meta: AssetMeta = JSON.parse(await readFile(metaFile, "utf-8"));
    const itemDir = path.dirname(metaFile);
    const relativeDir = path
      .relative(ASSETS_ROOT, itemDir)
      .split(path.sep)
      .join("/");
    const storagePath = `${relativeDir}/model.glb`;
    const thumbnailPath = `${relativeDir}/thumbnail.png`;

    if (dryRun) {
      console.log(`[dry-run] ${meta.id} -> ${BUCKET}/${storagePath}`);
      continue;
    }

    for (const file of ["model.glb", "thumbnail.png", "meta.json"]) {
      const body = await readFile(path.join(itemDir, file)).catch(() => null);

      if (!body) continue; // thumbnail may not exist yet — row still lands
      const { error } = await supabase!.storage
        .from(BUCKET)
        .upload(`${relativeDir}/${file}`, body, { upsert: true });

      if (error) throw new Error(`${meta.id}: upload ${file}: ${error.message}`);
    }

    const { error } = await supabase!.from("component_library").upsert({
      id: meta.id,
      category: meta.category,
      subtype: meta.subtype,
      style_pack: meta.style_pack,
      dimensions: meta.dimensions_m,
      storage_path: storagePath,
      thumbnail_path: thumbnailPath,
      license: meta.license,
      variant_of: meta.variant_of,
      updated_at: new Date().toISOString(),
    });

    if (error) throw new Error(`${meta.id}: upsert: ${error.message}`);
    console.log(`ingested ${meta.id}`);
  }

  console.log(`Done — ${metaFiles.length} item(s) processed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
