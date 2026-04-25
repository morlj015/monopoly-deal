import {
  isActionCard,
  isBankableCard,
  isImprovementAction,
  isPropertyWildCard,
  isRentCard,
  isTablePropertyCard,
  PROPERTY_COLORS,
  PROPERTY_CONFIG,
  type Card,
  type PropertyColor,
  type TablePropertyCard
} from "./cards";
import {
  buildImprovement,
  discardCards,
  drawAtTurnStart,
  endTurn,
  playBirthday,
  playCardToBank,
  playDealBreaker,
  playDebtCollector,
  playForcedDeal,
  playPassGo,
  playProperty,
  playRent,
  playSlyDeal
} from "./commands";
import { DomainRuleViolation } from "./errors";
import type { DomainEvent, PlayerId } from "./events";
import {
  completedSetColors,
  GameState,
  HAND_LIMIT,
  isCompleteSet,
  opponentsOf,
  rentFor
} from "./state";

export type BotDifficulty = "easy" | "medium" | "hard";
export type BotStrategyId = BotDifficulty | (string & {});

export interface BotStrategyContext {
  state: GameState;
  playerId: PlayerId;
}

export type BotTactic = (context: BotStrategyContext) => DomainEvent[] | null;

export interface BotStrategyPlugin {
  id: BotStrategyId;
  name: string;
  description: string;
  chooseEvents: (context: BotStrategyContext) => DomainEvent[] | null;
}

export const DEFAULT_BOT_STRATEGY_ID: BotDifficulty = "medium";
export const COMPETITION_BOT_STRATEGY_IDS = [
  "builder",
  "rent-shark",
  "deal-thief",
  "banker"
] as const satisfies readonly BotStrategyId[];

const strategies = new Map<string, BotStrategyPlugin>();

export const registerBotStrategy = (plugin: BotStrategyPlugin): BotStrategyPlugin => {
  if (!plugin.id.trim()) {
    throw new Error("Bot strategy plugins need a stable id.");
  }
  strategies.set(plugin.id, plugin);
  return plugin;
};

export const listBotStrategies = (): BotStrategyPlugin[] => [...strategies.values()];

export const getBotStrategy = (
  strategyId: BotStrategyId = DEFAULT_BOT_STRATEGY_ID
): BotStrategyPlugin => {
  const strategy = strategies.get(strategyId) ?? strategies.get(DEFAULT_BOT_STRATEGY_ID);
  if (!strategy) {
    throw new Error("Default bot strategy has not been registered.");
  }
  return strategy;
};

export const createOrderedBotStrategy = ({
  id,
  name,
  description,
  tactics
}: {
  id: BotStrategyId;
  name: string;
  description: string;
  tactics: readonly BotTactic[];
}): BotStrategyPlugin => ({
  id,
  name,
  description,
  chooseEvents: (context) => {
    for (const tactic of tactics) {
      const events = tactic(context);
      if (events && events.length > 0) {
        return events;
      }
    }
    return null;
  }
});

const attempt = (factory: () => DomainEvent[]): DomainEvent[] | null => {
  try {
    return factory();
  } catch (error) {
    if (error instanceof DomainRuleViolation) {
      return null;
    }
    throw error;
  }
};

const firstOpponentId = (state: GameState, playerId: PlayerId): PlayerId | null =>
  opponentsOf(state, playerId).sort(
    (left, right) =>
      right.bank.reduce((sum, card) => sum + card.value, 0) -
      left.bank.reduce((sum, card) => sum + card.value, 0)
  )[0]?.id ?? null;

const cardValueAsc = (left: Card, right: Card) => left.value - right.value;
const cardValueDesc = (left: Card, right: Card) => right.value - left.value;

const choosePropertyColor = (
  state: GameState,
  playerId: PlayerId,
  cardId: string
): PropertyColor | undefined => {
  const player = state.players[playerId];
  const card = player.hand.find((candidate) => candidate.id === cardId);
  if (!card || !isTablePropertyCard(card)) {
    return undefined;
  }
  const hasRoom = (color: PropertyColor) =>
    player.sets[color].properties.length < PROPERTY_CONFIG[color].setSize;
  if (!isPropertyWildCard(card)) {
    return hasRoom(card.color) ? card.color : undefined;
  }
  return [...card.colors]
    .filter(hasRoom)
    .sort((left, right) => {
      const leftNeed = PROPERTY_CONFIG[left].setSize - player.sets[left].properties.length;
      const rightNeed = PROPERTY_CONFIG[right].setSize - player.sets[right].properties.length;
      if (leftNeed !== rightNeed) {
        return leftNeed - rightNeed;
      }
      return rentFor(player, right) - rentFor(player, left);
    })[0];
};

