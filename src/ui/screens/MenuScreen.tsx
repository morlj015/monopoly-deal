import { useState } from "react";
import type { Difficulty } from "../../domain/types/game.types";
import { useGame } from "../../application/game.context";

interface Props {
  onMultiplayer: () => void;
}

const DESCS: Record<Difficulty, string> = {
  easy: "AI plays properties only. No steals or rent.",
  medium: "AI charges rent and uses Sly Deals.",
  hard: "AI plays aggressively — Deal Breakers, double rent combos.",
};

export function MenuScreen({ onMultiplayer }: Props) {
  const { startGame } = useGame();
  const [diff, setDiff] = useState<Difficulty>("medium");
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    await startGame(diff);
    setLoading(false);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: 20,
        padding: 24,
      }}
    >
      <div style={{ fontSize: 56, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }}>🎴</div>
      <div
        style={{
          fontSize: 36,
          fontWeight: 900,
          color: "#fff",
          letterSpacing: -1,
          textShadow: "0 4px 20px rgba(0,0,0,0.6)",
        }}
      >
        Monopoly Deal
      </div>
      <p style={{ color: "#a5d6a7", fontSize: 13, textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
        Collect 3 complete property sets before the AI does.<br />
        Play up to 3 cards per turn.
      </p>

      <div
        style={{
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 18,
          padding: "24px 28px",
          width: "100%",
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#81c784" }}>
          Difficulty
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => setDiff(d)}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 10,
                border: diff === d ? "2px solid" : "2px solid rgba(255,255,255,0.1)",
                borderColor: diff === d
                  ? d === "easy" ? "#66bb6a" : d === "medium" ? "#ff7043" : "#ef5350"
                  : "rgba(255,255,255,0.1)",
                background: diff === d
                  ? d === "easy" ? "#1b5e20" : d === "medium" ? "#bf360c" : "#7f0000"
                  : "rgba(255,255,255,0.05)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {d}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#80cbc4", lineHeight: 1.5, minHeight: 36 }}>
          {DESCS[diff]}
        </div>
        <button
          onClick={handleStart}
          disabled={loading}
          style={{
            padding: "14px 0",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg,#2e7d32,#1b5e20)",
            color: "#fff",
            fontSize: 15,
            fontWeight: 800,
            cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: 0.5,
            boxShadow: "0 5px 18px rgba(0,0,0,0.4)",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Dealing…" : "vs AI — Deal Cards"}
        </button>
        <button
          onClick={onMultiplayer}
          style={{
            padding: "11px 0",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "#90caf9",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: 0.5,
          }}
        >
          🔗 Play Online (P2P)
        </button>
      </div>
    </div>
  );
}
