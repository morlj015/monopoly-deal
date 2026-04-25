import {
  buildDeck,
  isBankableCard,
  isImprovementAction,
  isPropertyCard,
  isPropertyWildCard,
  isTablePropertyCard,
  PROPERTY_COLORS,
  PROPERTY_CONFIG,
  type Card
} from "./cards";
import type { PlayerId } from "./events";
import {
  completedSetCount,
  COMPLETE_SETS_TO_WIN,
  isCompleteSet,
  PLAYS_PER_TURN,
  type GameState,
  type PlayerState
} from "./state";

export class DomainInvariantViolation extends Error {
  readonly violations: string[];

  constructor(violations: string[]) {
    super(`Domain invariant violation:\n${violations.map((violation) => `- ${violation}`).join("\n")}`);
    this.name = "DomainInvariantViolation";
    this.violations = violations;
  }
}

export interface InvariantOptions {
  expectedCardCount?: number;
}

interface LocatedCard {
  card: Card;
  zone: string;
}

const playerCards = (playerId: PlayerId, player: PlayerState): LocatedCard[] => [
  ...player.hand.map((card) => ({ card, zone: `${playerId}.hand` })),
  ...player.bank.map((card) => ({ card, zone: `${playerId}.bank` })),
  ...PROPERTY_COLORS.flatMap((color) => [
    ...player.sets[color].properties.map((card) => ({
      card,
      zone: `${playerId}.sets.${color}.properties`
    })),
    ...player.sets[color].improvements.map((card) => ({
      card,
      zone: `${playerId}.sets.${color}.improvements`
    }))
  ])
];

const locatedCards = (state: GameState): LocatedCard[] => [
  ...state.deck.map((card) => ({ card, zone: "deck" })),
  ...state.discard.map((card) => ({ card, zone: "discard" })),
  ...state.playerOrder.flatMap((playerId) => {
    const player = state.players[playerId];
    return player ? playerCards(playerId, player) : [];
  })
];

const collectCardViolations = (
  state: GameState,
  expectedCardCount: number,
  violations: string[]
) => {
  const cards = locatedCards(state);
  if (cards.length !== expectedCardCount) {
    violations.push(`expected ${expectedCardCount} physical cards in zones but found ${cards.length}`);
  }

  const zonesByCardId = new Map<string, string[]>();
  for (const { card, zone } of cards) {
    zonesByCardId.set(card.id, [...(zonesByCardId.get(card.id) ?? []), zone]);
  }
  for (const [cardId, zones] of zonesByCardId) {
    if (zones.length > 1) {
      violations.push(`card ${cardId} appears in multiple zones: ${zones.join(", ")}`);
    }
  }

  if (expectedCardCount === buildDeck().length) {
    const manifestIds = new Set(buildDeck().map((card) => card.id));
    const observedIds = new Set(cards.map(({ card }) => card.id));
    for (const { card, zone } of cards) {
      if (!manifestIds.has(card.id)) {
        violations.push(`unknown card ${card.id} appears in ${zone}`);
      }
    }
    for (const cardId of manifestIds) {
      if (!observedIds.has(cardId)) {
        violations.push(`manifest card ${cardId} is missing from all zones`);
      }
    }
  }
};

const collectPlayerViolations = (
  playerId: PlayerId,
  player: PlayerState,
  violations: string[]
) => {
  for (const card of player.bank) {
    if (!isBankableCard(card)) {
      violations.push(`${playerId}.bank contains non-bankable card ${card.id}`);
    }
  }

  for (const color of PROPERTY_COLORS) {
    const stack = player.sets[color];
    const config = PROPERTY_CONFIG[color];
    for (const property of stack.properties) {
      const rawProperty: unknown = property;
      const card = rawProperty as Card;
      if (!isTablePropertyCard(card)) {
        violations.push(`${playerId}.sets.${color}.properties contains non-property card ${card.id}`);
      } else if (isPropertyCard(card) && card.color !== color) {
        violations.push(`${playerId}.sets.${color}.properties contains ${card.id} from ${card.color}`);
      } else if (isPropertyWildCard(card) && !card.colors.includes(color)) {
        violations.push(`${playerId}.sets.${color}.properties contains incompatible wild ${card.id}`);
      }
    }

    const houseCount = stack.improvements.filter((card) => card.action === "house").length;
    const hotelCount = stack.improvements.filter((card) => card.action === "hotel").length;
    for (const improvement of stack.improvements) {
      const rawImprovement: unknown = improvement;
      const card = rawImprovement as Card;
      if (!isImprovementAction(card)) {
        violations.push(`${playerId}.sets.${color}.improvements contains non-improvement card ${card.id}`);
      }
    }
    if (stack.improvements.length > 0 && !config.canImprove) {
      violations.push(`${playerId}.sets.${color} has improvements on a non-improvable set`);
    }
    if (stack.improvements.length > 0 && !isCompleteSet(stack, color)) {
      violations.push(`${playerId}.sets.${color} has improvements before the set is complete`);
    }
    if (houseCount > 1) {
      violations.push(`${playerId}.sets.${color} has more than one house`);
    }
    if (hotelCount > 1) {
      violations.push(`${playerId}.sets.${color} has more than one hotel`);
    }
    if (hotelCount > 0 && houseCount === 0) {
      violations.push(`${playerId}.sets.${color} has a hotel without a house`);
    }
  }
};

