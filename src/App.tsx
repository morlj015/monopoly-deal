import { Component, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { GameProvider, useGame } from "./application/game.context";
import { MenuScreen } from "./ui/screens/MenuScreen";
import { GameScreen } from "./ui/screens/GameScreen";
import { GameOverScreen } from "./ui/screens/GameOverScreen";
import { MultiplayerScreen } from "./ui/screens/MultiplayerScreen";
import type { GameState } from "./domain/types/game.types";
import type { PlayerNames } from "./infrastructure/multiplayer/multiplayer.service";
import "./app.css";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  render() {
    if (this.state.error) {
      const e = this.state.error as Error;
      return (
        <div style={{ color: "#ff5252", padding: 24, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
          <b>Error:</b> {e.message}{"\n"}{e.stack}
        </div>
      );
    }
    return this.props.children;
  }
}

type Screen = "menu" | "multiplayer";

function AppInner() {
  const { state: soloState, startGame, resetGame, dispatch: soloDispatch } = useGame();
  const [screen, setScreen] = useState<Screen>("menu");

  // Multiplayer live state
  const [mpState, setMpState] = useState<GameState | null>(null);
  const [mpNames, setMpNames] = useState<PlayerNames | null>(null);
  const mpDispatchRef = useRef<((cmd: object) => void) | null>(null);

  // Multiplayer rematch coordination
  const mpSendRematchRef = useRef<(() => void) | null>(null);
  const [myVoted, setMyVoted] = useState(false);
  const [opponentVoted, setOpponentVoted] = useState(false);

  // Reset vote state whenever a new game begins (phase leaves "over")
  useEffect(() => {
    const phase = (mpState ?? soloState)?.phase;
    if (phase && phase !== "over") {
      setMyVoted(false);
      setOpponentVoted(false);
    }
  }, [(mpState ?? soloState)?.phase]);

  const handleMpGame = useCallback((
    initialState: GameState,
    dispatch: (cmd: object) => void,
  ) => {
    setMpState(initialState);
    mpDispatchRef.current = dispatch;
    setScreen("menu");
  }, []);

  const handleMpStateUpdate = useCallback((s: GameState) => {
    setMpState(s);
  }, []);

  const handleRematchReady = useCallback((
    sendVote: () => void,
    onOpponentVote: (cb: () => void) => void,
  ) => {
    mpSendRematchRef.current = sendVote;
    onOpponentVote(() => setOpponentVoted(true));
  }, []);

  const activeState = mpState ?? soloState;
  const isMultiplayer = mpState !== null;

  const activeDispatch = (cmd: object) =>
    mpState ? mpDispatchRef.current?.(cmd) : soloDispatch(cmd as Parameters<typeof soloDispatch>[0]);

  function handleRematch() {
    if (isMultiplayer) {
      setMyVoted(true);
      mpSendRematchRef.current?.();
      // The host will push new state when both have voted;
      // the guest will also receive new state at that point.
    } else {
      startGame(activeState!.difficulty);
    }
  }

  function handleBackToMenu() {
    // Clear all multiplayer state
    setMpState(null);
    setMpNames(null);
    mpDispatchRef.current = null;
    mpSendRematchRef.current = null;
    setMyVoted(false);
    setOpponentVoted(false);
    // Clear solo game state so the menu renders
    resetGame();
  }

  if (screen === "multiplayer") {
    return (
      <MultiplayerScreen
        onGame={(state, dispatch) => {
          mpDispatchRef.current = dispatch;
          handleMpGame(state, dispatch);
        }}
        onStateUpdate={handleMpStateUpdate}
        onNames={setMpNames}
        onRematchReady={handleRematchReady}
        onBack={() => setScreen("menu")}
      />
    );
  }

  if (!activeState) {
    return <MenuScreen onMultiplayer={() => setScreen("multiplayer")} />;
  }

  if (activeState.phase === "over") {
    return (
      <GameOverScreen
        state={activeState}
        isMultiplayer={isMultiplayer}
        myVoted={myVoted}
        opponentVoted={opponentVoted}
        opponentName={mpNames?.opponent}
        onRematch={handleRematch}
        onMenu={handleBackToMenu}
      />
    );
  }

  return <GameScreen state={activeState} dispatch={activeDispatch} names={mpNames ?? undefined} />;
}

export function App() {
  return (
    <ErrorBoundary>
      <GameProvider>
        <AppInner />
      </GameProvider>
    </ErrorBoundary>
  );
}
