import {
  buildDeck,
  isActionCard,
  isBankableCard,
  isImprovementAction,
  isPropertyCard,
  isPropertyWildCard,
  isRentCard,
  isTablePropertyCard,
  PROPERTY_CONFIG,
  type ActionCard,
  type ActionType,
  type Card,
  type PropertyColor,
  type RentCard,
  type TablePropertyCard
} from "./cards";
import { DomainRuleViolation } from "./errors";
import type {
  DomainEvent,
  GameStartedEvent,
  LocatedProperty,
  PaymentAsset,
  PlayerConfig,
  PlayerId
} from "./events";
import { shuffledDeck } from "./random";
import {
  applyEvents,
  COMPLETE_SETS_TO_WIN,
  completedSetCount,
  findCardInHand,
  findPropertyInSets,
  GameState,
  HAND_LIMIT,
  isCompleteSet,
  OPENING_HAND_SIZE,
  opponentsOf,
  rentFor,
  selectablePaymentAssets
} from "./state";

export interface StartGameCommand {
  gameId: string;
  seed: string;
  players: PlayerConfig[];
}

const fail = (message: string): never => {
  throw new DomainRuleViolation(message);
};

const assertActiveTurn = (state: GameState, playerId: PlayerId): void => {
  if (state.status !== "active") {
    fail("The game is not active.");
  }
  if (state.currentTurn !== playerId) {
    fail("It is not this player's turn.");
  }
};

const assertCanPlay = (state: GameState, playerId: PlayerId, plays = 1): void => {
  assertActiveTurn(state, playerId);
  if (state.mustDraw) {
    fail("The player must draw before playing cards.");
  }
  if (state.playsRemaining < plays) {
    fail("The player does not have enough plays left.");
  }
};

const handCard = (state: GameState, playerId: PlayerId, cardId: string): Card => {
  const card = findCardInHand(state, playerId, cardId);
  if (!card) {
    fail("Card is not in the player's hand.");
  }
  return card as Card;
};

const actionCard = (
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  action: ActionType
): ActionCard => {
  const card = handCard(state, playerId, cardId);
  if (!isActionCard(card) || card.action !== action) {
    fail(`Card is not ${action}.`);
  }
  return card as ActionCard;
};

const rentCard = (state: GameState, playerId: PlayerId, cardId: string): RentCard => {
  const card = handCard(state, playerId, cardId);
  if (!isRentCard(card)) {
    fail("Card is not a rent card.");
  }
  return card as RentCard;
};

const justSayNoCard = (
  state: GameState,
  playerId: PlayerId,
  excludeCardIds: string[] = []
): ActionCard | undefined =>
  state.players[playerId]?.hand.find(
    (card): card is ActionCard =>
      isActionCard(card) && card.action === "justSayNo" && !excludeCardIds.includes(card.id)
  );

const nextPlayerId = (state: GameState, playerId: PlayerId): PlayerId => {
  const index = state.playerOrder.indexOf(playerId);
  if (index === -1) {
    fail("Player is not seated at this game.");
  }
  return state.playerOrder[(index + 1) % state.playerOrder.length];
};

const choosePayment = (playerAssets: PaymentAsset[], amount: number): PaymentAsset[] => {
  const assets: PaymentAsset[] = [];
  let paid = 0;
  for (const asset of playerAssets) {
    if (paid >= amount) {
      break;
    }
    assets.push(asset);
    paid += asset.card.value;
  }
  return assets;
};

const paymentEvent = (
  state: GameState,
  fromPlayerId: PlayerId,
  toPlayerId: PlayerId,
  amount: number
): DomainEvent => {
  const assets = choosePayment(selectablePaymentAssets(state.players[fromPlayerId]), amount);
  const paidAmount = assets.reduce((total, asset) => total + asset.card.value, 0);
  return {
    type: "PaymentCollected",
    fromPlayerId,
    toPlayerId,
    requestedAmount: amount,
    paidAmount,
    assets
  };
};

