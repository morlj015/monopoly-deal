import { PROPERTY_COLORS, PROPERTY_CONFIG } from "./cards";
import {
  bankValue,
  completedSetColors,
  propertyValue,
  rentFor,
  type GameState,
  type PlayerState
} from "./state";

export interface SnapshotPlayer {
  id: string;
  name: string;
  role: PlayerState["role"];
  handTotal: number;
  bankValue: number;
  propertyValue: number;
  exposedValue: number;
  completedSets: number;
  rentPotential: number;
  propertiesByColor: Record<string, number>;
}

export interface GameSnapshot {
  gameId: string;
  seq: number;
  ts: number;
  status: GameState["status"];
  currentPlayer: string | null;
  winner: string | null;
  deckTotal: number;
  discardTotal: number;
  players: SnapshotPlayer[];
}

export const buildSnapshot = (state: GameState): GameSnapshot => ({
  gameId: state.gameId ?? "unknown",
  seq: state.version,
  ts: Date.now(),
  status: state.status,
  currentPlayer: state.currentTurn,
  winner: state.winner,
  deckTotal: state.deck.length,
  discardTotal: state.discard.length,
  players: state.playerOrder.map((playerId) => {
    const player = state.players[playerId];
    const propertiesByColor: Record<string, number> = {};
    let rentPotential = 0;
    for (const color of PROPERTY_COLORS) {
      propertiesByColor[color] = player.sets[color].properties.length;
      if (player.sets[color].properties.length > 0) {
        rentPotential += rentFor(player, color);
      }
    }
    const bank = bankValue(player);
    const property = propertyValue(player);
    return {
      id: player.id,
      name: player.name,
      role: player.role,
      handTotal: player.hand.length,
      bankValue: bank,
      propertyValue: property,
      exposedValue: bank + property,
      completedSets: completedSetColors(player).length,
      rentPotential,
      propertiesByColor
    };
  })
});

export const colorLabels = Object.fromEntries(
  PROPERTY_COLORS.map((color) => [color, PROPERTY_CONFIG[color].label])
);
