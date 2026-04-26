import { describe, it, expect } from "vitest";
import { calcRent } from "../rules/rent.calculator";
import { isComplete, countComplete, hasWon, SET_SIZES } from "../rules/set.rules";
import { buildDeck } from "../rules/deck.builder";
import type { PropertyColor } from "../types/card.types";
import type { PropertySets } from "../types/game.types";

// ─── Set rules ────────────────────────────────────────────────────────────────

describe("SET_SIZES", () => {
  it("has correct sizes for all colors", () => {
    expect(SET_SIZES.brown).toBe(2);
    expect(SET_SIZES.lightblue).toBe(3);
    expect(SET_SIZES.railroad).toBe(4);
    expect(SET_SIZES.darkblue).toBe(2);
    expect(SET_SIZES.utility).toBe(2);
  });
});

describe("isComplete", () => {
  it("returns false for empty sets", () => {
    expect(isComplete({}, "brown")).toBe(false);
  });

  it("returns false when partially filled", () => {
    const sets: PropertySets = {
      brown: [
        { kind: "property", id: "1", name: "Mediterranean", value: 1, color: "brown" },
      ],
    };
    expect(isComplete(sets, "brown")).toBe(false);
  });

  it("returns true when filled to size", () => {
    const sets: PropertySets = {
      brown: [
        { kind: "property", id: "1", name: "Mediterranean", value: 1, color: "brown" },
        { kind: "property", id: "2", name: "Baltic", value: 1, color: "brown" },
      ],
    };
    expect(isComplete(sets, "brown")).toBe(true);
  });

  it("returns true when overfilled (should not happen normally)", () => {
    const sets: PropertySets = {
      railroad: Array.from({ length: 5 }, (_, i) => ({
        kind: "property" as const,
        id: String(i),
        name: `RR${i}`,
        value: 2,
        color: "railroad" as PropertyColor,
      })),
    };
    expect(isComplete(sets, "railroad")).toBe(true);
  });
});

describe("countComplete", () => {
  it("returns 0 for empty sets", () => {
    expect(countComplete({})).toBe(0);
  });

  it("counts multiple complete sets", () => {
    const sets: PropertySets = {
      brown: [
        { kind: "property", id: "1", name: "A", value: 1, color: "brown" },
        { kind: "property", id: "2", name: "B", value: 1, color: "brown" },
      ],
      darkblue: [
        { kind: "property", id: "3", name: "C", value: 4, color: "darkblue" },
        { kind: "property", id: "4", name: "D", value: 4, color: "darkblue" },
      ],
      lightblue: [
        { kind: "property", id: "5", name: "E", value: 1, color: "lightblue" },
      ],
    };
    expect(countComplete(sets)).toBe(2);
  });
});

describe("hasWon", () => {
  it("returns false with fewer than 3 complete sets", () => {
    const sets: PropertySets = {
      brown: [
        { kind: "property", id: "1", name: "A", value: 1, color: "brown" },
        { kind: "property", id: "2", name: "B", value: 1, color: "brown" },
      ],
    };
    expect(hasWon(sets)).toBe(false);
  });

  it("returns true with exactly 3 complete sets", () => {
    const sets: PropertySets = {
      brown: [
        { kind: "property", id: "1", name: "A", value: 1, color: "brown" },
        { kind: "property", id: "2", name: "B", value: 1, color: "brown" },
      ],
      darkblue: [
        { kind: "property", id: "3", name: "C", value: 4, color: "darkblue" },
        { kind: "property", id: "4", name: "D", value: 4, color: "darkblue" },
      ],
      utility: [
        { kind: "property", id: "5", name: "E", value: 2, color: "utility" },
        { kind: "property", id: "6", name: "F", value: 2, color: "utility" },
      ],
    };
    expect(hasWon(sets)).toBe(true);
  });
});

// ─── Rent calculator ──────────────────────────────────────────────────────────

describe("calcRent", () => {
  const prop = (id: string, color: PropertyColor) => ({
    kind: "property" as const,
    id,
    name: id,
    value: 1,
    color,
  });

  it("returns 0 for empty set", () => {
    expect(calcRent({}, "brown", false, {}, {})).toBe(0);
  });

  it("returns correct rent for 1 brown property", () => {
    const sets: PropertySets = { brown: [prop("1", "brown")] };
    expect(calcRent(sets, "brown", false, {}, {})).toBe(1);
  });

  it("returns correct rent for complete brown set", () => {
    const sets: PropertySets = {
      brown: [prop("1", "brown"), prop("2", "brown")],
    };
    expect(calcRent(sets, "brown", false, {}, {})).toBe(2);
  });

  it("doubles rent when doubled=true", () => {
    const sets: PropertySets = {
      orange: [prop("1", "orange"), prop("2", "orange"), prop("3", "orange")],
    };
    expect(calcRent(sets, "orange", true, {}, {})).toBe(10); // 5 * 2
  });

  it("adds house bonus (+3)", () => {
    const sets: PropertySets = {
      green: [prop("1", "green"), prop("2", "green"), prop("3", "green")],
    };
    expect(calcRent(sets, "green", false, { green: true }, {})).toBe(10); // 7+3
  });

  it("adds hotel bonus (+4, requires house)", () => {
    const sets: PropertySets = {
      green: [prop("1", "green"), prop("2", "green"), prop("3", "green")],
    };
    expect(calcRent(sets, "green", false, { green: true }, { green: true })).toBe(14); // 7+3+4
  });

  it("doubles after adding house and hotel", () => {
    const sets: PropertySets = {
      darkblue: [prop("1", "darkblue"), prop("2", "darkblue")],
    };
    // base=8, house=+3, hotel=+4 → 15, doubled=30
    expect(calcRent(sets, "darkblue", true, { darkblue: true }, { darkblue: true })).toBe(30);
  });

  it("caps rent at max table entry for excess cards", () => {
    const sets: PropertySets = {
      railroad: [
        prop("1", "railroad"),
        prop("2", "railroad"),
        prop("3", "railroad"),
        prop("4", "railroad"),
      ],
    };
    expect(calcRent(sets, "railroad", false, {}, {})).toBe(4);
  });
});

// ─── Deck builder ─────────────────────────────────────────────────────────────

describe("buildDeck", () => {
  it("builds a deck of the correct size (86 cards)", () => {
    // 28 property + 14 money + 36 action + 8 rent = 86
    expect(buildDeck()).toHaveLength(86);
  });

  it("all card IDs are unique", () => {
    const deck = buildDeck();
    const ids = deck.map((c) => c.id);
    expect(new Set(ids).size).toBe(deck.length);
  });

  it("contains 14 money cards", () => {
    // [1,1,1,2,2,3,3,4,4,5] (10) + [10,10,10,10] (4) = 14
    const deck = buildDeck();
    const money = deck.filter((c) => c.kind === "money");
    expect(money).toHaveLength(14);
  });

  it("contains 3 JSN cards", () => {
    const deck = buildDeck();
    const jsn = deck.filter((c) => c.kind === "action" && c.subtype === "jsn");
    expect(jsn).toHaveLength(3);
  });

  it("contains 10 Pass Go cards", () => {
    const deck = buildDeck();
    const pg = deck.filter((c) => c.kind === "action" && c.subtype === "passgo");
    expect(pg).toHaveLength(10);
  });

  it("contains correct property counts", () => {
    const deck = buildDeck();
    const props = deck.filter((c) => c.kind === "property");
    // 2+3+3+3+3+3+3+2+4+2 = 28
    expect(props).toHaveLength(28);
  });
});
