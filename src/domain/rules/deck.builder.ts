import { v4 as uuid } from "uuid";
import type { Card, PropertyColor, ActionSubtype } from "../types/card.types";

const prop = (color: PropertyColor, name: string, value: number): Card => ({
  kind: "property",
  id: uuid(),
  color,
  name,
  value,
});

const wild = (colors: PropertyColor[], name: string, value: number): Card => ({
  kind: "property",
  id: uuid(),
  color: colors[0],
  colors,
  name,
  value,
});

const money = (value: number): Card => ({
  kind: "money",
  id: uuid(),
  value,
});

const action = (
  name: string,
  value: number,
  subtype: ActionSubtype,
  extra: { amount?: number } = {}
): Card => ({
  kind: "action",
  id: uuid(),
  name,
  value,
  subtype,
  ...extra,
});

const rent = (colors: PropertyColor[], value: number): Card => ({
  kind: "rent",
  id: uuid(),
  value,
  colors,
  isWild: colors.length > 2,
});

export function buildDeck(): Card[] {
  const cards: Card[] = [
    // Brown
    prop("brown", "Silver City", 1),
    prop("brown", "Shortcuts", 1),
    // Light Blue
    prop("lightblue", "North Lane", 1),
    prop("lightblue", "Upper Drive", 1),
    prop("lightblue", "Golden Acre", 2),
    // Pink
    prop("pink", "Cricket Field", 2),
    prop("pink", "The Green", 2),
    prop("pink", "Lashmar Rec", 2),
    // Orange
    prop("orange", "One Stop", 2),
    prop("orange", "Hedges", 2),
    prop("orange", "Seaview Stores", 2),
    // Red
    prop("red", "Masala Lounge", 3),
    prop("red", "Reema", 3),
    prop("red", "So India", 3),
    // Yellow
    prop("yellow", "The Tudor", 3),
    prop("yellow", "Seaview", 3),
    prop("yellow", "Clockhouse", 3),
    // Green
    prop("green", "Perfect Pizza", 4),
    prop("green", "Noah's House", 4),
    prop("green", "The Cage", 4),
    // Dark Blue
    prop("darkblue", "Max's Flat", 4),
    prop("darkblue", "EPL Bridge", 4),
    // Cafes
    prop("railroad", "Grub & Grumption", 2),
    prop("railroad", "Salt Cafe", 2),
    prop("railroad", "Seahorse", 2),
    prop("railroad", "Great Dane", 2),
    // Utilities
    prop("utility", "EPFC", 2),
    prop("utility", "Premier Barbers", 2),
    // Wild property cards
    wild(["green", "darkblue"],           "Wild: Green/Dark Blue",       4),
    wild(["green", "railroad"],           "Wild: Green/Cafe",            4),
    wild(["lightblue", "brown"],          "Wild: Light Blue/Brown",      1),
    wild(["lightblue", "railroad"],       "Wild: Light Blue/Cafe",       4),
    wild(["pink", "orange"],              "Wild: Pink/Orange",           2),
    wild(["pink", "orange"],              "Wild: Pink/Orange",           2),
    wild(["red", "yellow"],              "Wild: Red/Yellow",            3),
    wild(["red", "yellow"],              "Wild: Red/Yellow",            3),
    wild(["railroad", "railroad"],        "Wild: Cafe",                  4),
    wild(["railroad", "railroad"],        "Wild: Cafe",                  4),
    wild(["utility", "utility"],          "Wild: Utility",               2),
    wild(["brown","lightblue","pink","orange","red","yellow","green","darkblue","railroad","utility"], "Property Wild", 0),
    wild(["brown","lightblue","pink","orange","red","yellow","green","darkblue","railroad","utility"], "Property Wild", 0),
    // Money
    ...([1, 1, 1, 2, 2, 3, 3, 4, 4, 5] as const).map(money),
    ...[10, 10, 10, 10].map(money),
    // Actions
    ...Array.from({ length: 10 }, () => action("Pass Go", 1, "passgo")),
    ...Array.from({ length: 3 }, () => action("Deal Breaker", 5, "dealbreaker")),
    ...Array.from({ length: 3 }, () => action("Sly Deal", 3, "slydeal")),
    ...Array.from({ length: 4 }, () => action("Forced Deal", 3, "forceddeal")),
    ...Array.from({ length: 3 }, () =>
      action("Debt Collector", 3, "debtcollector", { amount: 5 })
    ),
    ...Array.from({ length: 3 }, () =>
      action("It's My Birthday", 2, "birthday", { amount: 2 })
    ),
    ...Array.from({ length: 3 }, () => action("Just Say No!", 4, "jsn")),
    ...Array.from({ length: 3 }, () => action("Double the Rent", 1, "doublerent")),
    ...Array.from({ length: 2 }, () => action("House", 3, "house")),
    ...Array.from({ length: 2 }, () => action("Hotel", 4, "hotel")),
    // Rent cards
    rent(["brown", "lightblue"], 1),
    rent(["pink", "orange"], 1),
    rent(["red", "yellow"], 1),
    rent(["green", "darkblue"], 1),
    rent(["railroad", "utility"], 1),
    ...Array.from({ length: 3 }, () =>
      rent(
        ["brown", "lightblue", "pink", "orange", "red", "yellow", "green", "darkblue", "railroad", "utility"],
        3
      )
    ),
  ];
  return cards;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildShuffledDeck(): Card[] {
  return shuffle(buildDeck());
}
