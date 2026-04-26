import { useState, useEffect, useRef } from "react";
import { WebRTCPeer } from "../../infrastructure/multiplayer/webrtc-peer";
import { MultiplayerHost, MultiplayerGuest, type PlayerNames } from "../../infrastructure/multiplayer/multiplayer.service";
import type { GameState } from "../../domain/types/game.types";

interface Props {
  onGame: (state: GameState, dispatch: (cmd: object) => void) => void;
  onStateUpdate: (state: GameState) => void;
  onNames: (names: PlayerNames) => void;
  onRematchReady: (sendVote: () => void, onOpponentVote: (cb: () => void) => void) => void;
  onBack: () => void;
}

type Step =
  | "choose"
  | "host-waiting"
  | "host-starting"
  | "guest-enter"
  | "guest-joining"
  | "error";

export function MultiplayerScreen({ onGame, onStateUpdate, onNames, onRematchReady, onBack }: Props) {
  const [step, setStep] = useState<Step>("choose");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [err, setErr] = useState("");
  const peerRef = useRef<WebRTCPeer | null>(null);
  const gameStartedRef = useRef(false);

  // Only close the peer if we never handed it off to a live game.
  // Once a game starts the screen unmounts but the peer must stay alive.
  useEffect(() => () => { if (!gameStartedRef.current) peerRef.current?.close(); }, []);

  // ── Host flow ──────────────────────────────────────────────────────────────

  async function startHost() {
    setErr("");
    try {
      const name = playerName.trim() || "Host";
      const peer = new WebRTCPeer("host");
      peerRef.current = peer;

      let started = false;
      const host = new MultiplayerHost(peer, name, (s) => {
        if (!started) {
          started = true;
          gameStartedRef.current = true;
          onGame(s, (cmd) => host.dispatch(cmd as never));
          onRematchReady(
            () => host.sendRematchVote(),
            (cb) => host.onOpponentVote(cb),
          );
        } else {
          onStateUpdate(s);
        }
      });

      host.onNamesResolved(onNames);

      peer.onConnect(() => {
        setStep("host-starting");
        host.startGame().catch((e: Error) => {
          setErr(e.message);
          setStep("error");
        });
      });

      const code = await host.openRoom();
      setRoomCode(code);
      setStep("host-waiting");
    } catch (e) {
      setErr((e as Error).message);
      setStep("error");
    }
  }

  // ── Guest flow ─────────────────────────────────────────────────────────────

  async function joinGame() {
    const code = inputCode.trim().toUpperCase();
    if (code.length !== 4) return;
    setStep("guest-joining");
    setErr("");
    try {
      const name = playerName.trim() || "Guest";
      const peer = new WebRTCPeer("guest");
      peerRef.current = peer;

      const guest = new MultiplayerGuest(peer, name);

      guest.onNamesResolved(onNames);

      let started = false;
      guest.onStateChange((s) => {
        if (!started) {
          started = true;
          gameStartedRef.current = true;
          onGame(s, (cmd) => guest.dispatch(cmd as never));
          onRematchReady(
            () => guest.sendRematchVote(),
            (cb) => guest.onOpponentVote(cb),
          );
        } else {
          onStateUpdate(s);
        }
      });

      await peer.join(code);
    } catch (e) {
      setErr((e as Error).message);
      setStep("error");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      <button onClick={onBack} style={styles.back}>← Back</button>
      <div style={styles.title}>Online Multiplayer</div>
      <div style={styles.subtitle}>Peer-to-peer — no account needed</div>

      {step === "choose" && (
        <div style={styles.card}>
          <div style={styles.label}>Your name</div>
          <input
            autoFocus
            maxLength={20}
            placeholder="Enter your name…"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            style={styles.nameInput}
          />
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <button
              onClick={startHost}
              disabled={!playerName.trim()}
              style={{ ...styles.btn, background: "#2e7d32", opacity: playerName.trim() ? 1 : 0.5 }}
            >
              Host a game
            </button>
            <button
              onClick={() => setStep("guest-enter")}
              disabled={!playerName.trim()}
              style={{ ...styles.btn, background: "#1565c0", opacity: playerName.trim() ? 1 : 0.5 }}
            >
              Join a game
            </button>
          </div>
        </div>
      )}

      {step === "host-waiting" && (
        <div style={styles.card}>
          <div style={styles.label}>Your room code</div>
          <div style={styles.codeDisplay}>{roomCode}</div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center" }}>
            Share this code with your opponent.<br />Waiting for them to join…
          </div>
          <Spinner />
        </div>
      )}

      {step === "host-starting" && (
        <div style={styles.card}><Spinner /> Starting game…</div>
      )}

      {step === "guest-enter" && (
        <div style={styles.card}>
          <div style={styles.label}>Enter room code</div>
          <input
            autoFocus
            maxLength={4}
            placeholder="ABCD"
            value={inputCode}
            onChange={e => setInputCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && joinGame()}
            style={styles.codeInput}
          />
          <button
            onClick={joinGame}
            disabled={inputCode.trim().length !== 4}
            style={{ ...styles.btn, background: "#1565c0", opacity: inputCode.trim().length !== 4 ? 0.5 : 1 }}
          >
            Join →
          </button>
        </div>
      )}

      {step === "guest-joining" && (
        <div style={styles.card}><Spinner /> Connecting to game…</div>
      )}

      {step === "error" && (
        <div style={styles.card}>
          <div style={{ color: "#ff5252", marginBottom: 12 }}>{err || "Connection failed"}</div>
          <button onClick={() => { setStep("choose"); setInputCode(""); }} style={styles.btn}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 8 }}>
      <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
    </div>
  );
}

const styles = {
  root: {
    display: "flex" as const,
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    gap: 16,
    padding: 24,
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: "#e8f5e9",
  },
  back: {
    position: "absolute" as const,
    top: 16, left: 16,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#fff",
    borderRadius: 8,
    padding: "6px 14px",
    cursor: "pointer",
    fontSize: 13,
  },
  title: { fontSize: 32, fontWeight: 900, letterSpacing: -1 },
  subtitle: { color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: -8 },
  card: {
    background: "rgba(0,0,0,0.4)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 18,
    padding: "28px 32px",
    width: "100%",
    maxWidth: 380,
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    color: "#e8f5e9",
    fontSize: 14,
    alignItems: "stretch",
  },
  label: {
    fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
    textTransform: "uppercase" as const, color: "#81c784",
  },
  btn: {
    padding: "13px 0",
    borderRadius: 10,
    border: "none",
    background: "#1565c0",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    flex: 1,
  },
  nameInput: {
    fontSize: 16,
    padding: "10px 14px",
    borderRadius: 10,
    border: "2px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    outline: "none",
    width: "100%",
  },
  codeDisplay: {
    fontSize: 52,
    fontWeight: 900,
    letterSpacing: 14,
    textAlign: "center" as const,
    color: "#fff",
    padding: "12px 0",
    fontFamily: "monospace",
  },
  codeInput: {
    fontSize: 42,
    fontWeight: 900,
    letterSpacing: 12,
    textAlign: "center" as const,
    background: "rgba(255,255,255,0.06)",
    border: "2px solid rgba(255,255,255,0.2)",
    borderRadius: 12,
    color: "#fff",
    padding: "10px",
    fontFamily: "monospace",
    width: "100%",
    outline: "none",
  },
};
