import {
  type ActionCard,
  type Card,
  PROPERTY_COLORS,
  PROPERTY_CONFIG,
  type PropertyColor,
  type TablePropertyCard
} from "./cards";
import type {
  DomainEvent,
  LocatedProperty,
  PaymentAsset,
  PlayerConfig,
  PlayerId
} from "./events";

export interface PropertyStack {
  properties: TablePropertyCard[];
  improvements: ActionCard[];
}

export type PropertyStacks = Record<PropertyColor, PropertyStack>;

export interface PlayerState extends PlayerConfig {
  hand: Card[];
  bank: Card[];
  sets: PropertyStacks;
}

export interface GameState {
  gameId: string | null;
  seed: string | null;
  status: "notStarted" | "active" | "won";
  players: Record<PlayerId, PlayerState>;
  playerOrder: PlayerId[];
  currentTurn: PlayerId | null;
  playsRemaining: number;
  mustDraw: boolean;
  deck: Card[];
  discard: Card[];
  winner: PlayerId | null;
  version: number;
  log: string[];
}

export const HAND_LIMIT = 7;
export const PLAYS_PER_TURN = 3;
export const OPENING_HAND_SIZE = 5;
export const COMPLETE_SETS_TO_WIN = 3;

export const emptyPropertyStacks = (): PropertyStacks =>
  PROPERTY_COLORS.reduce((sets, color) => {
    sets[color] = { properties: [], improvements: [] };
    return sets;
  }, {} as PropertyStacks);

export const emptyGameState = (): GameState => ({
  gameId: null,
  seed: null,
  status: "notStarted",
  players: {},
  playerOrder: [],
  currentTurn: null,
  playsRemaining: 0,
  mustDraw: false,
  deck: [],
  discard: [],
  winner: null,
  version: 0,
  log: []
});

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const removeCardById = <T extends Card>(cards: T[], cardId: string): T | undefined => {
  const index = cards.findIndex((card) => card.id === cardId);
  if (index === -1) {
    return undefined;
  }
  const [card] = cards.splice(index, 1);
  return card;
};

const removeProperty = (
  player: PlayerState,
  located: LocatedProperty
): TablePropertyCard | undefined => {
  const stack = player.sets[located.color];
  const index = stack.properties.findIndex((card) => card.id === located.card.id);
  if (index === -1) {
    return undefined;
  }
  const [card] = stack.properties.splice(index, 1);
  return card;
};

const addPropertyToOwner = (
  player: PlayerState,
  card: TablePropertyCard,
  color: PropertyColor
) => {
  player.sets[color].properties.push(card);
};

const discardInvalidImprovements = (
  player: PlayerState,
  color: PropertyColor,
  discard: Card[]
) => {
  const stack = player.sets[color];
  const config = PROPERTY_CONFIG[color];
  if (stack.improvements.length === 0) {
    return;
  }
  if (!config.canImprove || !isCompleteSet(stack, color)) {
    discard.push(...stack.improvements);
    stack.improvements = [];
    return;
  }
  const hasHouse = stack.improvements.some((card) => card.action === "house");
  if (!hasHouse) {
    const invalidHotels = stack.improvements.filter((card) => card.action === "hotel");
    if (invalidHotels.length > 0) {
      discard.push(...invalidHotels);
      stack.improvements = stack.improvements.filter((card) => card.action !== "hotel");
    }
  }
};

const applyPaymentAsset = (
  fromPlayer: PlayerState,
  toPlayer: PlayerState,
  asset: PaymentAsset,
  discard: Card[]
) => {
  if (asset.source === "bank") {
    const card = removeCardById(fromPlayer.bank, asset.card.id);
    if (card) {
      toPlayer.bank.push(card);
    }
    return;
  }

  if (!asset.color || (asset.card.kind !== "property" && asset.card.kind !== "propertyWild")) {
    return;
  }

  const paidProperty = removeProperty(fromPlayer, {
    card: asset.card,
    color: asset.color
  });
  if (paidProperty) {
    discardInvalidImprovements(fromPlayer, asset.color, discard);
    addPropertyToOwner(toPlayer, paidProperty, asset.color);
  }
};

const appendLog = (state: GameState, message: string) => {
  state.log = [message, ...state.log].slice(0, 40);
};

