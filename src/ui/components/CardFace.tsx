import type { Card, PropertyColor } from "../../domain/types/card.types";

export const PROP_COLOR: Record<PropertyColor, string> = {
  brown:    "#6d4c41",
  lightblue:"#29b6f6",
  pink:     "#ec407a",
  orange:   "#ff7043",
  red:      "#e53935",
  yellow:   "#fdd835",
  green:    "#43a047",
  darkblue: "#1565c0",
  railroad: "#37474f",
  utility:  "#78909c",
};


export const RENT_TABLE: Record<PropertyColor, number[]> = {
  brown:    [1, 2],
  lightblue:[1, 2, 3],
  pink:     [1, 2, 4],
  orange:   [1, 3, 5],
  red:      [2, 3, 6],
  yellow:   [2, 4, 6],
  green:    [2, 4, 7],
  darkblue: [3, 8],
  railroad: [1, 2, 3, 4],
  utility:  [1, 2],
};

const MONEY_STYLE: Record<number, { bg: string; fg: string }> = {
  1:  { bg: "#fffde7", fg: "#f9a825" },
  2:  { bg: "#fce4ec", fg: "#c62828" },
  3:  { bg: "#e3f2fd", fg: "#1565c0" },
  4:  { bg: "#f3e5f5", fg: "#6a1b9a" },
  5:  { bg: "#e8f5e9", fg: "#2e7d32" },
  10: { bg: "#fff8e1", fg: "#e65100" },
};

interface Props {
  card: Card;
  width?: number;
  selected?: boolean;
  faceDown?: boolean;
}

