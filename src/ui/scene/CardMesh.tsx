import { useRef, useMemo } from "react";
import * as THREE from "three";
import type { Card } from "../../domain/types/card.types";

const COLOR_MAP: Record<string, string> = {
  brown: "#5d4037",
  lightblue: "#039be5",
  pink: "#e91e63",
  orange: "#ef6c00",
  red: "#c62828",
  yellow: "#f9a825",
  green: "#2e7d32",
  darkblue: "#1565c0",
  railroad: "#37474f",
  utility: "#558b2f",
};

function buildTexture(card: Card): THREE.CanvasTexture {
  const W = 128, H = 180;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Card background
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(2, 2, W - 4, H - 4, 8);
  ctx.fill();

  // Border
  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (card.kind === "property") {
    const bg = COLOR_MAP[card.color] ?? "#888";
    ctx.fillStyle = bg;
    ctx.fillRect(2, 2, W - 4, 44);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(card.name, W / 2, 26, W - 12);
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#1b5e20";
    ctx.fillText(`$${card.value}M`, W / 2, 140);
  } else if (card.kind === "money") {
    ctx.fillStyle = "#c8e6c9";
    ctx.fillRect(2, 2, W - 4, H - 4);
    ctx.fillStyle = "#1b5e20";
    ctx.font = "bold 42px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(card.value), W / 2, H / 2 + 14);
    ctx.font = "11px sans-serif";
    ctx.fillText("MILLION", W / 2, H / 2 + 30);
  } else if (card.kind === "action") {
    ctx.fillStyle = "#bbdefb";
    ctx.fillRect(2, 2, W - 4, H - 4);
    ctx.fillStyle = "#0d47a1";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    const lines = card.name.split(" ");
    lines.forEach((line, i) =>
      ctx.fillText(line, W / 2, H / 2 - 10 + i * 14, W - 12)
    );
    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = "#1565c0";
    ctx.fillText(`$${card.value}M`, W / 2, H - 20);
  } else if (card.kind === "rent") {
    ctx.fillStyle = "#fff9c4";
    ctx.fillRect(2, 2, W - 4, H - 4);
    ctx.fillStyle = "#e65100";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(card.isWild ? "Wild Rent" : "Rent", W / 2, 30);
    card.colors.forEach((col, i) => {
      const bg = COLOR_MAP[col] ?? "#888";
      ctx.fillStyle = bg;
      const x = 14 + (i % 5) * 22;
      const y = 50 + Math.floor(i / 5) * 22;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#e65100";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(`$${card.value}M`, W / 2, H - 20);
  }

  return new THREE.CanvasTexture(canvas);
}

interface Props {
  card: Card;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  onClick?: () => void;
  selected?: boolean;
}

export function CardMesh({
  card,
  position,
  rotation = [0, 0, 0],
  scale = 1,
  onClick,
  selected = false,
}: Props) {
  const texture = useMemo(() => buildTexture(card), [card.id]);
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      scale={[scale, scale, scale]}
      onClick={onClick}
      castShadow
    >
      <planeGeometry args={[0.74, 1.04]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.6}
        metalness={0}
        emissive={selected ? new THREE.Color(0xffd740) : new THREE.Color(0x000000)}
        emissiveIntensity={selected ? 0.35 : 0}
      />
    </mesh>
  );
}
