import type { Card } from "../domain/cards";
import { PROPERTY_COLORS } from "../domain/cards";
import type { GameState, PlayerState } from "../domain/state";

export type TableZone = "hand" | "bank" | "property" | "deck";

export interface TableCardPlacement {
  key: string;
  card?: Card;
  ownerId?: string;
  zone: TableZone;
  x: number;
  y: number;
  z: number;
  rotation: number;
  pitch: number;
  layer: number;
}

interface Vec2 {
  x: number;
  z: number;
}

interface SeatFrame {
  dir: Vec2;
  tangent: Vec2;
  rotation: number;
}

const fixedFrames: SeatFrame[] = [
  { dir: { x: 0, z: 1 }, tangent: { x: 1, z: 0 }, rotation: 0 },
  { dir: { x: 1, z: 0 }, tangent: { x: 0, z: -1 }, rotation: Math.PI / 2 },
  { dir: { x: 0, z: -1 }, tangent: { x: -1, z: 0 }, rotation: Math.PI },
  { dir: { x: -1, z: 0 }, tangent: { x: 0, z: 1 }, rotation: -Math.PI / 2 },
  { dir: { x: 0.7, z: 0.7 }, tangent: { x: 0.7, z: -0.7 }, rotation: Math.PI / 4 }
];

const mul = (v: Vec2, scalar: number): Vec2 => ({ x: v.x * scalar, z: v.z * scalar });
const add = (...vectors: Vec2[]): Vec2 =>
  vectors.reduce((sum, vector) => ({ x: sum.x + vector.x, z: sum.z + vector.z }), { x: 0, z: 0 });

const placement = (
  key: string,
  zone: TableZone,
  ownerId: string | undefined,
  card: Card | undefined,
  base: Vec2,
  rotation: number,
  layer: number,
  y = 0.08,
  pitch = 0
): TableCardPlacement => ({
  key,
  zone,
  ownerId,
  card,
  x: Number(base.x.toFixed(3)),
  y: Number(y.toFixed(3)),
  z: Number(base.z.toFixed(3)),
  rotation,
  pitch,
  layer
});

const handPlacements = (
  player: PlayerState,
  frame: SeatFrame,
  revealHand: boolean
): TableCardPlacement[] => {
  const cards = player.hand.slice(0, 12);
  const center = mul(frame.dir, 3.18);
  const count = cards.length;
  return cards.map((card, index) => {
    const handIndex = index - (count - 1) / 2;
    const offset = handIndex * 0.34;
    return placement(
      `${player.id}:hand:${card.id}`,
      "hand",
      player.id,
      revealHand ? card : undefined,
      add(center, mul(frame.tangent, offset)),
      frame.rotation + handIndex * 0.025,
      index * 0.006,
      0.62,
      0.44
    );
  });
};

const bankPlacements = (player: PlayerState, frame: SeatFrame): TableCardPlacement[] => {
  const center = mul(frame.dir, 2.32);
  return player.bank.slice(0, 12).map((card, index) =>
    placement(
      `${player.id}:bank:${card.id}`,
      "bank",
      player.id,
      card,
      add(center, mul(frame.tangent, (index % 6) * 0.055), mul(frame.dir, Math.floor(index / 6) * -0.08)),
      frame.rotation,
      index * 0.024
    )
  );
};

const propertyPlacements = (player: PlayerState, frame: SeatFrame): TableCardPlacement[] => {
  const occupied = PROPERTY_COLORS.map((color) => ({
    color,
    cards: [...player.sets[color].properties, ...player.sets[color].improvements]
  })).filter((entry) => entry.cards.length > 0);
  const center = mul(frame.dir, 1.42);

  return occupied.flatMap((entry, groupIndex) => {
    const groupOffset = (groupIndex - (occupied.length - 1) / 2) * 0.5;
    const groupBase = add(center, mul(frame.tangent, groupOffset));
    return entry.cards.slice(0, 5).map((card, index) =>
      placement(
        `${player.id}:property:${entry.color}:${card.id}`,
        "property",
        player.id,
        card,
        add(groupBase, mul(frame.dir, index * -0.085)),
        frame.rotation,
        index * 0.025
      )
    );
  });
};

export const layoutTableCards = (state: GameState): TableCardPlacement[] => {
  const players = state.playerOrder.map((playerId) => state.players[playerId]).filter(Boolean);
  const visiblePlayers = players.slice(0, 5);
  const revealAll = visiblePlayers.length > 0 && visiblePlayers.every((player) => player.role === "bot");

  const placements: TableCardPlacement[] = [];
  visiblePlayers.forEach((player, index) => {
    const frame = fixedFrames[index] ?? fixedFrames[0];
    const revealHand = revealAll || player.role === "human" || state.currentTurn === player.id;
    placements.push(...handPlacements(player, frame, revealHand));
    placements.push(...bankPlacements(player, frame));
    placements.push(...propertyPlacements(player, frame));
  });

  state.deck.slice(0, Math.min(12, state.deck.length)).forEach((_card, index) => {
    placements.push(
      placement(
        `deck:${index}`,
        "deck",
        undefined,
        undefined,
        { x: 0.2 + index * 0.018, z: 0 },
        -0.05,
        index * 0.026
      )
    );
  });

  return placements;
};
