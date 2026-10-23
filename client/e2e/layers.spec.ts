/**
 * W4 — layer views on a real ResPlan house (WIRING-AUDIT §5, F-19).
 *
 * Every 2D element carries `data-layer`; presets equal the same manual
 * toggles; a locked layer can't be selected; layer state survives a
 * reload; furniture visibly changes the 3D view; no console errors.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PNG } from "pngjs";

import { LAYER_KEYS, LAYER_PRESETS, type LayerKey } from "../lib/layers";
import { API_URL } from "../playwright.config";
import { createRealProject, type RealProject } from "./helpers/real-project";

const LABELS: Record<LayerKey, string> = {
  walls: "Walls & openings",
  rooms: "Rooms",
  loads: "Loads",
  lighting: "Lighting fixtures",
  furniture: "Furniture",
  wiring: "Wiring",
  heatmap: "Lux heatmap",
  violations: "Violation highlights",
};

let project: RealProject;
const consoleErrors: string[] = [];

test.beforeAll(async ({ request }) => {
  project = await createRealProject(request, API_URL);
});

test.beforeEach(async ({ page }) => {
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
});

test.afterEach(() => {
  expect(consoleErrors, "console errors").toEqual([]);
  consoleErrors.length = 0;
});

async function openEditor(page: Page, query = "") {
  await page.goto(`/projects/${project.id}/editor${query}`);
  await expect(page.getByRole("application", { name: "Floor plan editor canvas" })).toBeVisible();
  await expect(page.locator('[data-layer="walls"]').first()).toBeAttached();
}

async function counts(page: Page): Promise<Record<LayerKey, number>> {
  const out = {} as Record<LayerKey, number>;

  for (const key of LAYER_KEYS) out[key] = await page.locator(`svg [data-layer="${key}"]`).count();

  return out;
}

/** Share of pixels whose RGB differs by more than a small tolerance. */
function changedFraction(a: PNG, b: PNG): number {
  let changed = 0;

  for (let i = 0; i < a.data.length; i += 4) {
    const d =
      Math.abs(a.data[i] - b.data[i]) +
      Math.abs(a.data[i + 1] - b.data[i + 1]) +
      Math.abs(a.data[i + 2] - b.data[i + 2]);

    if (d > 24) changed++;
  }

  return changed / (a.width * a.height);
}

/** Share of pixels that differ from the corner (background) colour — 0 for a blank canvas. */
function sceneCoverage(img: PNG): number {
  const [r, g, b] = [img.data[0], img.data[1], img.data[2]];
  let differing = 0;

  for (let i = 0; i < img.data.length; i += 4) {
    if (Math.abs(img.data[i] - r) + Math.abs(img.data[i + 1] - g) + Math.abs(img.data[i + 2] - b) > 24) differing++;
  }

  return differing / (img.width * img.height);
}

async function setLayer(page: Page, key: LayerKey, visible: boolean) {
  const box = page.getByRole("checkbox", { name: LABELS[key] }).first();

  if ((await box.isChecked()) !== visible) await box.click({ force: true });
  await expect(box).toBeChecked({ checked: visible });
}

test("every layer has real content and toggles only its own elements", async ({ page }) => {
  await openEditor(page, "?view=all");
  const all = await counts(page);

  for (const key of ["walls", "rooms", "loads", "lighting", "furniture", "wiring", "heatmap"] as LayerKey[]) {
    expect(all[key], `${key} elements`).toBeGreaterThan(0);
  }
  for (const key of LAYER_KEYS) {
    await setLayer(page, key, false);
    const now = await counts(page);

    expect(now[key], `${key} hidden`).toBe(0);
    for (const other of LAYER_KEYS) if (other !== key) expect(now[other], `${other} untouched by ${key}`).toBe(all[other]);
    await setLayer(page, key, true);
  }
});

for (const preset of LAYER_PRESETS) {
  test(`preset "${preset.label}" equals the same manual toggles`, async ({ page }) => {
    await openEditor(page, `?view=${preset.id}`);
    const viaPreset = await counts(page);

    await openEditor(page, "?view=all");
    for (const key of LAYER_KEYS) await setLayer(page, key, preset.layers[key]);
    expect(await counts(page)).toEqual(viaPreset);
    for (const key of LAYER_KEYS) if (!preset.layers[key]) expect(viaPreset[key], `${preset.id} hides ${key}`).toBe(0);
  });
}

test("a locked layer can't be selected; unlocked it can", async ({ page }) => {
  const piece = () => page.locator('svg [data-layer="furniture"]').first();

  await openEditor(page, "?view=all&lock=furniture");
  await piece().click({ force: true });
  await expect(page.locator('svg [data-selected="true"]')).toHaveCount(0);

  // Locks are saved per project too, so unlock explicitly.
  await openEditor(page, "?view=all&lock=");
  await piece().click({ force: true });
  await expect(page.locator('svg [data-layer="furniture"][data-selected="true"]')).toHaveCount(1);
});

test("layer visibility is saved per project", async ({ page }) => {
  await openEditor(page, "?view=all");
  await setLayer(page, "furniture", false);
  await openEditor(page); // no ?view — the saved state applies
  expect((await counts(page)).furniture).toBe(0);
  expect((await counts(page)).walls).toBeGreaterThan(0);
  await setLayer(page, "furniture", true);
});

test("furniture visibly changes the 3D view", async ({ page }) => {
  const canvas = page.locator("canvas").first();
  // The 3D view loads and animates in: a blank (flat-colour) canvas first,
  // then the scene. Capture only a frame that shows a scene (not one flat
  // fill) and that the next frame agrees with.
  const shot = async () => {
    await expect(canvas).toBeVisible();
    let frame = PNG.sync.read(await canvas.screenshot());

    await expect
      .poll(
        async () => {
          const next = PNG.sync.read(await canvas.screenshot());
          const stable = changedFraction(frame, next) === 0;

          frame = next;

          return stable && sceneCoverage(frame) > 0.05;
        },
        { timeout: 60_000 },
      )
      .toBe(true);

    return frame;
  };

  await openEditor(page, "?view=all");
  await page.getByRole("button", { name: "3D Wiring" }).click();
  const withFurniture = await shot();

  await setLayer(page, "furniture", false);
  const without = await shot();

  expect(without.width).toBe(withFurniture.width);
  const fraction = changedFraction(withFurniture, without);

  console.log(`3D furniture changed fraction: ${fraction.toFixed(4)}`);
  // Protected limit (client/e2e/thresholds.json) — only the user changes it.
  // Strip a UTF-8 BOM: Windows PowerShell's Set-Content -Encoding utf8 writes one.
  const limits = JSON.parse(readFileSync(join(__dirname, "thresholds.json"), "utf8").replace(/^﻿/, "")) as {
    furniture3dMinChangedFraction: number;
  };

  expect(fraction).toBeGreaterThan(limits.furniture3dMinChangedFraction);
});
