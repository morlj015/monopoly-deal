import { describe, expect, it } from "vitest";
import { PROPERTY_COLORS } from "../domain/cards";
import { chooseBotEvents } from "../domain/bot";
import { startGame } from "../domain/commands";
import type { PlayerId } from "../domain/events";
import { applyEvents, projectEvents, type GameState } from "../domain/state";
import { layoutTableCards } from "./tableLayout";

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
      Math.min(12, state.deck.length)
    );

    for (const place of placements) {
      expect(Math.abs(place.x)).toBeLessThanOrEqual(5);
      expect(Math.abs(place.z)).toBeLessThanOrEqual(3.45);
    }

    const hands = placements.filter((place) => place.zone === "hand");
    const tableCards = placements.filter((place) => place.zone !== "hand");
    expect(hands.every((place) => place.y >= 0.6 && place.pitch > 0.35)).toBe(true);
    expect(tableCards.every((place) => place.y <= 0.1 && place.pitch === 0)).toBe(true);
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
      Math.min(12, state.deck.length)
    );
  });
});