const propertyChoice = (state: GameState, playerId: PlayerId) => {
  const player = state.players[playerId];
  return player.hand
    .filter(isTablePropertyCard)
    .map((card) => {
      const color = choosePropertyColor(state, playerId, card.id);
      const progress = color ? player.sets[color].properties.length / PROPERTY_CONFIG[color].setSize : 0;
      return { card, color, score: progress * 100 + card.value };
    })
    .filter(
      (choice): choice is { card: TablePropertyCard; color: PropertyColor; score: number } =>
        Boolean(choice.color)
    )
    .sort((left, right) => right.score - left.score)[0];
};

const findBuildableImprovement = (state: GameState, playerId: PlayerId) => {
  const player = state.players[playerId];
  const card = player.hand.find(isImprovementAction);
  if (!card) {
    return null;
  }

  const color = PROPERTY_COLORS.find((candidate) => {
    const stack = player.sets[candidate];
    if (!isCompleteSet(stack, candidate)) {
      return false;
    }
    if (card.action === "house") {
      return !stack.improvements.some((improvement) => improvement.action === "house");
    }
    return (
      stack.improvements.some((improvement) => improvement.action === "house") &&
      !stack.improvements.some((improvement) => improvement.action === "hotel")
    );
  });

  return color ? { cardId: card.id, color } : null;
};

const findStealableIncompleteProperty = (
  state: GameState,
  targetPlayerId: PlayerId
) => {
  const target = state.players[targetPlayerId];
  for (const color of PROPERTY_COLORS) {
    if (!isCompleteSet(target.sets[color], color) && target.sets[color].properties.length > 0) {
      return target.sets[color].properties[0];
    }
  }
  return null;
};

const findForcedDealPair = (
  state: GameState,
  playerId: PlayerId,
  targetPlayerId: PlayerId
) => {
  const player = state.players[playerId];
  const targetProperty = findStealableIncompleteProperty(state, targetPlayerId);
  if (!targetProperty) {
    return null;
  }

  const ownProperty = PROPERTY_COLORS.filter((color) => !isCompleteSet(player.sets[color], color))
    .flatMap((color) => player.sets[color].properties)
    .sort(cardValueAsc)[0];

  return ownProperty ? { ownProperty, targetProperty } : null;
};

const discardChoice = (state: GameState, playerId: PlayerId): string[] => {
  const overLimit = state.players[playerId].hand.length - HAND_LIMIT;
  if (overLimit <= 0) {
    return [];
  }
  return [...state.players[playerId].hand].sort(cardValueAsc).slice(0, overLimit).map((card) => card.id);
};

const bankableChoice = (state: GameState, playerId: PlayerId): Card | undefined => {
  const hand = state.players[playerId].hand;
  return hand
    .filter((card) => isBankableCard(card) && !(isActionCard(card) && card.action === "justSayNo"))
    .sort(cardValueDesc)[0];
};

const finishTurnChoice = (state: GameState, playerId: PlayerId): DomainEvent[] | null => {
  const discards = discardChoice(state, playerId);
  return discards.length > 0
    ? attempt(() => discardCards(state, playerId, discards))
    : attempt(() => endTurn(state, playerId));
};

const findRentPlay = (
  state: GameState,
  playerId: PlayerId,
  useDoubleRent: boolean
) => {
  const player = state.players[playerId];
  const doubleRent = player.hand.find(
    (card) => isActionCard(card) && card.action === "doubleRent"
  );
  const targetPlayerId = firstOpponentId(state, playerId);

  return player.hand
    .filter(isRentCard)
    .flatMap((card) =>
      card.colors
        .filter((candidate) => rentFor(player, candidate) > 0)
        .map((color) => ({
          cardId: card.id,
          color,
          amount: rentFor(player, color),
          targetPlayerId: card.scope === "one" ? targetPlayerId : null,
          doubleRentCardId:
            useDoubleRent && doubleRent && state.playsRemaining >= 2
              ? doubleRent.id
              : undefined
        }))
    )
    .sort((left, right) => right.amount - left.amount)[0] ?? null;
};

const playDealBreakerTactic: BotTactic = ({ state, playerId }) => {
  const targetPlayerId = firstOpponentId(state, playerId);
  if (!targetPlayerId) {
    return null;
  }
  const hand = state.players[playerId].hand;
  const dealBreaker = hand.find((card) => isActionCard(card) && card.action === "dealBreaker");
  const targetCompleteSet = completedSetColors(state.players[targetPlayerId])[0];
  if (!dealBreaker || !targetCompleteSet) {
    return null;
  }
  return attempt(() => playDealBreaker(state, playerId, dealBreaker.id, targetPlayerId, targetCompleteSet));
};

