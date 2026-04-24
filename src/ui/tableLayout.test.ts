import { describe, expect, it } from "vitest";
import { PROPERTY_COLORS } from "../domain/cards";
import { chooseBotEvents } from "../domain/bot";
import { startGame } from "../domain/commands";
import type { PlayerId } from "../domain/events";
import { applyEvents, projectEvents, type GameState } from "../domain/state";
import {
  CARD_DEPTH,
  CARD_WIDTH,
  TABLE_HALF_DEPTH,
  TABLE_HALF_WIDTH,
  VISIBLE_DECK_CARDS,
  layoutTableCards,
  layoutTableLabels,
  type TableCardPlacement
} from "./tableLayout";

const botPlayers = ["a", "b", "c", "d"].map((id) => ({
  id,
  name: id.toUpperCase(),
  role: "bot" as const
}));

const expectedFaceUpPlacements = (state: GameState) =>
  state.playerOrder.reduce((total, playerId) => {
    const player = state.players[playerId];
    return (
      total +
      Math.min(12, player.hand.length) +
      Math.min(12, player.bank.length) +
      PROPERTY_COLORS.reduce((propertyTotal, color) => {
        const pile = [
          ...player.sets[color].properties,
          ...player.sets[color].improvements
        ];
        return propertyTotal + Math.min(5, pile.length);
      }, 0)
    );
  }, 0);

const footprint = (place: TableCardPlacement) => {
  const cos = Math.abs(Math.cos(place.rotation));
  const sin = Math.abs(Math.sin(place.rotation));
  return {
    halfX: cos * (CARD_WIDTH / 2) + sin * (CARD_DEPTH / 2),
    halfZ: sin * (CARD_WIDTH / 2) + cos * (CARD_DEPTH / 2)
  };
};

const overlapArea = (a: TableCardPlacement, b: TableCardPlacement) => {
  const af = footprint(a);
  const bf = footprint(b);
  const xOverlap = Math.max(0, af.halfX + bf.halfX - Math.abs(a.x - b.x));
  const zOverlap = Math.max(0, af.halfZ + bf.halfZ - Math.abs(a.z - b.z));
  return xOverlap * zOverlap;
};

const stackGroupKey = (place: TableCardPlacement): string | null => {
  const parts = place.key.split(":");
  if (place.zone === "property" && parts.length >= 4) {
    return `${parts[0]}:${parts[1]}:${parts[2]}`;
  }
  if (place.zone === "bank" && parts.length >= 3) {
    return `${parts[0]}:${parts[1]}`;
  }
  if (place.zone === "deck") {
    return "deck";
  }
  return null;
};

