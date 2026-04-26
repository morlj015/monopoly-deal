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
    prop("brown", "Mediterranean Ave", 1),
    prop("brown", "Baltic Ave", 1),
    // Light Blue
    prop("lightblue", "Oriental Ave", 1),
    prop("lightblue", "Vermont Ave", 1),
    prop("lightblue", "Connecticut Ave", 2),
    // Pink
    prop("pink", "St. Charles Place", 2),
    prop("pink", "States Ave", 2),
    prop("pink", "Virginia Ave", 2),
    // Orange
    prop("orange", "St. James Place", 2),
    prop("orange", "Tennessee Ave", 2),
    prop("orange", "New York Ave", 2),
    // Red
    prop("red", "Kentucky Ave", 3),
    prop("red", "Indiana Ave", 3),
    prop("red", "Illinois Ave", 3),
    // Yellow
    prop("yellow", "Atlantic Ave", 3),
    prop("yellow", "Ventnor Ave", 3),
    prop("yellow", "Marvin Gardens", 3),
    // Green
    prop("green", "Pacific Ave", 4),
    prop("green", "North Carolina Ave", 4),
    prop("green", "Pennsylvania Ave", 4),
    // Dark Blue
    prop("darkblue", "Park Place", 4),
    prop("darkblue", "Boardwalk", 4),
    // Railroads
    prop("railroad", "Reading Railroad", 2),
    prop("railroad", "Pennsylvania Railroad", 2),
    prop("railroad", "B&O Railroad", 2),
    prop("railroad", "Short Line Railroad", 2),
    // Utilities
    prop("utility", "Electric Company", 2),
    prop("utility", "Water Works", 2),
    // Wild property cards
    wild(["green", "darkblue"],           "Wild: Green/Dark Blue",       4),
    wild(["green", "railroad"],           "Wild: Green/Railroad",        4),
    wild(["lightblue", "brown"],          "Wild: Light Blue/Brown",      1),
    wild(["lightblue", "railroad"],       "Wild: Light Blue/Railroad",   4),
    wild(["pink", "orange"],              "Wild: Pink/Orange",           2),
    wild(["pink", "orange"],              "Wild: Pink/Orange",           2),
    wild(["red", "yellow"],              "Wild: Red/Yellow",            3),
    wild(["red", "yellow"],              "Wild: Red/Yellow",            3),
    wild(["railroad", "railroad"],        "Wild: Railroad",              4),
    wild(["railroad", "railroad"],        "Wild: Railroad",              4),
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
