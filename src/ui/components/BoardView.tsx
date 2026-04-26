import type { GameState } from "../../domain/types/game.types";
import { CardFace } from "./CardFace";

interface Props {
  state: GameState;
}

export function BoardView({ state }: Props) {
  const deckCount = state.deckSize;
  const discardTop = state.discardPile[0];

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "8px 12px",
      gap: 8,
      overflow: "hidden",
      minHeight: 0,
    }}>

      {/* Center — deck + discard */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
      }}>
        {/* Deck */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <CardFace
            card={{ kind: "money", id: "__deck__", value: 1 }}
            width={48}
            faceDown
          />
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>
            {deckCount} cards
          </div>
        </div>

        {/* Discard */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {discardTop ? (
            <CardFace card={discardTop} width={48} />
          ) : (
            <div style={{
              width: 48, height: 67, borderRadius: 5,
              border: "1.5px dashed rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.2)", fontSize: 20,
            }}>
              ∅
            </div>
          )}
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>
            discard
          </div>
        </div>
      </div>
    </div>
  );
}
