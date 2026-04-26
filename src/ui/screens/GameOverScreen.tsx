import type { GameState } from "../../domain/types/game.types";

interface Props {
  state: GameState;
  isMultiplayer: boolean;
  myVoted: boolean;
  opponentVoted: boolean;
  opponentName?: string;
  onRematch: () => void;
  onMenu: () => void;
}

export function GameOverScreen({
  state,
  isMultiplayer,
  myVoted,
  opponentVoted,
  opponentName = "Opponent",
  onRematch,
  onMenu,
}: Props) {
  const won = state.winner === "player";

  const rematchLabel = (() => {
    if (!isMultiplayer) return "Play Again";
    if (myVoted) return `Waiting for ${opponentName}…`;
    if (opponentVoted) return "Accept Rematch";
    return "Play Again";
  })();

  const rematchDisabled = isMultiplayer && myVoted;

  return (
    <div style={styles.root}>
      {/* Result card */}
      <div style={styles.card}>
        <div style={{ fontSize: 72, filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.5))" }}>
          {won ? "🏆" : "💸"}
        </div>

        <div style={{ fontSize: 34, fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>
          {won ? "You Win!" : `${isMultiplayer ? opponentName : "Opponent"} Wins!`}
        </div>

        <div style={{ fontSize: 14, color: "#a5d6a7", maxWidth: 280, lineHeight: 1.6, textAlign: "center" }}>
          {won
            ? "You collected 3 complete property sets first!"
            : "They completed 3 property sets. Better luck next time!"}
        </div>

        {/* Opponent-voted nudge (shown before local player has voted) */}
        {isMultiplayer && opponentVoted && !myVoted && (
          <div style={styles.nudge}>
            <span style={{ fontSize: 16 }}>🔄</span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{opponentName} wants to play again!</span>
          </div>
        )}

        {/* Play again button */}
        <button
          onClick={onRematch}
          disabled={rematchDisabled}
          style={{
            ...styles.btn,
            background: rematchDisabled
              ? "rgba(255,255,255,0.08)"
              : "linear-gradient(135deg,#2e7d32,#1b5e20)",
            color: rematchDisabled ? "rgba(255,255,255,0.4)" : "#fff",
            cursor: rematchDisabled ? "default" : "pointer",
            boxShadow: rematchDisabled ? "none" : "0 5px 18px rgba(46,125,50,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {rematchDisabled && <Spinner />}
          {rematchLabel}
        </button>

        {/* Voting status dots — only in multiplayer */}
        {isMultiplayer && (
          <div style={styles.voteRow}>
            <VoteDot label="You" voted={myVoted} />
            <div style={{ width: 24, height: 1, background: "rgba(255,255,255,0.15)" }} />
            <VoteDot label={opponentName} voted={opponentVoted} />
          </div>
        )}

        {/* Back to menu */}
        <button onClick={onMenu} style={styles.menuBtn}>
          ← Main Menu
        </button>
      </div>
    </div>
  );
}

function VoteDot({ label, voted }: { label: string; voted: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{
        width: 10, height: 10, borderRadius: "50%",
        background: voted ? "#66bb6a" : "rgba(255,255,255,0.18)",
        boxShadow: voted ? "0 0 8px rgba(102,187,106,0.7)" : "none",
        transition: "background 0.3s, box-shadow 0.3s",
      }} />
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>{label}</span>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: 14 }}>
      ⟳
    </span>
  );
}

const styles = {
  root: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    padding: 24,
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  card: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 16,
    background: "rgba(0,0,0,0.45)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 24,
    padding: "36px 32px",
    width: "100%",
    maxWidth: 360,
  },
  nudge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(255,193,7,0.12)",
    border: "1px solid rgba(255,193,7,0.35)",
    borderRadius: 10,
    padding: "8px 14px",
    color: "#ffd54f",
    width: "100%",
    justifyContent: "center",
  },
  btn: {
    width: "100%",
    padding: "14px 0",
    borderRadius: 12,
    border: "none",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 0.5,
    transition: "opacity 0.2s",
  },
  voteRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: -4,
  },
  menuBtn: {
    width: "100%",
    padding: "11px 0",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: 0.3,
  },
};