const drawCardsEvents = (
  state: GameState,
  playerId: PlayerId,
  count: number,
  salt: string
): DomainEvent[] => {
  const events: DomainEvent[] = [];
  let drawDeck = state.deck;

  if (drawDeck.length < count && state.discard.length > 0) {
    const recycled = shuffledDeck(
      state.discard,
      `${state.seed ?? state.gameId ?? "game"}:${state.version}:${salt}`
    );
    events.push({ type: "DiscardPileRecycled", cards: recycled });
    drawDeck = [...drawDeck, ...recycled];
  }

  events.push({ type: "CardsDrawn", playerId, cards: drawDeck.slice(0, count) });
  return events;
};

const justSayNoResponse = (
  state: GameState,
  againstPlayerId: PlayerId,
  targetPlayerId: PlayerId,
  againstCard: ActionCard | RentCard,
  excludeAgainstCardIds: string[] = []
): { events: DomainEvent[]; cancelled: boolean } => {
  const target = state.players[targetPlayerId];
  if (!target || target.role !== "bot") {
    return { events: [], cancelled: false };
  }

  const defenderCard = justSayNoCard(state, targetPlayerId);
  if (!defenderCard) {
    return { events: [], cancelled: false };
  }

  const events: DomainEvent[] = [
    {
      type: "JustSayNoPlayed",
      playerId: targetPlayerId,
      againstPlayerId,
      card: defenderCard,
      againstCard
    }
  ];

  const actor = state.players[againstPlayerId];
  const counterCard =
    actor?.role === "bot"
      ? justSayNoCard(state, againstPlayerId, [againstCard.id, ...excludeAgainstCardIds])
      : undefined;

  if (counterCard) {
    events.push({
      type: "JustSayNoPlayed",
      playerId: againstPlayerId,
      againstPlayerId: targetPlayerId,
      card: counterCard,
      againstCard: defenderCard
    });
    return { events, cancelled: false };
  }

  return { events, cancelled: true };
};

const appendWinIfNeeded = (
  state: GameState,
  events: DomainEvent[],
  playerId: PlayerId
): DomainEvent[] => {
  const nextState = applyEvents(state, events);
  if (
    nextState.status === "active" &&
    completedSetCount(nextState.players[playerId]) >= COMPLETE_SETS_TO_WIN
  ) {
    return [
      ...events,
      {
        type: "GameWon",
        playerId,
        completedSets: completedSetCount(nextState.players[playerId])
      }
    ];
  }
  return events;
};

export const startGame = (command: StartGameCommand): DomainEvent[] => {
  if (command.players.length < 2) {
    fail("A deal needs at least two players.");
  }
  if (command.players.length > 5) {
    fail("Monopoly Deal supports up to five players with one deck.");
  }
  if (new Set(command.players.map((player) => player.id)).size !== command.players.length) {
    fail("Player ids must be unique.");
  }

  const deck = shuffledDeck(buildDeck(), command.seed);
  const hands: Record<PlayerId, Card[]> = {};
  let cursor = 0;

  for (const player of command.players) {
    hands[player.id] = deck.slice(cursor, cursor + OPENING_HAND_SIZE);
    cursor += OPENING_HAND_SIZE;
  }

  const event: GameStartedEvent = {
    type: "GameStarted",
    gameId: command.gameId,
    seed: command.seed,
    players: command.players,
    startingPlayerId: command.players[0].id,
    hands,
    deck: deck.slice(cursor)
  };

  return [event];
};

export const drawAtTurnStart = (state: GameState, playerId: PlayerId): DomainEvent[] => {
  assertActiveTurn(state, playerId);
  if (!state.mustDraw) {
    fail("This player has already drawn for the turn.");
  }
  return drawCardsEvents(state, playerId, 2, `${playerId}:turn-draw`);
};

export const playCardToBank = (
  state: GameState,
  playerId: PlayerId,
  cardId: string
): DomainEvent[] => {
  assertCanPlay(state, playerId);
  const card = handCard(state, playerId, cardId);
  if (!isBankableCard(card)) {
    fail("Property cards cannot be banked.");
  }
  return [{ type: "CardBanked", playerId, card }];
};