const collectLifecycleViolations = (state: GameState, violations: string[]) => {
  const orderedIds = new Set(state.playerOrder);
  if (orderedIds.size !== state.playerOrder.length) {
    violations.push("playerOrder contains duplicate player ids");
  }

  const playerIds = Object.keys(state.players);
  for (const playerId of state.playerOrder) {
    if (!state.players[playerId]) {
      violations.push(`playerOrder references missing player ${playerId}`);
    }
  }
  for (const playerId of playerIds) {
    if (!orderedIds.has(playerId)) {
      violations.push(`players contains ${playerId} outside playerOrder`);
    }
  }

  if (state.status === "notStarted") {
    if (state.gameId !== null || state.seed !== null) {
      violations.push("notStarted games cannot have game identity");
    }
    if (state.currentTurn !== null || state.winner !== null) {
      violations.push("notStarted games cannot have an active turn or winner");
    }
    if (state.playsRemaining !== 0 || state.mustDraw) {
      violations.push("notStarted games cannot have turn economy state");
    }
    if (state.playerOrder.length > 0 || playerIds.length > 0 || state.deck.length > 0 || state.discard.length > 0) {
      violations.push("notStarted games cannot have seated players or cards");
    }
    return;
  }

  if (!state.gameId || !state.seed) {
    violations.push("started games need gameId and seed");
  }
  if (state.playerOrder.length < 2 || state.playerOrder.length > 5) {
    violations.push("started games must have two to five players");
  }

  if (state.status === "active") {
    if (!state.currentTurn || !orderedIds.has(state.currentTurn)) {
      violations.push("active games need a current turn in playerOrder");
    }
    if (state.winner !== null) {
      violations.push("active games cannot have a winner");
    }
    if (!Number.isInteger(state.playsRemaining) || state.playsRemaining < 0 || state.playsRemaining > PLAYS_PER_TURN) {
      violations.push(`active games need playsRemaining between 0 and ${PLAYS_PER_TURN}`);
    }
    for (const playerId of state.playerOrder) {
      if (completedSetCount(state.players[playerId]) >= COMPLETE_SETS_TO_WIN) {
        violations.push(`${playerId} has a winning board while the game is still active`);
      }
    }
    return;
  }

  if (state.status === "won") {
    if (!state.winner || !orderedIds.has(state.winner)) {
      violations.push("won games need a winner in playerOrder");
    }
    if (state.currentTurn !== null || state.playsRemaining !== 0 || state.mustDraw) {
      violations.push("won games cannot keep active turn state");
    }
  }
};

export const collectGameInvariantViolations = (
  state: GameState,
  options: InvariantOptions = {}
): string[] => {
  const violations: string[] = [];
  const expectedCardCount =
    options.expectedCardCount ?? (state.status === "notStarted" ? 0 : buildDeck().length);

  collectLifecycleViolations(state, violations);
  collectCardViolations(state, expectedCardCount, violations);
  for (const playerId of state.playerOrder) {
    const player = state.players[playerId];
    if (player) {
      collectPlayerViolations(playerId, player, violations);
    }
  }

  return violations;
};

export const assertGameInvariants = (
  state: GameState,
  options: InvariantOptions = {}
): void => {
  const violations = collectGameInvariantViolations(state, options);
  if (violations.length > 0) {
    throw new DomainInvariantViolation(violations);
  }
};