const playPropertyTactic: BotTactic = ({ state, playerId }) => {
  const property = propertyChoice(state, playerId);
  return property
    ? attempt(() => playProperty(state, playerId, property.card.id, property.color))
    : null;
};

const buildImprovementTactic: BotTactic = ({ state, playerId }) => {
  const improvement = findBuildableImprovement(state, playerId);
  return improvement
    ? attempt(() => buildImprovement(state, playerId, improvement.cardId, improvement.color))
    : null;
};

const playRentTactic = (useDoubleRent: boolean): BotTactic => ({ state, playerId }) => {
  const rentPlay = findRentPlay(state, playerId, useDoubleRent);
  if (!rentPlay) {
    return null;
  }
  return attempt(() =>
    playRent(
      state,
      playerId,
      rentPlay.cardId,
      rentPlay.targetPlayerId,
      rentPlay.color,
      rentPlay.doubleRentCardId
    )
  );
};

const playPassGoTactic: BotTactic = ({ state, playerId }) => {
  const passGo = state.players[playerId].hand.find(
    (card) => isActionCard(card) && card.action === "passGo"
  );
  return passGo ? attempt(() => playPassGo(state, playerId, passGo.id)) : null;
};

const playDebtCollectorTactic: BotTactic = ({ state, playerId }) => {
  const targetPlayerId = firstOpponentId(state, playerId);
  const debtCollector = state.players[playerId].hand.find(
    (card) => isActionCard(card) && card.action === "debtCollector"
  );
  if (!targetPlayerId || !debtCollector) {
    return null;
  }
  return attempt(() => playDebtCollector(state, playerId, debtCollector.id, targetPlayerId));
};

const playBirthdayTactic: BotTactic = ({ state, playerId }) => {
  const birthday = state.players[playerId].hand.find(
    (card) => isActionCard(card) && card.action === "birthday"
  );
  return birthday ? attempt(() => playBirthday(state, playerId, birthday.id)) : null;
};

const playSlyDealTactic: BotTactic = ({ state, playerId }) => {
  const targetPlayerId = firstOpponentId(state, playerId);
  const slyDeal = state.players[playerId].hand.find(
    (card) => isActionCard(card) && card.action === "slyDeal"
  );
  const targetProperty = targetPlayerId
    ? findStealableIncompleteProperty(state, targetPlayerId)
    : null;
  if (!targetPlayerId || !slyDeal || !targetProperty) {
    return null;
  }
  return attempt(() => playSlyDeal(state, playerId, slyDeal.id, targetPlayerId, targetProperty.id));
};

const playForcedDealTactic: BotTactic = ({ state, playerId }) => {
  const targetPlayerId = firstOpponentId(state, playerId);
  const forcedDeal = state.players[playerId].hand.find(
    (card) => isActionCard(card) && card.action === "forcedDeal"
  );
  const forcedDealPair = targetPlayerId
    ? findForcedDealPair(state, playerId, targetPlayerId)
    : null;
  if (!targetPlayerId || !forcedDeal || !forcedDealPair) {
    return null;
  }
  return attempt(() =>
    playForcedDeal(
      state,
      playerId,
      forcedDeal.id,
      targetPlayerId,
      forcedDealPair.ownProperty.id,
      forcedDealPair.targetProperty.id
    )
  );
};

const bankHighestValueTactic: BotTactic = ({ state, playerId }) => {
  const bankable = bankableChoice(state, playerId);
  return bankable ? attempt(() => playCardToBank(state, playerId, bankable.id)) : null;
};

export const BOT_TACTICS = {
  dealBreaker: playDealBreakerTactic,
  property: playPropertyTactic,
  improvement: buildImprovementTactic,
  rent: playRentTactic(false),
  doubleRent: playRentTactic(true),
  passGo: playPassGoTactic,
  debtCollector: playDebtCollectorTactic,
  birthday: playBirthdayTactic,
  slyDeal: playSlyDealTactic,
  forcedDeal: playForcedDealTactic,
  bankHighestValue: bankHighestValueTactic
} as const satisfies Record<string, BotTactic>;