export const playProperty = (
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  chosenColor?: PropertyColor
): DomainEvent[] => {
  assertCanPlay(state, playerId);
  const card = handCard(state, playerId, cardId);
  if (!isTablePropertyCard(card)) {
    fail("Card is not a property.");
  }
  const propertyCard = card as TablePropertyCard;
  const color = isPropertyCard(propertyCard) ? propertyCard.color : chosenColor;
  if (!color) {
    fail("Wild property cards need a color.");
  }
  const targetColor = color as PropertyColor;
  if (isPropertyWildCard(propertyCard) && !propertyCard.colors.includes(targetColor)) {
    fail("This wild property cannot be played to that color.");
  }
  if (state.players[playerId].sets[targetColor].properties.length >= PROPERTY_CONFIG[targetColor].setSize) {
    fail("This property set is already complete.");
  }
  return appendWinIfNeeded(
    state,
    [{ type: "PropertyPlayed", playerId, card: propertyCard, color: targetColor }],
    playerId
  );
};

export const buildImprovement = (
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  color: PropertyColor
): DomainEvent[] => {
  assertCanPlay(state, playerId);
  const card = handCard(state, playerId, cardId);
  if (!isImprovementAction(card)) {
    fail("Only House and Hotel cards can be built as improvements.");
  }
  const improvementCard = card as ActionCard;

  const stack = state.players[playerId].sets[color];
  const config = PROPERTY_CONFIG[color];
  if (!config.canImprove) {
    fail("This property set cannot be improved.");
  }
  if (!isCompleteSet(stack, color)) {
    fail("Improvements require a complete set.");
  }
  if (
    improvementCard.action === "house" &&
    stack.improvements.some((improvement) => improvement.action === "house")
  ) {
    fail("This set already has a house.");
  }
  if (improvementCard.action === "hotel") {
    if (!stack.improvements.some((improvement) => improvement.action === "house")) {
      fail("A hotel requires a house first.");
    }
    if (stack.improvements.some((improvement) => improvement.action === "hotel")) {
      fail("This set already has a hotel.");
    }
  }

  return [{ type: "ImprovementBuilt", playerId, card: improvementCard, color }];
};

export const playPassGo = (
  state: GameState,
  playerId: PlayerId,
  cardId: string
): DomainEvent[] => {
  assertCanPlay(state, playerId);
  const card = actionCard(state, playerId, cardId, "passGo");
  if (state.deck.length === 0 && state.discard.length === 0) {
    fail("No cards are available to draw.");
  }
  return [
    { type: "ActionResolved", playerId, card, action: "passGo" },
    ...drawCardsEvents(state, playerId, 2, `${playerId}:pass-go:${cardId}`)
  ];
};

export const playDebtCollector = (
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  targetPlayerId: PlayerId
): DomainEvent[] => {
  assertCanPlay(state, playerId);
  const card = actionCard(state, playerId, cardId, "debtCollector");
  if (!state.players[targetPlayerId] || targetPlayerId === playerId) {
    fail("Debt Collector needs an opposing player.");
  }
  const defense = justSayNoResponse(state, playerId, targetPlayerId, card);
  if (defense.cancelled) {
    return [{ type: "ActionResolved", playerId, card, action: "debtCollector" }, ...defense.events];
  }
  const events: DomainEvent[] = [
    { type: "ActionResolved", playerId, card, action: "debtCollector" },
    ...defense.events,
    paymentEvent(state, targetPlayerId, playerId, 5)
  ];
  return appendWinIfNeeded(state, events, playerId);
};

export const playBirthday = (
  state: GameState,
  playerId: PlayerId,
  cardId: string
): DomainEvent[] => {
  assertCanPlay(state, playerId);
  const card = actionCard(state, playerId, cardId, "birthday");
  const events: DomainEvent[] = [{ type: "ActionResolved", playerId, card, action: "birthday" }];
  for (const opponent of opponentsOf(state, playerId)) {
    const defense = justSayNoResponse(state, playerId, opponent.id, card);
    events.push(...defense.events);
    if (!defense.cancelled) {
      events.push(paymentEvent(state, opponent.id, playerId, 2));
    }
  }
  return appendWinIfNeeded(state, events, playerId);
};

