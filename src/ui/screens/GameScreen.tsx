import { useState } from "react";
import type { GameState } from "../../domain/types/game.types";
import { TableScene } from "../scene/TableScene";
import { PlayerHand } from "../hud/PlayerHand";
import { TurnControls } from "../hud/TurnControls";
import { ReactionPanel } from "../hud/ReactionPanel";
import { BottomActions } from "../hud/BottomActions";
import { HowToPlayOverlay } from "../hud/HowToPlayOverlay";

interface Props {
  state: GameState;
  dispatch: (cmd: object) => void;
  names?: { you: string; opponent: string };
}

export function GameScreen({ state, dispatch, names }: Props) {
  const [showHelp, setShowHelp] = useState(true);

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column" }}>
      {/* Top HUD */}
      <div style={{ flexShrink: 0, zIndex: 10 }}>
        <TurnControls state={state} dispatch={dispatch} />
      </div>

      {/* 3D canvas — fills all remaining space between top and bottom HUD */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <TableScene state={state} names={names} />
      </div>

      {/* Bottom HUD */}
      <div style={{ flexShrink: 0, zIndex: 10 }}>
        <ReactionPanel state={state} dispatch={dispatch} />
        <BottomActions state={state} dispatch={dispatch} />
        <PlayerHand state={state} dispatch={dispatch} />
      </div>

      {showHelp && <HowToPlayOverlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}
