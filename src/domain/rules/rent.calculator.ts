import type { PropertyColor } from "../types/card.types";
import type { PropertySets } from "../types/game.types";

const RENT_TABLE: Record<PropertyColor, number[]> = {
  brown: [1, 2],
  lightblue: [1, 2, 3],
  pink: [1, 2, 4],
  orange: [1, 3, 5],
  red: [2, 3, 6],
  yellow: [2, 4, 6],
  green: [2, 4, 7],
  darkblue: [3, 8],
  railroad: [1, 2, 3, 4],
  utility: [1, 2],
};

export function calcRent(
  sets: PropertySets,
  color: PropertyColor,
  doubled: boolean,
  houses: Partial<Record<PropertyColor, true>>,
  hotels: Partial<Record<PropertyColor, true>>
): number {
  const cards = sets[color];
  if (!cards || cards.length === 0) return 0;
  const table = RENT_TABLE[color];
  const base = table[Math.min(cards.length - 1, table.length - 1)] ?? 0;
  const extras = (houses[color] ? 3 : 0) + (hotels[color] ? 4 : 0);
  const total = base + extras;
  return doubled ? total * 2 : total;
}
