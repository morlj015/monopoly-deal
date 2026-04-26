import { useState } from "react";
import type { PropertyCard, PropertyColor } from "../../domain/types/card.types";
import { CardFace, PROP_COLOR } from "./CardFace";

interface Props {
  cards: PropertyCard[];
  color: PropertyColor;
  complete: boolean;
  setSize: number;
  hasHouse?: boolean;
  hasHotel?: boolean;
}

// Geometry
const CARD_W = 68;
const CARD_H = Math.round(CARD_W * 1.4); // 95
const PEEK = 30;       // px of each non-top card visible in compact mode
const PEEK_FANNED = 84; // px visible when fanned open
const EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export function PropertyStack({ cards, color, complete, setSize, hasHouse, hasHotel }: Props) {
  const [fanned, setFanned] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const n = cards.length;
  const peek = fanned ? PEEK_FANNED : PEEK;
  // Container height grows/shrinks with the peek value
  const containerH = n <= 1 ? CARD_H : (n - 1) * peek + CARD_H;
  const bg = PROP_COLOR[color];
  const isDark = color === "yellow";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        cursor: "pointer",
        userSelect: "none",
        // Add horizontal padding so rotated card corners don't clip into adjacent stacks
        padding: "0 4px",
      }}
      onClick={() => n > 1 && setFanned(f => !f)}
      title={fanned ? "Click to collapse" : n > 1 ? "Click to fan out" : ""}
    >
      {/* ── Stack container ─────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          width: CARD_W,
          height: containerH,
          transition: `height 0.35s ${EASING}`,
        }}
      >
        {/* Empty placeholder */}
        {n === 0 && (
          <div style={{
            width: CARD_W,
            height: CARD_H,
            borderRadius: 8,
            border: `2px dashed ${bg}55`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <span style={{ color: `${bg}77`, fontSize: 20, fontWeight: 300 }}>+</span>
          </div>
        )}

        {cards.map((card, i) => {
          const isTop = i === n - 1;
          // Symmetric stagger rotation — cards fan outward from the pile centre
          const rot = (i - (n - 1) / 2) * (fanned ? 1.4 : 0.55);
          // Hovered non-top cards lift upward to reveal more of the header
          const liftY = !isTop && hoveredIdx === i ? -6 : 0;
          // Complete sets get a gold glow on the top card
          const shadow = isTop && complete
            ? "0 0 0 2px #ffd740, 0 6px 18px rgba(255,215,64,0.4)"
            : hoveredIdx === i
              ? "0 10px 26px rgba(0,0,0,0.6)"
              : isTop
                ? "0 5px 16px rgba(0,0,0,0.5)"
                : "0 2px 8px rgba(0,0,0,0.35)";

          return (
            <div
              key={card.id}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              onTouchStart={() => setHoveredIdx(i)}
              onTouchEnd={() => setHoveredIdx(null)}
              style={{
                position: "absolute",
                top: i * peek,
                left: 0,
                width: CARD_W,
                zIndex: i + 1,
                transform: `translateY(${liftY}px) rotate(${rot}deg)`,
                transformOrigin: "bottom center",
                transition: `top 0.35s ${EASING}, transform 0.18s ease, box-shadow 0.15s ease`,
                borderRadius: 8,
                overflow: "hidden",
                boxShadow: shadow,
              }}
            >
              <CardFace card={card} width={CARD_W} />
            </div>
          );
        })}
      </div>

      {/* ── X/Y progress badge ─────────────────────────────── */}
      {n > 0 && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          marginTop: 1,
        }}>
          <div style={{
            background: complete ? "#ffd740" : bg,
            color: (complete || isDark) ? "#212121" : "#fff",
            borderRadius: 10,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.5,
            minWidth: 36,
            textAlign: "center",
            boxShadow: complete ? "0 0 10px rgba(255,215,64,0.6)" : "none",
            transition: "background 0.3s, box-shadow 0.3s",
          }}>
            {n}/{setSize}
          </div>

          {/* House / hotel indicator */}
          {(hasHouse || hasHotel) && (
            <span style={{ fontSize: 11 }}>{hasHotel ? "🏨" : "🏠"}</span>
          )}
        </div>
      )}
    </div>
  );
}