export const playRent = (
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  targetPlayerId: PlayerId | null,
  color: PropertyColor,
  doubleRentCardId?: string
): DomainEvent[] => {
  assertCanPlay(state, playerId, doubleRentCardId ? 2 : 1);
  const card = rentCard(state, playerId, cardId);
  if (targetPlayerId && (!state.players[targetPlayerId] || targetPlayerId === playerId)) {
    fail("Rent needs an opposing player.");
  }
  if (card.scope === "one" && !targetPlayerId) {
    fail("Wild rent needs a target player.");
  }
  if (card.scope === "all" && targetPlayerId) {
    fail("Standard rent charges every opponent.");
  }
  if (!card.colors.includes(color)) {
    fail("This rent card cannot charge that color.");
  }

  const doubleRentCard = doubleRentCardId
    ? actionCard(state, playerId, doubleRentCardId, "doubleRent")
    : undefined;
  const amount = rentFor(state.players[playerId], color, Boolean(doubleRentCard));
  if (amount <= 0) {
    fail("The player has no rent to charge for that color.");
  }
  const targetPlayerIds =
    card.scope === "all"
      ? opponentsOf(state, playerId).map((opponent) => opponent.id)
      : [targetPlayerId as PlayerId];
  const defenseEvents: DomainEvent[] = [];
  const payingTargetIds: PlayerId[] = [];
  for (const target of targetPlayerIds) {
    const defense = justSayNoResponse(
      state,
      playerId,
      target,
      card,
      doubleRentCard ? [doubleRentCard.id] : []
    );
    defenseEvents.push(...defense.events);
    if (!defense.cancelled) {
      payingTargetIds.push(target);
    }
  }

  const events: DomainEvent[] = [
    {
      type: "RentCharged",
      playerId,
      targetPlayerIds: payingTargetIds,
      card,
      color,
      amount,
      doubled: Boolean(doubleRentCard),
      doubleRentCard
    },
    ...defenseEvents,
    ...payingTargetIds.map((target) => paymentEvent(state, target, playerId, amount))
  ];
  return appendWinIfNeeded(state, events, playerId);
};

export const playSlyDeal = (
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  targetPlayerId: PlayerId,
  targetPropertyId: string
): DomainEvent[] => {
  assertCanPlay(state, playerId);
  const card = actionCard(state, playerId, cardId, "slyDeal");
  const target = state.players[targetPlayerId];
  if (!target || targetPlayerId === playerId) {
    fail("Sly Deal needs an opposing player.");
  }
  const property = findPropertyInSets(target, targetPropertyId);
  if (!property) {
    fail("Target property is not on the table.");
  }
  const locatedProperty = property as LocatedProperty;
  if (isCompleteSet(target.sets[locatedProperty.color], locatedProperty.color)) {
    fail("Sly Deal cannot steal from a complete set.");
  }
  const defense = justSayNoResponse(state, playerId, targetPlayerId, card);
  if (defense.cancelled) {
    return [{ type: "ActionResolved", playerId, card, action: "slyDeal" }, ...defense.events];
  }

  const events: DomainEvent[] = [
    { type: "ActionResolved", playerId, card, action: "slyDeal" },
    ...defense.events,
    {
      type: "PropertyStolen",
      fromPlayerId: targetPlayerId,
      toPlayerId: playerId,
      property: locatedProperty,
      reason: "slyDeal"
    }
  ];
  return appendWinIfNeeded(state, events, playerId);
};

export const playDealBreaker = (
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  targetPlayerId: PlayerId,
  color: PropertyColor
): DomainEvent[] => {
  assertCanPlay(state, playerId);
  const card = actionCard(state, playerId, cardId, "dealBreaker");
  const target = state.players[targetPlayerId];
  if (!target || targetPlayerId === playerId) {
    fail("Deal Breaker needs an opposing player.");
  }
  const stack = target.sets[color];
  if (!isCompleteSet(stack, color)) {
    fail("Deal Breaker can only steal a complete set.");
  }
  if (state.players[playerId].sets[color].properties.length > 0) {
    fail("Deal Breaker cannot merge into an occupied color set.");
  }
  const defense = justSayNoResponse(state, playerId, targetPlayerId, card);
  if (defense.cancelled) {
    return [{ type: "ActionResolved", playerId, card, action: "dealBreaker" }, ...defense.events];
  }

  const events: DomainEvent[] = [
    { type: "ActionResolved", playerId, card, action: "dealBreaker" },
    ...defense.events,
    {
      type: "CompleteSetStolen",
      fromPlayerId: targetPlayerId,
      toPlayerId: playerId,
      color,
      properties: [...stack.properties],
      improvements: [...stack.improvements]
    }
  ];
  return appendWinIfNeeded(state, events, playerId);
};