[
  createOrderedBotStrategy({
    id: "easy",
    name: "Easy",
    description: "Builds obvious property sets, then banks value when it runs out of table plays.",
    tactics: [
      BOT_TACTICS.property,
      BOT_TACTICS.rent,
      BOT_TACTICS.bankHighestValue
    ]
  }),
  createOrderedBotStrategy({
    id: "medium",
    name: "Balanced",
    description: "Builds property, collects rent, plays draw cards, and uses basic theft actions.",
    tactics: [
      BOT_TACTICS.property,
      BOT_TACTICS.improvement,
      BOT_TACTICS.rent,
      BOT_TACTICS.passGo,
      BOT_TACTICS.debtCollector,
      BOT_TACTICS.birthday,
      BOT_TACTICS.slyDeal,
      BOT_TACTICS.forcedDeal,
      BOT_TACTICS.bankHighestValue
    ]
  }),
  createOrderedBotStrategy({
    id: "hard",
    name: "Ruthless",
    description: "Prioritizes Deal Breaker and doubled rent before building its own board.",
    tactics: [
      BOT_TACTICS.dealBreaker,
      BOT_TACTICS.doubleRent,
      BOT_TACTICS.property,
      BOT_TACTICS.improvement,
      BOT_TACTICS.passGo,
      BOT_TACTICS.debtCollector,
      BOT_TACTICS.birthday,
      BOT_TACTICS.slyDeal,
      BOT_TACTICS.forcedDeal,
      BOT_TACTICS.bankHighestValue
    ]
  }),
  createOrderedBotStrategy({
    id: "builder",
    name: "Builder",
    description: "Chases complete sets and improvements before most action cards.",
    tactics: [
      BOT_TACTICS.property,
      BOT_TACTICS.improvement,
      BOT_TACTICS.passGo,
      BOT_TACTICS.rent,
      BOT_TACTICS.bankHighestValue
    ]
  }),
  createOrderedBotStrategy({
    id: "rent-shark",
    name: "Rent Shark",
    description: "Turns every rent card into pressure and doubles rent whenever possible.",
    tactics: [
      BOT_TACTICS.doubleRent,
      BOT_TACTICS.property,
      BOT_TACTICS.improvement,
      BOT_TACTICS.passGo,
      BOT_TACTICS.debtCollector,
      BOT_TACTICS.birthday,
      BOT_TACTICS.bankHighestValue
    ]
  }),
  createOrderedBotStrategy({
    id: "deal-thief",
    name: "Deal Thief",
    description: "Looks for Deal Breaker, Sly Deal, and Forced Deal before normal growth.",
    tactics: [
      BOT_TACTICS.dealBreaker,
      BOT_TACTICS.slyDeal,
      BOT_TACTICS.forcedDeal,
      BOT_TACTICS.property,
      BOT_TACTICS.rent,
      BOT_TACTICS.passGo,
      BOT_TACTICS.bankHighestValue
    ]
  }),
  createOrderedBotStrategy({
    id: "banker",
    name: "Banker",
    description: "Builds enough board presence, then preserves payment power in the bank.",
    tactics: [
      BOT_TACTICS.property,
      BOT_TACTICS.passGo,
      BOT_TACTICS.bankHighestValue,
      BOT_TACTICS.improvement,
      BOT_TACTICS.rent
    ]
  })
].forEach(registerBotStrategy);

const strategyIdForPlayer = (
  state: GameState,
  playerId: PlayerId,
  fallbackStrategyId: BotStrategyId = DEFAULT_BOT_STRATEGY_ID
): BotStrategyId =>
  state.players[playerId]?.botStrategyId ?? fallbackStrategyId;

export const chooseBotEvents = (
  state: GameState,
  playerId: PlayerId,
  fallbackStrategyId: BotStrategyId = DEFAULT_BOT_STRATEGY_ID
): DomainEvent[] | null => {
  if (state.status !== "active" || state.currentTurn !== playerId) {
    return null;
  }

  if (state.mustDraw) {
    return attempt(() => drawAtTurnStart(state, playerId));
  }

  if (state.playsRemaining <= 0) {
    return finishTurnChoice(state, playerId);
  }

  const strategy = getBotStrategy(strategyIdForPlayer(state, playerId, fallbackStrategyId));
  const strategyEvents = strategy.chooseEvents({ state, playerId });
  if (strategyEvents && strategyEvents.length > 0) {
    return strategyEvents;
  }

  return finishTurnChoice(state, playerId);
};

export const playableRentColors = (
  state: GameState,
  playerId: PlayerId,
  rentCardId: string
): PropertyColor[] => {
  const card = state.players[playerId].hand.find((candidate) => candidate.id === rentCardId);
  if (!card || !isRentCard(card)) {
    return [];
  }
  return card.colors.filter((color) => rentFor(state.players[playerId], color) > 0);
};
