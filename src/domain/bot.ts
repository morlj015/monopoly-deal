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

const findRentPlay = (
  state: GameState,
  playerId: PlayerId,
  difficulty: BotDifficulty
) => {
  const player = state.players[playerId];
  const rentCards = player.hand.filter(isRentCard);
  const doubleRent = player.hand.find(
    (card) => isActionCard(card) && card.action === "doubleRent"
  );

  for (const card of rentCards) {
    const color = card.colors
      .filter((candidate) => rentFor(player, candidate) > 0)
      .sort((left, right) => rentFor(player, right) - rentFor(player, left))[0];

    if (color) {
      return {
        cardId: card.id,
        color,
        targetPlayerId: card.scope === "one" ? firstOpponentId(state, playerId) : null,
        doubleRentCardId:
          difficulty === "hard" && doubleRent && state.playsRemaining >= 2
            ? doubleRent.id
            : undefined
      };
    }
  }

  return null;
};

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
  if (!isPropertyWildCard(card)) {
    return card.color;
  }
  return [...card.colors].sort((left, right) => {
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

  const ownProperty = PROPERTY_COLORS.flatMap((color) => player.sets[color].properties)
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

export const chooseBotEvents = (
  state: GameState,
  playerId: PlayerId,
  difficulty: BotDifficulty
): DomainEvent[] | null => {
  if (state.status !== "active" || state.currentTurn !== playerId) {
    return null;
  }

  if (state.mustDraw) {
    return attempt(() => drawAtTurnStart(state, playerId));
  }

  const targetPlayerId = firstOpponentId(state, playerId);
  if (!targetPlayerId) {
    return null;
  }

  if (state.playsRemaining <= 0) {
    const discards = discardChoice(state, playerId);
    return discards.length > 0
      ? attempt(() => discardCards(state, playerId, discards))
      : attempt(() => endTurn(state, playerId));
  }

  const hand = state.players[playerId].hand;

  if (difficulty === "hard") {
    const dealBreaker = hand.find((card) => isActionCard(card) && card.action === "dealBreaker");
    const targetCompleteSet = completedSetColors(state.players[targetPlayerId])[0];
    if (dealBreaker && targetCompleteSet) {
      const events = attempt(() =>
        playDealBreaker(state, playerId, dealBreaker.id, targetPlayerId, targetCompleteSet)
      );
      if (events) {
        return events;
      }
    }

    const rentPlay = findRentPlay(state, playerId, difficulty);
    if (rentPlay) {
      const events = attempt(() =>
        playRent(
          state,
          playerId,
          rentPlay.cardId,
          rentPlay.targetPlayerId,
          rentPlay.color,
          rentPlay.doubleRentCardId
        )
      );
      if (events) {
        return events;
      }
    }
  }

  const property = propertyChoice(state, playerId);
  if (property) {
    const events = attempt(() => playProperty(state, playerId, property.card.id, property.color));
    if (events) {
      return events;
    }
  }

  const improvement = findBuildableImprovement(state, playerId);
  if (improvement) {
    const events = attempt(() =>
      buildImprovement(state, playerId, improvement.cardId, improvement.color)
    );
    if (events) {
      return events;
    }
  }

  if (difficulty !== "easy") {
    const rentPlay = findRentPlay(state, playerId, difficulty);
    if (rentPlay) {
      const events = attempt(() =>
        playRent(
          state,
          playerId,
          rentPlay.cardId,
          rentPlay.targetPlayerId,
          rentPlay.color,
          rentPlay.doubleRentCardId
        )
      );
      if (events) {
        return events;
      }
    }

    const passGo = hand.find((card) => isActionCard(card) && card.action === "passGo");
    if (passGo) {
      const events = attempt(() => playPassGo(state, playerId, passGo.id));
      if (events) {
        return events;
      }
    }

    const debtCollector = hand.find(
      (card) => isActionCard(card) && card.action === "debtCollector"
    );
    if (debtCollector) {
      const events = attempt(() =>
        playDebtCollector(state, playerId, debtCollector.id, targetPlayerId)
      );
      if (events) {
        return events;
      }
    }

    const birthday = hand.find((card) => isActionCard(card) && card.action === "birthday");
    if (birthday) {
      const events = attempt(() => playBirthday(state, playerId, birthday.id));
      if (events) {
        return events;
      }
    }

    const slyDeal = hand.find((card) => isActionCard(card) && card.action === "slyDeal");
    const targetProperty = findStealableIncompleteProperty(state, targetPlayerId);
    if (slyDeal && targetProperty) {
      const events = attempt(() =>
        playSlyDeal(state, playerId, slyDeal.id, targetPlayerId, targetProperty.id)
      );
      if (events) {
        return events;
      }
    }

    const forcedDeal = hand.find((card) => isActionCard(card) && card.action === "forcedDeal");
    const forcedDealPair = findForcedDealPair(state, playerId, targetPlayerId);
    if (forcedDeal && forcedDealPair) {
      const events = attempt(() =>
        playForcedDeal(
          state,
          playerId,
          forcedDeal.id,
          targetPlayerId,
          forcedDealPair.ownProperty.id,
          forcedDealPair.targetProperty.id
        )
      );
      if (events) {
        return events;
      }
    }
  }

  const rentPlay = findRentPlay(state, playerId, difficulty);
  if (rentPlay) {
    const events = attempt(() =>
      playRent(state, playerId, rentPlay.cardId, rentPlay.targetPlayerId, rentPlay.color)
    );
    if (events) {
      return events;
    }
  }

  const bankable = bankableChoice(state, playerId);
  if (bankable) {
    const events = attempt(() => playCardToBank(state, playerId, bankable.id));
    if (events) {
      return events;
    }
  }

  const discards = discardChoice(state, playerId);
  return discards.length > 0
    ? attempt(() => discardCards(state, playerId, discards))
    : attempt(() => endTurn(state, playerId));
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