export const playForcedDeal = (
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  targetPlayerId: PlayerId,
  offeredPropertyId: string,
  requestedPropertyId: string
): DomainEvent[] => {
  assertCanPlay(state, playerId);
  const card = actionCard(state, playerId, cardId, "forcedDeal");
  const player = state.players[playerId];
  const target = state.players[targetPlayerId];
  if (!target || targetPlayerId === playerId) {
    fail("Forced Deal needs an opposing player.");
  }

  const offered = findPropertyInSets(player, offeredPropertyId);
  const received = findPropertyInSets(target, requestedPropertyId);
  if (!offered || !received) {
    fail("Both players must offer a property.");
  }
  const locatedOffered = offered as LocatedProperty;
  const locatedReceived = received as LocatedProperty;
  if (isCompleteSet(target.sets[locatedReceived.color], locatedReceived.color)) {
    fail("Forced Deal cannot take from a complete set.");
  }
  if (isCompleteSet(player.sets[locatedOffered.color], locatedOffered.color)) {
    fail("Forced Deal cannot offer from a complete set.");
  }
  const defense = justSayNoResponse(state, playerId, targetPlayerId, card);
  if (defense.cancelled) {
    return [{ type: "ActionResolved", playerId, card, action: "forcedDeal" }, ...defense.events];
  }

  const events: DomainEvent[] = [
    { type: "ActionResolved", playerId, card, action: "forcedDeal" },
    ...defense.events,
    {
      type: "PropertiesSwapped",
      playerId,
      targetPlayerId,
      offered: locatedOffered,
      received: locatedReceived
    }
  ];
  return appendWinIfNeeded(state, events, playerId);
};

export const discardCards = (
  state: GameState,
  playerId: PlayerId,
  cardIds: string[]
): DomainEvent[] => {
  assertActiveTurn(state, playerId);
  const uniqueIds = [...new Set(cardIds)];
  const player = state.players[playerId];
  if (player.hand.length - uniqueIds.length > HAND_LIMIT) {
    fail("The player must discard down to seven cards.");
  }
  const cards = uniqueIds.map((cardId) => handCard(state, playerId, cardId));
  return [{ type: "CardsDiscarded", playerId, cards }];
};

export const endTurn = (state: GameState, playerId: PlayerId): DomainEvent[] => {
  assertActiveTurn(state, playerId);
  if (state.mustDraw) {
    fail("The player must draw before ending the turn.");
  }
  if (state.players[playerId].hand.length > HAND_LIMIT) {
    fail("The player must discard down to seven cards before ending the turn.");
  }
  const events: DomainEvent[] = [
    { type: "TurnEnded", playerId },
    { type: "TurnStarted", playerId: nextPlayerId(state, playerId) }
  ];
  const activeCardsRemaining =
    state.deck.length +
    state.discard.length +
    state.playerOrder.reduce((total, id) => total + state.players[id].hand.length, 0);
  if (activeCardsRemaining === 0) {
    const winner = [...state.playerOrder].sort((left, right) => {
      const leftPlayer = state.players[left];
      const rightPlayer = state.players[right];
      const completeDelta = completedSetCount(rightPlayer) - completedSetCount(leftPlayer);
      if (completeDelta !== 0) {
        return completeDelta;
      }
      const exposed = (playerIdForValue: PlayerId) => {
        const player = state.players[playerIdForValue];
        return (
          player.bank.reduce((sum, card) => sum + card.value, 0) +
          Object.values(player.sets).reduce(
            (sum, stack) =>
              sum +
              stack.properties.reduce((cardSum, card) => cardSum + card.value, 0) +
              stack.improvements.reduce((cardSum, card) => cardSum + card.value, 0),
            0
          )
        );
      };
      return exposed(right) - exposed(left);
    })[0];
    if (winner) {
      return [
        { type: "TurnEnded", playerId },
        {
          type: "GameWon",
          playerId: winner,
          completedSets: completedSetCount(state.players[winner])
        }
      ];
    }
  }
  return events;
};
