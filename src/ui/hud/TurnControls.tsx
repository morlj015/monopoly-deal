import type { GameState } from "../../domain/types/game.types";

interface Props {
  state: GameState;
  dispatch: (cmd: object) => void;
}

export function TurnControls({ state, dispatch: _dispatch }: Props) {
  const isPlayer = state.turn.activePlayer === "player";
  const phase = state.phase;

  if (phase === "over") return null;

  const playerBank = state.players.player.bank.reduce((s, c) => s + c.value, 0);
  const aiBank     = state.players.ai.bank.reduce((s, c) => s + c.value, 0);
  const playerSets = Object.values(state.players.player.sets).filter(s => s.length > 0).length;
  const aiSets     = Object.values(state.players.ai.sets).filter(s => s.length > 0).length;

  return (
    <div style={{
      padding: "7px 14px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(8px)",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      gap: 12,
      flexWrap: "wrap",
      fontSize: 12,
    }}>
      {/* Turn status */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {isPlayer && phase === "draw" && (
          <span style={{ color: "#a5d6a7", fontWeight: 700 }}>Your turn — draw 2</span>
        )}
        {isPlayer && phase === "action" && (
          <span style={{ color: "#a5d6a7", fontWeight: 700 }}>Your turn</span>
        )}
        {isPlayer && phase === "discard" && (
          <span style={{ color: "#ffcc80", fontWeight: 700 }}>Discard down to 7</span>
        )}
        {!isPlayer && phase !== "reaction" && (
          <span style={{ color: "#ef9a9a", fontWeight: 700, display: "flex", gap: 5, alignItems: "center" }}>
            <span style={{ display: "inline-flex", gap: 3 }}>
              {[0,1,2].map(i => (
                <span key={i} style={{
                  display: "inline-block", width: 5, height: 5, borderRadius: "50%",
                  background: "#ef9a9a", opacity: 0.5 + i * 0.25,
                  animation: "pulse 1s infinite", animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </span>
            Opponent thinking…
          </span>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, color: "rgba(255,255,255,0.6)" }}>
        <span>You: <strong style={{ color: "#a5d6a7" }}>${playerBank}M</strong> · <strong style={{ color: "#a5d6a7" }}>{playerSets} sets</strong></span>
        <span>Opp: <strong style={{ color: "#ef9a9a" }}>${aiBank}M</strong> · <strong style={{ color: "#ef9a9a" }}>{aiSets} sets</strong></span>
      </div>
    </div>
  );
}
