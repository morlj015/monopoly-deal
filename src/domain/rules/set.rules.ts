import type { PropertyColor } from "../types/card.types";
import type { PropertySets } from "../types/game.types";

export const SET_SIZES: Record<PropertyColor, number> = {
  brown: 2,
  lightblue: 3,
  pink: 3,
  orange: 3,
  red: 3,
  yellow: 3,
  green: 3,
  darkblue: 2,
  railroad: 4,
  utility: 2,
};

export function isComplete(sets: PropertySets, color: PropertyColor): boolean {
  const cards = sets[color];
  return cards !== undefined && cards.length >= SET_SIZES[color];
}

export function countComplete(sets: PropertySets): number {
  return (Object.keys(sets) as PropertyColor[]).filter((c) =>
    isComplete(sets, c)
  ).length;
}

export function hasWon(sets: PropertySets): boolean {
  return countComplete(sets) >= 3;
}