describe("table layout", () => {
  it("keeps player hand lanes separated around the table", () => {
    const state = projectEvents(
      startGame({ gameId: "layout-start", seed: "layout-seed", players: botPlayers })
    );
    const placements = layoutTableCards(state);
    const handCenters = botPlayers.map((player) => {
      const hand = placements.filter((place) => place.ownerId === player.id && place.zone === "hand");
      const x = hand.reduce((sum, place) => sum + place.x, 0) / hand.length;
      const z = hand.reduce((sum, place) => sum + place.z, 0) / hand.length;
      return { id: player.id, x, z };
    });

    for (let left = 0; left < handCenters.length; left += 1) {
      for (let right = left + 1; right < handCenters.length; right += 1) {
        const a = handCenters[left];
        const b = handCenters[right];
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(4);
      }
    }
  });

  it("keeps a busy self-play table inside the felt bounds with stable unique placements", () => {
    let state = projectEvents(
      startGame({ gameId: "layout-busy", seed: "layout-busy-seed", players: botPlayers })
    );

    for (let step = 0; step < 120 && state.status === "active"; step += 1) {
      const current = state.currentTurn as PlayerId;
      const events = chooseBotEvents(state, current, "medium");
      state = applyEvents(state, events ?? []);
    }

    const placements = layoutTableCards(state);
    expect(new Set(placements.map((place) => place.key)).size).toBe(placements.length);
    expect(placements.length).toBeGreaterThan(20);
    expect(placements.some((place) => place.zone === "property")).toBe(true);
    expect(placements.filter((place) => place.zone === "deck")).toHaveLength(
      Math.min(VISIBLE_DECK_CARDS, state.deck.length)
    );

    for (const place of placements) {
      const { halfX, halfZ } = footprint(place);
      expect(Math.abs(place.x) + halfX).toBeLessThanOrEqual(TABLE_HALF_WIDTH + 0.01);
      expect(Math.abs(place.z) + halfZ).toBeLessThanOrEqual(TABLE_HALF_DEPTH + 0.01);
    }

    const hands = placements.filter((place) => place.zone === "hand");
    const tableCards = placements.filter((place) => place.zone !== "hand");
    expect(hands.every((place) => place.y >= 0.6 && place.pitch > 0.35)).toBe(true);
    expect(tableCards.every((place) => place.y <= 0.1 && place.pitch === 0)).toBe(true);

    const labels = layoutTableLabels(state);
    expect(labels.length).toBe(state.playerOrder.filter((playerId) => state.players[playerId].bank.length > 0).length);
    for (const label of labels) {
      expect(label.text).toMatch(/^\$\d+M$/);
      expect(Math.abs(label.x)).toBeLessThanOrEqual(TABLE_HALF_WIDTH);
      expect(Math.abs(label.z)).toBeLessThanOrEqual(TABLE_HALF_DEPTH);
    }
  });

  it("does not duplicate physical cards when rendering a completed bot table", () => {
    let state = projectEvents(
      startGame({ gameId: "layout-complete", seed: "layout-busy-seed", players: botPlayers })
    );

    for (let step = 0; step < 1000 && state.status === "active"; step += 1) {
      const current = state.currentTurn as PlayerId;
      const events = chooseBotEvents(state, current, "medium");
      state = applyEvents(state, events ?? []);
    }

    expect(state.status).toBe("won");
    const placements = layoutTableCards(state);
    const faceUpIds = placements
      .map((place) => place.card?.id)
      .filter((id): id is string => typeof id === "string");

    expect(faceUpIds).toHaveLength(expectedFaceUpPlacements(state));
    expect(new Set(faceUpIds).size).toBe(faceUpIds.length);
    expect(placements.filter((place) => place.zone === "deck")).toHaveLength(
      Math.min(VISIBLE_DECK_CARDS, state.deck.length)
    );

    for (const place of placements) {
      const { halfX, halfZ } = footprint(place);
      expect(Math.abs(place.x) + halfX).toBeLessThanOrEqual(TABLE_HALF_WIDTH + 0.01);
      expect(Math.abs(place.z) + halfZ).toBeLessThanOrEqual(TABLE_HALF_DEPTH + 0.01);
    }
  });

  it("spaces unrelated public cards far enough apart to stay readable", () => {
    let state = projectEvents(
      startGame({ gameId: "layout-readable", seed: "layout-busy-seed", players: botPlayers })
    );

    for (let step = 0; step < 1000 && state.status === "active"; step += 1) {
      const current = state.currentTurn as PlayerId;
      const events = chooseBotEvents(state, current, "medium");
      state = applyEvents(state, events ?? []);
    }

    const publicCards = layoutTableCards(state).filter((place) => place.zone !== "hand");
    for (let left = 0; left < publicCards.length; left += 1) {
      for (let right = left + 1; right < publicCards.length; right += 1) {
        const a = publicCards[left];
        const b = publicCards[right];
        const aGroup = stackGroupKey(a);
        const bGroup = stackGroupKey(b);
        if (aGroup !== null && aGroup === bGroup) {
          continue;
        }
        expect(overlapArea(a, b)).toBeLessThan(0.03);
      }
    }
  });
});
