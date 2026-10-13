/**
 * Renders a ShareCardModel to a PNG in the browser (Canvas 2D). The browser's text
 * engine shapes Devanagari correctly, which server-side SVG renderers do not.
 * Only fields of the privacy-safe card model are drawn.
 */
import type { ShareCardModel } from "@/lib/contracts/share";

export interface CardFonts {
  /** CSS font-family lists, e.g. read from the next/font CSS variables. */
  display: string;
  sans: string;
  devanagari: string;
}

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const COLORS = {
  top: "#0b1026",
  bottom: "#1c1747",
  gold: "#d9bf7f",
  ivory: "#f6f1e3",
  muted: "#b9b6cf",
  line: "rgba(217, 191, 127, 0.35)",
  star: "rgba(246, 241, 227, 0.55)",
};

/** Deterministic star positions (no randomness). */
function stars(count: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  let s = 0x9e3779b9;
  for (let i = 0; i < count; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const x = (s % 10_000) / 10_000;
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const y = (s % 10_000) / 10_000;
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out.push([x * CARD_WIDTH, y * CARD_HEIGHT, 0.6 + ((s % 100) / 100) * 1.6]);
  }
  return out;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws the card onto a canvas context (exported for testing in a DOM environment). */
export function drawShareCard(ctx: CanvasRenderingContext2D, card: ShareCardModel, fonts: CardFonts): void {
  const W = CARD_WIDTH;
  const H = CARD_HEIGHT;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, COLORS.top);
  g.addColorStop(1, COLORS.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = COLORS.star;
  for (const [x, y, r] of stars(90)) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, W - 96, H - 96);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.gold;
  ctx.font = `600 54px ${fonts.display}`;
  ctx.fillText("SoulLetter", W / 2, 150);

  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 30px ${fonts.sans}`;
  ctx.fillText(card.headline.toUpperCase(), W / 2, 215);

  if (card.primary) {
    ctx.fillStyle = COLORS.ivory;
    ctx.font = `400 220px ${fonts.devanagari}`;
    ctx.fillText(card.primary.devanagari, W / 2, 520);
    ctx.fillStyle = COLORS.gold;
    ctx.font = `600 84px ${fonts.display}`;
    ctx.fillText(card.primary.roman, W / 2, 630);
    ctx.fillStyle = COLORS.muted;
    ctx.font = `italic 400 38px ${fonts.display}`;
    ctx.fillText(card.primary.iast, W / 2, 686);
  } else {
    ctx.fillStyle = COLORS.ivory;
    ctx.font = `400 48px ${fonts.display}`;
    ctx.fillText("No single syllable determined", W / 2, 520);
  }

  // Everything below flows top-down and wraps to the frame, so long method names and
  // interpretations are never clipped at the canvas edges.
  const maxWidth = W - 220;
  const lines = (text: string, font: string, color: string, lineHeight: number, at: number): number => {
    ctx.font = font;
    ctx.fillStyle = color;
    let cursor = at;
    for (const line of wrap(ctx, text, maxWidth)) {
      ctx.fillText(line, W / 2, cursor);
      cursor += lineHeight;
    }
    return cursor;
  };

  let y = 760;
  if (card.alternatives.length > 0) {
    const alts = card.alternatives.map((a) => `${a.roman} (${a.devanagari}, ${a.iast})`).join(" · ");
    y = lines(`Also shown: ${alts}`, `400 32px ${fonts.sans}`, COLORS.ivory, 42, y) + 14;
  }

  y += 10;
  for (const m of card.methods.slice(0, 3)) {
    y = lines(m.name, `600 28px ${fonts.sans}`, COLORS.gold, 38, y);
    y = lines(m.statusLabel, `400 26px ${fonts.sans}`, COLORS.muted, 36, y) + 12;
  }

  y += 16;
  y = lines(card.interpretation, `400 30px ${fonts.sans}`, COLORS.ivory, 42, y);

  ctx.font = `400 26px ${fonts.sans}`;
  const disclaimerLines = wrap(ctx, card.disclaimer, maxWidth);
  const versionY = H - 74;
  const disclaimerHeight = disclaimerLines.length * 36;
  lines(card.disclaimer, `400 26px ${fonts.sans}`, COLORS.muted, 36, Math.max(y + 34, versionY - 26 - disclaimerHeight));
  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 22px ${fonts.sans}`;
  ctx.fillText(`Rule set ${card.ruleSetVersion} · Table ${card.avakahadaTableVersion}`, W / 2, versionY);
}

/** Renders the card to a PNG Blob. Waits for web fonts so Devanagari uses the brand font. */
export async function renderShareCardPng(card: ShareCardModel, fonts: CardFonts): Promise<Blob> {
  if (typeof document === "undefined") throw new Error("renderShareCardPng runs in the browser only");
  try {
    await document.fonts?.ready;
  } catch {
    // proceed with fallback fonts
  }
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");
  drawShareCard(ctx, card, fonts);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image export failed"))), "image/png");
  });
}

/** Reads the brand font stacks from CSS custom properties set by next/font. */
export function fontsFromDocument(): CardFonts {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    display: read("--font-display", "Georgia, serif"),
    sans: read("--font-sans", "system-ui, sans-serif"),
    devanagari: read("--font-devanagari", "'Noto Serif Devanagari', serif"),
  };
}
