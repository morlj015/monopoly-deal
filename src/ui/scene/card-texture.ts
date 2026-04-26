import * as THREE from "three";
import type { Card } from "../../domain/types/card.types";
import { PROP_COLOR, RENT_TABLE } from "../components/CardFace";

const MONEY_STYLE: Record<number, { bg: string; fg: string }> = {
  1:  { bg: "#fffde7", fg: "#f9a825" },
  2:  { bg: "#fce4ec", fg: "#c62828" },
  3:  { bg: "#e3f2fd", fg: "#1565c0" },
  4:  { bg: "#f3e5f5", fg: "#6a1b9a" },
  5:  { bg: "#e8f5e9", fg: "#2e7d32" },
  10: { bg: "#fff8e1", fg: "#e65100" },
};

const ACTION_STYLE: Record<string, { bg: string; fg: string; emoji: string }> = {
  passgo:        { bg: "#1b5e20", fg: "#fff", emoji: "🎲" },
  dealbreaker:   { bg: "#b71c1c", fg: "#fff", emoji: "💥" },
  slydeal:       { bg: "#4a148c", fg: "#fff", emoji: "🕵️" },
  forceddeal:    { bg: "#e65100", fg: "#fff", emoji: "🔄" },
  debtcollector: { bg: "#004d40", fg: "#fff", emoji: "💰" },
  birthday:      { bg: "#ad1457", fg: "#fff", emoji: "🎂" },
  jsn:           { bg: "#c62828", fg: "#fff", emoji: "🚫" },
  doublerent:    { bg: "#f9a825", fg: "#212121", emoji: "✖️" },
  house:         { bg: "#2e7d32", fg: "#fff", emoji: "🏠" },
  hotel:         { bg: "#c62828", fg: "#fff", emoji: "🏨" },
};

