/**
 * Minimal text extraction for PDFs written by pdfkit: inflates every
 * FlateDecode content stream and joins the hex string chunks of each
 * TJ/Tj operator (kerning offsets dropped). One entry per text run.
 */
import { inflateSync } from "node:zlib";

export function pdfTextRuns(pdf: Buffer): string[] {
  const raw = pdf.toString("latin1");
  const runs: string[] = [];
  const streamRe = /stream\r?\n/g;
  let match: RegExpExecArray | null;

  while ((match = streamRe.exec(raw))) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);

    if (end < 0) break;
    let body: string;

    try {
      body = inflateSync(pdf.subarray(start, end)).toString("latin1");
    } catch {
      continue; // not a Flate stream (fonts/images) or not text
    }
    for (const op of body.matchAll(/\[((?:<[0-9a-fA-F]*>|[-\d.\s])*)\]\s*TJ|<([0-9a-fA-F]*)>\s*Tj/g)) {
      const hex = op[1] !== undefined
        ? [...op[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((m) => m[1]).join("")
        : op[2];

      runs.push(Buffer.from(hex, "hex").toString("latin1"));
    }
    streamRe.lastIndex = end;
  }

  return runs;
}
