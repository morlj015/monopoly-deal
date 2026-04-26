import type { GameState } from "../../domain/types/game.types";

interface Props {
  state: GameState;
  onRematch: () => void;
}

export function GameOverScreen({ state, onRematch }: Props) {
  const won = state.winner === "player";

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", gap: 20, padding: 24, textAlign: "center",
    }}>
      <div style={{ fontSize: 76, filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.5))" }}>
        {won ? "🏆" : "💸"}
      </div>
      <div style={{ fontSize: 36, fontWeight: 900, color: "#fff" }}>
        {won ? "You Win!" : "Opponent Wins!"}
      </div>
      <div style={{ fontSize: 14, color: "#a5d6a7", maxWidth: 280, lineHeight: 1.6 }}>
        {won
          ? "You collected 3 complete property sets first!"
          : "Your opponent completed 3 property sets. Better luck next time!"}
      </div>
      <button className="hud-btn pri" onClick={onRematch}>Play Again</button>
    </div>
  );
}