export function CardFace({ card, width = 72, selected = false, faceDown = false }: Props) {
  const h = Math.round(width * 1.4);
  const r = Math.round(width * 0.1);
  const base: React.CSSProperties = {
    width,
    height: h,
    borderRadius: r,
    border: selected ? "2px solid #ffd740" : "1.5px solid rgba(0,0,0,0.18)",
    boxShadow: selected
      ? "0 0 0 2px #ffd740, 0 6px 18px rgba(0,0,0,0.45)"
      : "0 3px 8px rgba(0,0,0,0.35)",
    transform: selected ? "translateY(-10px)" : undefined,
    transition: "transform 0.15s, box-shadow 0.15s",
    flexShrink: 0,
    position: "relative",
    overflow: "hidden",
    cursor: "pointer",
    userSelect: "none",
  };

  if (faceDown) {
    return (
      <div style={{ ...base, background: "#1a237e" }}>
        <div style={{
          position: "absolute", inset: 4,
          borderRadius: r - 2,
          border: "1.5px solid rgba(255,255,255,0.15)",
          backgroundImage: "repeating-linear-gradient(45deg,rgba(255,255,255,0.03) 0px,rgba(255,255,255,0.03) 2px,transparent 2px,transparent 8px)",
        }} />
      </div>
    );
  }

  if (card.kind === "property") {
    const isWild = (card.colors?.length ?? 1) > 1;
    const isRainbow = (card.colors?.length ?? 1) > 2;
    const bg = isRainbow
      ? "linear-gradient(135deg,#e53935,#ff7043,#fdd835,#43a047,#1565c0,#8e24aa)"
      : isWild
        ? `linear-gradient(135deg, ${PROP_COLOR[card.colors![0]]} 50%, ${PROP_COLOR[card.colors![1]]} 50%)`
        : PROP_COLOR[card.color];
    const fg = card.color === "yellow" && !isWild ? "#212121" : "#fff";
    const rents = RENT_TABLE[card.color];
    const fs = Math.max(7, Math.round(width * 0.115));
    const valFs = Math.max(8, Math.round(width * 0.135));
    return (
      <div style={{ ...base, background: "#fff", display: "flex", flexDirection: "column" }}>
        {/* Color header */}
        <div style={{
          background: bg,
          padding: `${Math.round(width * 0.07)}px ${Math.round(width * 0.08)}px`,
          minHeight: Math.round(h * 0.28),
          display: "flex", flexDirection: "column", justifyContent: "center",
        }}>
          <div style={{ color: fg, fontSize: fs, fontWeight: 800, lineHeight: 1.2, letterSpacing: -0.2, textShadow: isWild ? "0 1px 3px rgba(0,0,0,0.5)" : undefined }}>
            {isWild ? "WILD" : card.name}
          </div>
          {isWild && <div style={{ color: "rgba(255,255,255,0.85)", fontSize: Math.max(6, Math.round(width * 0.09)), fontWeight: 600, textShadow: "0 1px 2px rgba(0,0,0,0.5)", lineHeight: 1.3 }}>{card.name.replace("Wild: ", "").replace("Property Wild", "Any color")}</div>}
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: `${Math.round(width*0.07)}px ${Math.round(width*0.08)}px`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {/* Rent table */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {rents.map((rent, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: Math.max(6, Math.round(width * 0.1)), color: "#333" }}>
                <span style={{ color: "#888", fontWeight: 500 }}>{i + 1}{i === rents.length - 1 ? "★" : ""}</span>
                <span style={{ fontWeight: 700, color: "#1b5e20" }}>${rent}M</span>
              </div>
            ))}
          </div>

          {/* Value badge */}
          <div style={{
            alignSelf: "flex-end",
            background: bg,
            color: fg,
            fontSize: valFs,
            fontWeight: 900,
            borderRadius: 4,
            padding: "1px 5px",
          }}>
            ${card.value}M
          </div>
        </div>
      </div>
    );
  }

  if (card.kind === "money") {
    const ms = MONEY_STYLE[card.value] ?? { bg: "#f5f5f5", fg: "#333" };
    return (
      <div style={{ ...base, background: ms.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <div style={{ position: "absolute", top: 5, left: 6, fontSize: Math.max(7, Math.round(width * 0.13)), fontWeight: 900, color: ms.fg }}>${card.value}M</div>
        <div style={{ fontSize: Math.round(width * 0.45), fontWeight: 900, color: ms.fg, lineHeight: 1 }}>{card.value}</div>
        <div style={{ fontSize: Math.max(6, Math.round(width * 0.1)), fontWeight: 700, color: ms.fg, letterSpacing: 1 }}>MILLION</div>
        <div style={{ position: "absolute", bottom: 5, right: 6, fontSize: Math.max(7, Math.round(width * 0.13)), fontWeight: 900, color: ms.fg }}>${card.value}M</div>
      </div>
    );
  }

  if (card.kind === "action") {
    const actionColors: Record<string, { bg: string; fg: string }> = {
      passgo:       { bg: "linear-gradient(135deg,#43a047,#1b5e20)", fg: "#fff" },
      dealbreaker:  { bg: "linear-gradient(135deg,#e53935,#b71c1c)", fg: "#fff" },
      slydeal:      { bg: "linear-gradient(135deg,#8e24aa,#4a148c)", fg: "#fff" },
      forceddeal:   { bg: "linear-gradient(135deg,#fb8c00,#e65100)", fg: "#fff" },
      debtcollector:{ bg: "linear-gradient(135deg,#00897b,#004d40)", fg: "#fff" },
      birthday:     { bg: "linear-gradient(135deg,#f06292,#ad1457)", fg: "#fff" },
      jsn:          { bg: "linear-gradient(135deg,#ef5350,#b71c1c)", fg: "#fff" },
      doublerent:   { bg: "linear-gradient(135deg,#fdd835,#f9a825)", fg: "#212121" },
      house:        { bg: "linear-gradient(135deg,#66bb6a,#2e7d32)", fg: "#fff" },
      hotel:        { bg: "linear-gradient(135deg,#ef5350,#c62828)", fg: "#fff" },
    };
    const style = actionColors[card.subtype] ?? { bg: "#1565c0", fg: "#fff" };
    const nameFs = Math.max(7, Math.round(width * 0.115));
    return (
      <div style={{ ...base, background: style.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: `${Math.round(width*0.1)}px ${Math.round(width*0.08)}px` }}>
        <div style={{ fontSize: Math.round(width * 0.22), lineHeight: 1 }}>
          {card.subtype === "jsn" ? "🚫" : card.subtype === "passgo" ? "🎲" : card.subtype === "birthday" ? "🎂" : card.subtype === "dealbreaker" ? "💥" : card.subtype === "slydeal" ? "🕵️" : card.subtype === "debtcollector" ? "💰" : card.subtype === "house" ? "🏠" : card.subtype === "hotel" ? "🏨" : "⚡"}
        </div>
        <div style={{ color: style.fg, fontSize: nameFs, fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>
          {card.name}
        </div>
        <div style={{
          background: "rgba(0,0,0,0.25)",
          color: style.fg,
          fontSize: Math.max(7, Math.round(width * 0.12)),
          fontWeight: 900,
          borderRadius: 4,
          padding: "1px 5px",
        }}>
          ${card.value}M
        </div>
      </div>
    );
  }

  // Rent card
  return (
    <div style={{ ...base, background: "linear-gradient(135deg,#fdd835,#f9a825)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: `${Math.round(width*0.08)}px ${Math.round(width*0.08)}px` }}>
      <div style={{ fontSize: Math.max(7, Math.round(width * 0.12)), fontWeight: 800, color: "#212121" }}>RENT</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center" }}>
        {(card.isWild ? ["brown","lightblue","pink","orange","red","yellow","green","darkblue","railroad","utility"] : card.colors).map((col) => (
          <div key={col} style={{
            width: Math.max(8, Math.round(width * 0.13)),
            height: Math.max(8, Math.round(width * 0.13)),
            borderRadius: "50%",
            background: PROP_COLOR[col as PropertyColor],
            border: "1px solid rgba(0,0,0,0.2)",
          }} />
        ))}
      </div>
      <div style={{
        background: "rgba(0,0,0,0.2)",
        color: "#212121",
        fontSize: Math.max(7, Math.round(width * 0.12)),
        fontWeight: 900,
        borderRadius: 4,
        padding: "1px 5px",
      }}>
        ${card.value}M
      </div>
    </div>
  );
}
