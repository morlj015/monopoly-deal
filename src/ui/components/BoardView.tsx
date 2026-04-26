import type { GameState, PlayerId } from "../../domain/types/game.types";
import type { PropertyColor } from "../../domain/types/card.types";
import { CardFace, PROP_COLOR, RENT_TABLE } from "./CardFace";
import { isComplete } from "../../domain/rules/set.rules";

interface Props {
  state: GameState;
}

function SetZone({ state, playerId, mini }: { state: GameState; playerId: PlayerId; mini?: boolean }) {
  const player = state.players[playerId];
  const colors = Object.keys(player.sets) as PropertyColor[];
  const cardW = mini ? 44 : 56;

  if (colors.length === 0) {
    return (
      <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, fontStyle: "italic", padding: "4px 0" }}>
        No properties yet
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {colors.map((color) => {
        const cards = player.sets[color] ?? [];
        const complete = isComplete(player.sets, color);
        const hasHouse = !!player.houses[color];
        const hasHotel = !!player.hotels[color];
        const rentIdx = Math.min(cards.length, RENT_TABLE[color].length) - 1;
        const currentRent = rentIdx >= 0 ? RENT_TABLE[color][rentIdx] + (hasHouse ? 3 : 0) + (hasHotel ? 4 : 0) : 0;

        return (
          <div key={color} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            {/* Set header badge */}
            <div style={{
              background: PROP_COLOR[color],
              color: color === "yellow" ? "#212121" : "#fff",
              fontSize: 9,
              fontWeight: 800,
              borderRadius: 4,
              padding: "1px 6px",
              border: complete ? "1.5px solid #ffd740" : "1.5px solid transparent",
              boxShadow: complete ? "0 0 6px rgba(255,215,64,0.6)" : undefined,
              textTransform: "capitalize",
            }}>
              {complete ? "★ " : ""}{color === "lightblue" ? "Lt.Blue" : color === "darkblue" ? "Dk.Blue" : color}
              {hasHotel ? " 🏨" : hasHouse ? " 🏠" : ""}
            </div>

            {/* Stacked cards */}
            <div style={{ position: "relative", width: cardW, height: Math.round(cardW * 1.4 + (cards.length - 1) * 6) }}>
              {cards.map((card, i) => (
                <div key={card.id} style={{ position: "absolute", top: i * 6, left: 0 }}>
                  <CardFace card={card} width={cardW} />
                </div>
              ))}
            </div>

            {/* Rent label */}
            <div style={{ fontSize: 9, color: "#a5d6a7", fontWeight: 700 }}>
              ${currentRent}M rent
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BoardView({ state }: Props) {
  const deckCount = state.deckSize;
  const discardTop = state.discardPile[0];

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      padding: "8px 12px",
      gap: 8,
      overflow: "hidden",
      minHeight: 0,
    }}>

      {/* AI zone */}
      <div style={{
        background: "rgba(239,83,80,0.07)",
        border: "1px solid rgba(239,83,80,0.18)",
        borderRadius: 10,
        padding: "8px 12px",
        flex: "0 0 auto",
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#ef9a9a", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
          AI Properties ({Object.keys(state.players.ai.sets).length} sets)
        </div>
        <SetZone state={state} playerId="ai" mini />
      </div>

      {/* Center — deck + discard */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        flex: "0 0 auto",
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

      {/* Player zone */}
      <div style={{
        background: "rgba(102,187,106,0.07)",
        border: "1px solid rgba(102,187,106,0.18)",
        borderRadius: 10,
        padding: "8px 12px",
        flex: "1 1 0",
        overflow: "auto",
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#a5d6a7", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
          Your Properties ({Object.keys(state.players.player.sets).length} sets)
        </div>
        <SetZone state={state} playerId="player" />
      </div>
    </div>
  );
}
