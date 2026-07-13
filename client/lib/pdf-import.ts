/**
 * PDF floor-plan import (brief §1: "PDF/image import"): renders page 1
 * of an uploaded PDF to a raster data URL so it can ride the existing
 * backgroundImage trace-layer flow — the engine never sees PDFs.
 */
export async function pdfFirstPageToDataUrl(
  file: File,
  targetWidth = 1600,
): Promise<string> {
  const pdfjs = await import("pdfjs-dist");

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const document_ = await loadingTask.promise;
  const page = await document_.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(4, targetWidth / base.width);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");

  if (!context) throw new Error("Canvas 2D context unavailable");
  // PDFs are often transparent; JPEG needs an opaque background.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvas, canvasContext: context, viewport }).promise;
  await loadingTask.destroy();

  return canvas.toDataURL("image/jpeg", 0.85);
}