export const applyEvent = (state: GameState, event: DomainEvent): GameState => {
  const next = clone(state);
  next.version += 1;

  switch (event.type) {
    case "GameStarted": {
      next.gameId = event.gameId;
      next.seed = event.seed;
      next.status = "active";
      next.playerOrder = event.players.map((player) => player.id);
      next.players = {};
      for (const player of event.players) {
        next.players[player.id] = {
          ...player,
          hand: event.hands[player.id] ?? [],
          bank: [],
          sets: emptyPropertyStacks()
        };
      }
      next.currentTurn = event.startingPlayerId;
      next.playsRemaining = PLAYS_PER_TURN;
      next.mustDraw = true;
      next.deck = event.deck;
      next.discard = [];
      next.winner = null;
      next.log = ["Game started. Draw two cards to begin the first turn."];
      return next;
    }

    case "DiscardPileRecycled": {
      const recycledIds = new Set(event.cards.map((card) => card.id));
      next.discard = next.discard.filter((card) => !recycledIds.has(card.id));
      next.deck.push(...event.cards);
      appendLog(next, `Discard pile recycled ${event.cards.length} card${event.cards.length === 1 ? "" : "s"}.`);
      return next;
    }

    case "CardsDrawn": {
      const player = next.players[event.playerId];
      const drawnIds = new Set(event.cards.map((card) => card.id));
      next.deck = next.deck.filter((card) => !drawnIds.has(card.id));
      player.hand.push(...event.cards);
      if (next.currentTurn === event.playerId && next.mustDraw) {
        next.mustDraw = false;
      }
      appendLog(next, `${player.name} drew ${event.cards.length} card${event.cards.length === 1 ? "" : "s"}.`);
      return next;
    }

    case "CardBanked": {
      const player = next.players[event.playerId];
      removeCardById(player.hand, event.card.id);
      player.bank.push(event.card);
      next.playsRemaining -= 1;
      appendLog(next, `${player.name} banked ${event.card.name}.`);
      return next;
    }

    case "PropertyPlayed": {
      const player = next.players[event.playerId];
      removeCardById(player.hand, event.card.id);
      player.sets[event.color].properties.push(event.card);
      next.playsRemaining -= 1;
      appendLog(next, `${player.name} played ${event.card.name} to ${PROPERTY_CONFIG[event.color].label}.`);
      return next;
    }

    case "ImprovementBuilt": {
      const player = next.players[event.playerId];
      removeCardById(player.hand, event.card.id);
      player.sets[event.color].improvements.push(event.card);
      next.playsRemaining -= 1;
      appendLog(next, `${player.name} built ${event.card.name} on ${PROPERTY_CONFIG[event.color].label}.`);
      return next;
    }

    case "ActionResolved": {
      const player = next.players[event.playerId];
      removeCardById(player.hand, event.card.id);
      next.discard.push(event.card);
      next.playsRemaining -= 1;
      appendLog(next, `${player.name} resolved ${event.card.name}.`);
      return next;
    }

    case "JustSayNoPlayed": {
      const player = next.players[event.playerId];
      const againstPlayer = next.players[event.againstPlayerId];
      removeCardById(player.hand, event.card.id);
      next.discard.push(event.card);
      appendLog(next, `${player.name} used Just Say No against ${againstPlayer.name}'s ${event.againstCard.name}.`);
      return next;
    }

    case "RentCharged": {
      const player = next.players[event.playerId];
      removeCardById(player.hand, event.card.id);
      next.discard.push(event.card);
      if (event.doubleRentCard) {
        removeCardById(player.hand, event.doubleRentCard.id);
        next.discard.push(event.doubleRentCard);
      }
      next.playsRemaining -= event.doubleRentCard ? 2 : 1;
      appendLog(
        next,
        `${player.name} charged ${event.targetPlayerIds.length} player${event.targetPlayerIds.length === 1 ? "" : "s"} $${event.amount}M ${event.doubled ? "double " : ""}rent on ${PROPERTY_CONFIG[event.color].label}.`
      );
      return next;
    }

    case "PaymentCollected": {
      const fromPlayer = next.players[event.fromPlayerId];
      const toPlayer = next.players[event.toPlayerId];
      for (const asset of event.assets) {
        applyPaymentAsset(fromPlayer, toPlayer, asset, next.discard);
      }
      appendLog(
        next,
        `${fromPlayer.name} paid ${toPlayer.name} $${event.paidAmount}M of $${event.requestedAmount}M.`
      );
      return next;
    }

    case "PropertyStolen": {
      const fromPlayer = next.players[event.fromPlayerId];
      const toPlayer = next.players[event.toPlayerId];
      const property = removeProperty(fromPlayer, event.property);
      if (property) {
        discardInvalidImprovements(fromPlayer, event.property.color, next.discard);
        addPropertyToOwner(toPlayer, property, event.property.color);
      }
      appendLog(next, `${toPlayer.name} stole ${event.property.card.name} from ${fromPlayer.name}.`);
      return next;
    }

    case "CompleteSetStolen": {
      const fromPlayer = next.players[event.fromPlayerId];
      const toPlayer = next.players[event.toPlayerId];
      const source = fromPlayer.sets[event.color];
      const target = toPlayer.sets[event.color];
      target.properties.push(...source.properties);
      target.improvements.push(...source.improvements);
      source.properties = [];
      source.improvements = [];
      appendLog(next, `${toPlayer.name} stole ${PROPERTY_CONFIG[event.color].label} from ${fromPlayer.name}.`);
      return next;
    }

    case "PropertiesSwapped": {
      const player = next.players[event.playerId];
      const target = next.players[event.targetPlayerId];
      const offered = removeProperty(player, event.offered);
      const received = removeProperty(target, event.received);
      if (offered) {
        discardInvalidImprovements(player, event.offered.color, next.discard);
        addPropertyToOwner(target, offered, event.offered.color);
      }
      if (received) {
        discardInvalidImprovements(target, event.received.color, next.discard);
        addPropertyToOwner(player, received, event.received.color);
      }
      appendLog(next, `${player.name} swapped ${event.offered.card.name} for ${event.received.card.name}.`);
      return next;
    }

    case "CardsDiscarded": {
      const player = next.players[event.playerId];
      for (const card of event.cards) {
        const discarded = removeCardById(player.hand, card.id);
        if (discarded) {
          next.discard.push(discarded);
        }
      }
      appendLog(next, `${player.name} discarded ${event.cards.length} card${event.cards.length === 1 ? "" : "s"}.`);
      return next;
    }

    case "TurnEnded": {
      const player = next.players[event.playerId];
      appendLog(next, `${player.name} ended the turn.`);
      return next;
    }

    case "TurnStarted": {
      const player = next.players[event.playerId];
      next.currentTurn = event.playerId;
      next.playsRemaining = PLAYS_PER_TURN;
      next.mustDraw = true;
      appendLog(next, `${player.name}'s turn started.`);
      return next;
    }

    case "GameWon": {
      const player = next.players[event.playerId];
      next.status = "won";
      next.winner = event.playerId;
      next.currentTurn = null;
      next.playsRemaining = 0;
      next.mustDraw = false;
      appendLog(next, `${player.name} won with ${event.completedSets} complete sets.`);
      return next;
    }
  }
};