export function buildCardTexture(card: Card): THREE.CanvasTexture {
  // Canvas is 2× the logical size for crisp rendering in the 3D scene
  const W = 148, H = 208;
  const cv = document.createElement("canvas");
  cv.width = W * 2; cv.height = H * 2;
  const ctx = cv.getContext("2d")!;
  ctx.scale(2, 2);

  // White card with rounded rect
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 2, 2, W - 4, H - 4, 10);
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 2;
  roundRect(ctx, 2, 2, W - 4, H - 4, 10);
  ctx.stroke();

  if (card.kind === "property") {
    const isWild = (card.colors?.length ?? 1) > 1;
    const isRainbow = (card.colors?.length ?? 1) > 2;
    const headerH = 66;

    // Color header
    if (isRainbow) {
      const grad = ctx.createLinearGradient(2, 2, W - 4, headerH);
      const stops = ["#e53935","#ff7043","#fdd835","#43a047","#1565c0","#8e24aa"];
      stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
      ctx.fillStyle = grad;
    } else if (isWild) {
      const grad = ctx.createLinearGradient(2, 2, W - 4, headerH);
      grad.addColorStop(0, PROP_COLOR[card.colors![0]]);
      grad.addColorStop(0.5, PROP_COLOR[card.colors![0]]);
      grad.addColorStop(0.5, PROP_COLOR[card.colors![1]]);
      grad.addColorStop(1, PROP_COLOR[card.colors![1]]);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = PROP_COLOR[card.color];
    }
    roundRectTop(ctx, 2, 2, W - 4, headerH, 10);
    ctx.fill();

    // Property name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    if (isWild) {
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("WILD", W / 2, 24);
      ctx.font = "bold 9px sans-serif";
      wrapText(ctx, isRainbow ? "Any color" : card.name.replace("Wild: ", ""), W / 2, 40, W - 20, 12);
    } else {
      wrapText(ctx, card.name, W / 2, 28, W - 20, 14);
    }

    // Value badge in header
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    roundRect(ctx, W - 38, headerH - 22, 32, 16, 4);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`$${card.value}M`, W - 22, headerH - 10);

    // Rent table
    const rents = RENT_TABLE[card.color];
    ctx.textAlign = "left";
    const tableX = 12, tableY = headerH + 12;
    ctx.fillStyle = "#555";
    ctx.font = "bold 9px sans-serif";
    ctx.fillText("RENT", tableX, tableY);

    rents.forEach((r, i) => {
      const y = tableY + 14 + i * 16;
      // Card count dots
      for (let d = 0; d <= i; d++) {
        ctx.fillStyle = PROP_COLOR[card.color];
        ctx.beginPath();
        ctx.arc(tableX + 6 + d * 10, y - 4, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#222";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`$${r}M`, W - 12, y);
      ctx.textAlign = "left";
    });

  } else if (card.kind === "money") {
    const ms = MONEY_STYLE[card.value] ?? { bg: "#f5f5f5", fg: "#333" };
    ctx.fillStyle = ms.bg;
    roundRect(ctx, 2, 2, W - 4, H - 4, 10);
    ctx.fill();

    // Large value
    ctx.fillStyle = ms.fg;
    ctx.font = `bold ${Math.round(W * 0.42)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(String(card.value), W / 2, H / 2 + 20);

    ctx.font = "bold 13px sans-serif";
    ctx.fillText("MILLION", W / 2, H / 2 + 40);

    // Corner badges
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`$${card.value}M`, 10, 22);
    ctx.textAlign = "right";
    ctx.fillText(`$${card.value}M`, W - 10, H - 10);

  } else if (card.kind === "action") {
    const s = ACTION_STYLE[card.subtype] ?? { bg: "#1565c0", fg: "#fff", emoji: "⚡" };
    ctx.fillStyle = s.bg;
    roundRect(ctx, 2, 2, W - 4, H - 4, 10);
    ctx.fill();

    // Emoji
    ctx.font = `${Math.round(W * 0.3)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(s.emoji, W / 2, 80);

    // Name
    ctx.fillStyle = s.fg;
    ctx.font = "bold 13px sans-serif";
    wrapText(ctx, card.name, W / 2, 110, W - 20, 16);

    // Value
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    roundRect(ctx, W / 2 - 20, H - 34, 40, 20, 5);
    ctx.fill();
    ctx.fillStyle = s.fg;
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`$${card.value}M`, W / 2, H - 20);

  } else {
    // Rent card
    ctx.fillStyle = "#f9a825";
    roundRect(ctx, 2, 2, W - 4, H - 4, 10);
    ctx.fill();

    ctx.fillStyle = "#212121";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(card.isWild ? "WILD RENT" : "RENT", W / 2, 32);

    // Color dots
    const colors = card.isWild
      ? (Object.keys(PROP_COLOR) as (keyof typeof PROP_COLOR)[])
      : card.colors;
    const cols = 5;
    colors.forEach((col, i) => {
      const cx = 22 + (i % cols) * 22;
      const cy = 60 + Math.floor(i / cols) * 22;
      ctx.fillStyle = PROP_COLOR[col];
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    ctx.fillStyle = "rgba(0,0,0,0.2)";
    roundRect(ctx, W / 2 - 22, H - 34, 44, 20, 5);
    ctx.fill();
    ctx.fillStyle = "#212121";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`$${card.value}M`, W / 2, H - 20);
  }

  return new THREE.CanvasTexture(cv);
}

export function buildFaceDownTexture(): THREE.CanvasTexture {
  const W = 148, H = 208;
  const cv = document.createElement("canvas");
  cv.width = W * 2; cv.height = H * 2;
  const ctx = cv.getContext("2d")!;
  ctx.scale(2, 2);;
  ctx.fillStyle = "#1a237e";
  roundRect(ctx, 0, 0, W, H, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 3;
  roundRect(ctx, 6, 6, W - 12, H - 12, 7);
  ctx.stroke();
  // Diagonal lines pattern
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let i = -H; i < W + H; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(cv);
}

// ── Canvas helpers ──────────────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function roundRectTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const words = text.split(" ");
  let line = "";
  let cy = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = w;
      cy += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, cy);
}
