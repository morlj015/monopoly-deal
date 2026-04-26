import { useState } from "react";
import type { GameState } from "../../domain/types/game.types";
import type { PropertyColor } from "../../domain/types/card.types";
import { PropertyStack } from "../components/PropertyStack";
import { isComplete, SET_SIZES } from "../../domain/rules/set.rules";

const COLOR_ORDER: PropertyColor[] = [
  "brown", "lightblue", "pink", "orange",
  "red", "yellow", "green", "darkblue",
  "railroad", "utility",
];

interface Props {
  state: GameState;
}

interface RowProps {
  zone: GameState["players"]["player"];
  label: string;
  dimmed?: boolean;
}

function SetsRow({ zone, label, dimmed }: RowProps) {
  const activeColors = COLOR_ORDER.filter(c => (zone.sets[c]?.length ?? 0) > 0);

  return (
    <div style={{ opacity: dimmed ? 0.65 : 1, transition: "opacity 0.2s" }}>
      <div style={{
        padding: "2px 14px",
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.35)",
      }}>
        {label}
      </div>

      <div style={{
        display: "flex",
        gap: 4,
        overflowX: "auto",
        padding: "4px 10px 6px",
        alignItems: "flex-end",
        // Custom scrollbar styling
        scrollbarWidth: "none",
      }}>
        {activeColors.length === 0 && (
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontStyle: "italic", padding: "4px 4px 8px" }}>
            No properties yet
          </span>
        )}

        {activeColors.map(color => (
          <PropertyStack
            key={color}
            cards={zone.sets[color] ?? []}
            color={color}
            complete={isComplete(zone.sets, color)}
            setSize={SET_SIZES[color]}
            hasHouse={!!zone.houses[color]}
            hasHotel={!!zone.hotels[color]}
          />
        ))}
      </div>
    </div>
  );
}

export function PlayerSetsPanel({ state }: Props) {
  const [open, setOpen] = useState(true);

  const player = state.players.player;
  const ai = state.players.ai;
  const isPlayerTurn = state.turn.activePlayer === "player";

  return (
    <div style={{
      flexShrink: 0,
      background: "rgba(4,12,6,0.93)",
      borderTop: "1px solid rgba(255,255,255,0.06)",
      backdropFilter: "blur(6px)",
    }}>
      {/* ── Toggle header ──────────────────────────────────── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "5px 14px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 1.3,
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.38)",
        }}>
          Properties on board
        </span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", lineHeight: 1 }}>
          {open ? "▾" : "▸"}
        </span>
      </div>

      {/* ── Sets rows ──────────────────────────────────────── */}
      {open && (
        <div style={{ paddingBottom: 4 }}>
          <SetsRow zone={player} label="You" dimmed={!isPlayerTurn} />
          <SetsRow zone={ai} label="Opponent" dimmed={isPlayerTurn} />
        </div>
      )}
    </div>
  );
}