export const projectEvents = (events: readonly DomainEvent[]): GameState =>
  events.reduce((state, event) => applyEvent(state, event), emptyGameState());

export const applyEvents = (
  state: GameState,
  events: readonly DomainEvent[]
): GameState => events.reduce((current, event) => applyEvent(current, event), state);

export const activePlayer = (state: GameState): PlayerState | null =>
  state.currentTurn ? state.players[state.currentTurn] : null;

export const opponentsOf = (state: GameState, playerId: PlayerId): PlayerState[] =>
  state.playerOrder.filter((id) => id !== playerId).map((id) => state.players[id]);

export const isCompleteSet = (stack: PropertyStack, color: PropertyColor): boolean =>
  stack.properties.length >= PROPERTY_CONFIG[color].setSize;

export const completedSetColors = (player: PlayerState): PropertyColor[] =>
  PROPERTY_COLORS.filter((color) => isCompleteSet(player.sets[color], color));

export const completedSetCount = (player: PlayerState): number =>
  completedSetColors(player).length;

export const bankValue = (player: PlayerState): number =>
  player.bank.reduce((total, card) => total + card.value, 0);

export const propertyValue = (player: PlayerState): number =>
  PROPERTY_COLORS.reduce(
    (total, color) =>
      total +
      player.sets[color].properties.reduce((sum, card) => sum + card.value, 0) +
      player.sets[color].improvements.reduce((sum, card) => sum + card.value, 0),
    0
  );

export const rentFor = (
  player: PlayerState,
  color: PropertyColor,
  doubled = false
): number => {
  const stack = player.sets[color];
  if (stack.properties.length === 0) {
    return 0;
  }

  const config = PROPERTY_CONFIG[color];
  const rentIndex = Math.min(stack.properties.length, config.rent.length) - 1;
  let rent = config.rent[rentIndex] ?? 0;

  if (isCompleteSet(stack, color) && config.canImprove) {
    const hasHouse = stack.improvements.some((card) => card.action === "house");
    const hasHotel = stack.improvements.some((card) => card.action === "hotel");
    if (hasHouse) {
      rent += 3;
    }
    if (hasHotel) {
      rent += 4;
    }
  }

  return doubled ? rent * 2 : rent;
};

export const findCardInHand = (
  state: GameState,
  playerId: PlayerId,
  cardId: string
): Card | undefined => state.players[playerId]?.hand.find((card) => card.id === cardId);

export const findPropertyInSets = (
  player: PlayerState,
  cardId: string
): LocatedProperty | undefined => {
  for (const color of PROPERTY_COLORS) {
    const card = player.sets[color].properties.find((property) => property.id === cardId);
    if (card) {
      return { card, color };
    }
  }
  return undefined;
};

export const selectablePaymentAssets = (player: PlayerState): PaymentAsset[] => {
  const bankAssets = [...player.bank]
    .sort((a, b) => b.value - a.value)
    .map((card) => ({ card, source: "bank" as const }));

  const propertyAssets = PROPERTY_COLORS.flatMap((color) =>
    [...player.sets[color].properties]
      .filter((card) => card.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((card) => ({ card, source: "property" as const, color }))
  );

  return [...bankAssets, ...propertyAssets];
};
