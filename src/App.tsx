import { Component, useState, useCallback, useRef, type ReactNode } from "react";
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
  const { state: soloState, startGame, dispatch: soloDispatch } = useGame();
  const [screen, setScreen] = useState<Screen>("menu");

  // Multiplayer live state
  const [mpState, setMpState] = useState<GameState | null>(null);
  const [mpNames, setMpNames] = useState<PlayerNames | null>(null);
  const mpDispatchRef = useRef<((cmd: object) => void) | null>(null);

  const handleMpGame = useCallback((
    initialState: GameState,
    dispatch: (cmd: object) => void,
  ) => {
    setMpState(initialState);
    mpDispatchRef.current = dispatch;
    setScreen("menu");
  }, []);

  // Hook for MultiplayerScreen to give us live state updates
  const handleMpStateUpdate = useCallback((s: GameState) => {
    setMpState(s);
  }, []);

  const activeState = mpState ?? soloState;
  const activeDispatch = (cmd: object) =>
    mpState ? mpDispatchRef.current?.(cmd) : soloDispatch(cmd as Parameters<typeof soloDispatch>[0]);

  if (screen === "multiplayer") {
    return (
      <MultiplayerScreen
        onGame={(state, dispatch) => {
          mpDispatchRef.current = dispatch;
          handleMpGame(state, dispatch);
        }}
        onStateUpdate={handleMpStateUpdate}
        onNames={setMpNames}
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
        onRematch={() => {
          setMpState(null);
          setMpNames(null);
          mpDispatchRef.current = null;
          startGame(activeState.difficulty);
        }}
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
