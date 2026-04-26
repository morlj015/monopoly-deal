import type { GameState } from "../../domain/types/game.types";

interface Props {
  state: GameState;
  dispatch: (cmd: object) => void;
}

export function BottomActions({ state, dispatch }: Props) {
  const isPlayer = state.turn.activePlayer === "player";
  const phase = state.phase;

  if (!isPlayer) return null;
  if (phase !== "draw" && phase !== "action") return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "flex-start",
      padding: "0 16px 8px",
    }}>
      {phase === "draw" && (
        <button
          onClick={() => dispatch({ type: "DrawCards" })}
          style={{
            padding: "12px 36px",
            fontSize: 16,
            fontWeight: 800,
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg, #43a047, #1b5e20)",
            color: "#fff",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(67,160,71,0.55)",
            letterSpacing: 0.5,
          }}
        >
          Draw 2 Cards
        </button>
      )}

      {phase === "action" && (
        <button
          onClick={() => dispatch({ type: "EndTurn" })}
          style={{
            padding: "12px 32px",
            fontSize: 15,
            fontWeight: 800,
            borderRadius: 12,
            border: "2px solid rgba(255,255,255,0.25)",
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            letterSpacing: 0.5,
            backdropFilter: "blur(4px)",
          }}
        >
          End Turn →
        </button>
      )}
    </div>
  );
}
