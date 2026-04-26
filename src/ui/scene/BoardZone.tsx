import { CardMesh } from "./CardMesh";
import type { GameState, PlayerId } from "../../domain/types/game.types";
import type { PropertyCard, PropertyColor } from "../../domain/types/card.types";

interface Props {
  state: GameState;
  playerId: PlayerId;
  position: [number, number, number];
  rotated?: boolean;
}

/** Renders a player's property sets flat on the table surface */
export function BoardZone({ state, playerId, position, rotated = false }: Props) {
  const player = state.players[playerId];
  const colors = Object.keys(player.sets) as PropertyColor[];
  if (colors.length === 0) return null;

  const yRot = rotated ? Math.PI : 0;

  return (
    <group position={position} rotation={[0, yRot, 0]}>
      {colors.map((color, ci) => {
        const cards = player.sets[color] as PropertyCard[];
        return (
          <group key={color} position={[ci * 1.0 - (colors.length - 1) * 0.5, 0, 0]}>
            {cards.map((card, ki) => (
              <CardMesh
                key={card.id}
                card={card}
                position={[ki * 0.06, 0.002 + ki * 0.002, ki * 0.06]}
                rotation={[-Math.PI / 2, 0, 0]}
                scale={0.85}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}
