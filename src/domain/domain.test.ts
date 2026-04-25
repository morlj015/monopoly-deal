import { describe, expect, it } from "vitest";
import {
  buildDeck,
  isActionCard,
  isBankableCard,
  isMoneyCard,
  isPropertyCard,
  isPropertyWildCard,
  isRentCard,
  PROPERTY_COLORS,
  type ActionCard,
  type Card,
  type MoneyCard,
  type PropertyCard,
  type PropertyColor,
  type PropertyWildCard,
  type RentCard,
  type TablePropertyCard
} from "./cards";
import { DomainRuleViolation } from "./errors";
import type { DomainEvent, PlayerId } from "./events";
import {
  buildImprovement,
  discardCards,
  drawAtTurnStart,
  endTurn,
  playCardToBank,
  playDealBreaker,
  playDebtCollector,
  playForcedDeal,
  playPassGo,
  playProperty,
  playRent,
  playSlyDeal,
  startGame
} from "./commands";
import { COMPETITION_BOT_STRATEGY_IDS, chooseBotEvents, registerBotStrategy } from "./bot";
import {
  applyEvents,
  bankValue,
  completedSetCount,
  HAND_LIMIT,
  isCompleteSet,
  projectEvents,
  rentFor,
  type GameState
} from "./state";

const PLAYER: PlayerId = "player";
const DEALER: PlayerId = "dealer";

interface Pool {
  takeProperty: (color: PropertyColor) => PropertyCard;
  takeWild: (matches?: (card: PropertyWildCard) => boolean) => PropertyWildCard;
  takeAction: (action: ActionCard["action"]) => ActionCard;
  takeRent: (matches?: (card: RentCard) => boolean) => RentCard;
  takeMoney: (value?: number) => MoneyCard;
  takeAny: () => Card;
  rest: () => Card[];
}

const createPool = (): Pool => {
  const cards = [...buildDeck()];

  const take = <T extends Card>(predicate: (card: Card) => card is T): T => {
    const index = cards.findIndex(predicate);
    if (index === -1) {
      throw new Error("Test card not found.");
    }
    const [card] = cards.splice(index, 1);
    return card as T;
  };

  return {
    takeProperty: (color) =>
      take((card): card is PropertyCard => isPropertyCard(card) && card.color === color),
    takeWild: (matches = () => true) =>
      take((card): card is PropertyWildCard => isPropertyWildCard(card) && matches(card)),
    takeAction: (action) =>
      take((card): card is ActionCard => isActionCard(card) && card.action === action),
    takeRent: (matches = () => true) =>
      take((card): card is RentCard => isRentCard(card) && matches(card)),
    takeMoney: (value) =>
      take((card): card is MoneyCard => isMoneyCard(card) && (value === undefined || card.value === value)),
    takeAny: () => take((card): card is Card => Boolean(card)),
    rest: () => [...cards]
  };
};

interface StateSetup {
  playerHand?: Card[];
  dealerHand?: Card[];
  playerBank?: Card[];
  dealerBank?: Card[];
  playerProperties?: Partial<Record<PropertyColor, TablePropertyCard[]>>;
  dealerProperties?: Partial<Record<PropertyColor, TablePropertyCard[]>>;
  playerImprovements?: Partial<Record<PropertyColor, ActionCard[]>>;
  dealerImprovements?: Partial<Record<PropertyColor, ActionCard[]>>;
  deck?: Card[];
  currentPlayer?: PlayerId;
  mustDraw?: boolean;
}

const propertyEntries = (
  playerId: PlayerId,
  properties: Partial<Record<PropertyColor, TablePropertyCard[]>> = {}
): DomainEvent[] =>
  Object.entries(properties).flatMap(([color, cards]) =>
    (cards ?? []).map((card) => ({
      type: "PropertyPlayed" as const,
      playerId,
      card,
      color: color as PropertyColor
    }))
  );

const improvementEntries = (
  playerId: PlayerId,
  improvements: Partial<Record<PropertyColor, ActionCard[]>> = {}
): DomainEvent[] =>
  Object.entries(improvements).flatMap(([color, cards]) =>
    (cards ?? []).map((card) => ({
      type: "ImprovementBuilt" as const,
      playerId,
      card,
      color: color as PropertyColor
    }))
  );

const bankEntries = (playerId: PlayerId, cards: Card[] = []): DomainEvent[] =>
  cards.map((card) => ({ type: "CardBanked" as const, playerId, card }));

const makeState = ({
  playerHand = [],
  dealerHand = [],
  playerBank = [],
  dealerBank = [],
  playerProperties = {},
  dealerProperties = {},
  playerImprovements = {},
  dealerImprovements = {},
  deck = [],
  currentPlayer = PLAYER,
  mustDraw = false
}: StateSetup): GameState => {
  const events: DomainEvent[] = [
    {
      type: "GameStarted",
      gameId: "test-game",
      seed: "test-seed",
      players: [
        { id: PLAYER, name: "Player", role: "human" },
        { id: DEALER, name: "Dealer", role: "bot" }
      ],
      startingPlayerId: PLAYER,
      hands: {
        [PLAYER]: playerHand,
        [DEALER]: dealerHand
      },
      deck
    },
    ...bankEntries(PLAYER, playerBank),
    ...bankEntries(DEALER, dealerBank),
    ...propertyEntries(PLAYER, playerProperties),
    ...propertyEntries(DEALER, dealerProperties),
    ...improvementEntries(PLAYER, playerImprovements),
    ...improvementEntries(DEALER, dealerImprovements)
  ];

  events.push({ type: "TurnStarted", playerId: currentPlayer });
  if (!mustDraw) {
    events.push({ type: "CardsDrawn", playerId: currentPlayer, cards: [] });
  }

  return projectEvents(events);
};

const allStateCards = (state: GameState): Card[] => [
  ...state.deck,
  ...state.discard,
  ...state.playerOrder.flatMap((playerId) => {
    const player = state.players[playerId];
    return [
      ...player.hand,
      ...player.bank,
      ...PROPERTY_COLORS.flatMap((color) => [
        ...player.sets[color].properties,
        ...player.sets[color].improvements
      ])
    ];
  })
];

const expectConservedCards = (state: GameState, expectedTotal = buildDeck().length) => {
  const ids = allStateCards(state).map((card) => card.id);
  expect(ids).toHaveLength(expectedTotal);
  expect(new Set(ids).size).toBe(expectedTotal);
};

const countBy = <T extends string>(values: T[]) =>
  values.reduce<Partial<Record<T, number>>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});

describe("deck and event setup", () => {
  it("builds a physical deck with stable unique card ids", () => {
    const deck = buildDeck();
    const ids = new Set(deck.map((card) => card.id));

    expect(deck.length).toBe(106);
    expect(ids.size).toBe(deck.length);
    expect(deck.some(isPropertyCard)).toBe(true);
    expect(deck.filter(isPropertyWildCard)).toHaveLength(11);
    expect(deck.some(isMoneyCard)).toBe(true);
    expect(deck.some(isActionCard)).toBe(true);
    expect(deck.some(isRentCard)).toBe(true);
  });

  it("matches the Monopoly Deal playable deck manifest", () => {
    const deck = buildDeck();
    const properties = deck.filter(isPropertyCard);
    const money = deck.filter(isMoneyCard);
    const wilds = deck.filter(isPropertyWildCard);
    const actions = deck.filter(isActionCard);
    const rents = deck.filter(isRentCard);

    expect(deck).toHaveLength(106);
    expect(properties).toHaveLength(28);
    expect(countBy(properties.map((card) => card.color))).toEqual({
      brown: 2,
      lightBlue: 3,
      pink: 3,
      orange: 3,
      red: 3,
      yellow: 3,
      green: 3,
      darkBlue: 2,
      railroad: 4,
      utility: 2
    });

    expect(money).toHaveLength(20);
    expect(countBy(money.map((card) => String(card.value)))).toEqual({
      "1": 6,
      "2": 5,
      "3": 3,
      "4": 3,
      "5": 2,
      "10": 1
    });

    expect(wilds).toHaveLength(11);
    expect(countBy(wilds.map((card) => card.colors.join("/")))).toEqual({
      "brown/lightBlue": 1,
      "lightBlue/railroad": 1,
      "pink/orange": 2,
      "red/yellow": 2,
      "green/darkBlue": 1,
      "green/railroad": 1,
      "railroad/utility": 1,
      "brown/lightBlue/pink/orange/red/yellow/green/darkBlue/railroad/utility": 2
    });

    expect(actions).toHaveLength(34);
    expect(countBy(actions.map((card) => card.action))).toEqual({
      passGo: 10,
      dealBreaker: 2,
      slyDeal: 3,
      forcedDeal: 3,
      debtCollector: 3,
      birthday: 3,
      justSayNo: 3,
      doubleRent: 2,
      house: 3,
      hotel: 2
    });

    expect(rents).toHaveLength(13);
    expect(countBy(rents.map((card) => `${card.scope}:${card.colors.join("/")}`))).toEqual({
      "all:brown/lightBlue": 2,
      "all:pink/orange": 2,
      "all:red/yellow": 2,
      "all:green/darkBlue": 2,
      "all:railroad/utility": 2,
      "one:brown/lightBlue/pink/orange/red/yellow/green/darkBlue/railroad/utility": 3
    });
  });

  it("starts games deterministically from the seed", () => {
    const first = startGame({
      gameId: "a",
      seed: "fixed-seed",
      players: [
        { id: PLAYER, name: "Player", role: "human" },
        { id: DEALER, name: "Dealer", role: "bot" }
      ]
    });
    const second = startGame({
      gameId: "b",
      seed: "fixed-seed",
      players: [
        { id: PLAYER, name: "Player", role: "human" },
        { id: DEALER, name: "Dealer", role: "bot" }
      ]
    });

    const firstStarted = first[0];
    const secondStarted = second[0];
    expect(firstStarted.type).toBe("GameStarted");
    expect(secondStarted.type).toBe("GameStarted");
    if (firstStarted.type === "GameStarted" && secondStarted.type === "GameStarted") {
      expect(firstStarted.hands[PLAYER].map((card) => card.id)).toEqual(
        secondStarted.hands[PLAYER].map((card) => card.id)
      );
      expect(firstStarted.deck.map((card) => card.id)).toEqual(secondStarted.deck.map((card) => card.id));
    }
  });

  it("projects state only from the recorded events", () => {
    const pool = createPool();
    const money = pool.takeMoney(5);
    const property = pool.takeProperty("brown");
    const events = makeState({
      playerHand: [money, property],
      mustDraw: false
    });
    const banked = playCardToBank(events, PLAYER, money.id);
    const played = playProperty(applyEvents(events, banked), PLAYER, property.id);
    const replayed = projectEvents([
      {
        type: "GameStarted",
        gameId: "test-game",
        seed: "test-seed",
        players: [
          { id: PLAYER, name: "Player", role: "human" },
          { id: DEALER, name: "Dealer", role: "bot" }
        ],
        startingPlayerId: PLAYER,
        hands: {
          [PLAYER]: [money, property],
          [DEALER]: []
        },
        deck: []
      },
      { type: "CardsDrawn", playerId: PLAYER, cards: [] },
      ...banked,
      ...played
    ]);

    expect(replayed.players[PLAYER].bank).toHaveLength(1);
    expect(replayed.players[PLAYER].sets.brown.properties).toHaveLength(1);
    expect(replayed.players[PLAYER].hand).toHaveLength(0);
  });

  it("conserves every physical card across a four-bot self-play prefix", () => {
    let state = projectEvents(
      startGame({
        gameId: "self-play-prefix",
        seed: "audit-seed",
        players: [
          { id: "a", name: "A", role: "bot" },
          { id: "b", name: "B", role: "bot" },
          { id: "c", name: "C", role: "bot" },
          { id: "d", name: "D", role: "bot" }
        ]
      })
    );

    expectConservedCards(state);
    for (let step = 0; step < 160 && state.status === "active"; step += 1) {
      const current = state.currentTurn;
      expect(current).toBeTruthy();
      const events = chooseBotEvents(state, current as PlayerId, "medium");
      expect(events).toBeTruthy();
      state = applyEvents(state, events ?? []);
      expectConservedCards(state);
    }
  });

  it("conserves every physical card through a completed four-bot game", () => {
    let state = projectEvents(
      startGame({
        gameId: "self-play-complete",
        seed: "layout-busy-seed",
        players: [
          { id: "a", name: "A", role: "bot" },
          { id: "b", name: "B", role: "bot" },
          { id: "c", name: "C", role: "bot" },
          { id: "d", name: "D", role: "bot" }
        ]
      })
    );

    for (let step = 0; step < 1000 && state.status === "active"; step += 1) {
      const current = state.currentTurn;
      expect(current).toBeTruthy();
      const events = chooseBotEvents(state, current as PlayerId, "medium");
      expect(events).toBeTruthy();
      state = applyEvents(state, events ?? []);
      expectConservedCards(state);
    }

    expect(state.status).toBe("won");
    expectConservedCards(state);
  });

  it("recycles the discard pile into the deck before drawing", () => {
    const pool = createPool();
    const discardOne = pool.takeMoney(1);
    const discardTwo = pool.takeMoney(2);
    const state = makeState({ deck: [], mustDraw: true });
    state.discard = [discardOne, discardTwo];

    const events = drawAtTurnStart(state, PLAYER);
    const next = applyEvents(state, events);

    expect(events[0].type).toBe("DiscardPileRecycled");
    expect(next.players[PLAYER].hand).toHaveLength(2);
    expect(next.deck).toHaveLength(0);
    expect(next.discard).toHaveLength(0);
    expectConservedCards(next, 2);
  });
});

describe("turn commands", () => {
  it("requires the active player to draw before playing", () => {
    const pool = createPool();
    const state = makeState({
      playerHand: [pool.takeMoney(1)],
      deck: [pool.takeMoney(2), pool.takeMoney(3)],
      mustDraw: true
    });

    expect(() => playCardToBank(state, PLAYER, state.players[PLAYER].hand[0].id)).toThrow(
      DomainRuleViolation
    );

    const drawn = drawAtTurnStart(state, PLAYER);
    const next = applyEvents(state, drawn);

    expect(next.mustDraw).toBe(false);
    expect(next.players[PLAYER].hand).toHaveLength(3);
    expect(next.deck).toHaveLength(0);
  });

  it("moves money into the bank and rejects banking property", () => {
    const pool = createPool();
    const moneyCard = pool.takeMoney(3);
    const property = pool.takeProperty("brown");
    const state = makeState({ playerHand: [moneyCard, property] });

    const next = applyEvents(state, playCardToBank(state, PLAYER, moneyCard.id));

    expect(next.players[PLAYER].bank.map((card) => card.id)).toEqual([moneyCard.id]);
    expect(next.players[PLAYER].hand.map((card) => card.id)).toEqual([property.id]);
    expect(next.playsRemaining).toBe(2);
    expect(() => playCardToBank(next, PLAYER, property.id)).toThrow(DomainRuleViolation);
  });

  it("plays a property and emits a win when the third set is completed", () => {
    const pool = createPool();
    const finalBrown = pool.takeProperty("brown");
    const state = makeState({
      playerHand: [finalBrown],
      playerProperties: {
        brown: [pool.takeProperty("brown")],
        darkBlue: [pool.takeProperty("darkBlue"), pool.takeProperty("darkBlue")],
        utility: [pool.takeProperty("utility"), pool.takeProperty("utility")]
      }
    });

    const events = playProperty(state, PLAYER, finalBrown.id);
    const next = applyEvents(state, events);

    expect(events.at(-1)?.type).toBe("GameWon");
    expect(next.winner).toBe(PLAYER);
    expect(completedSetCount(next.players[PLAYER])).toBe(3);
  });

  it("plays property wild cards into a chosen legal color", () => {
    const pool = createPool();
    const wild = pool.takeWild((card) => card.colors.includes("green") && card.colors.includes("darkBlue"));
    const state = makeState({ playerHand: [wild] });

    const next = applyEvents(state, playProperty(state, PLAYER, wild.id, "green"));

    expect(next.players[PLAYER].sets.green.properties.map((card) => card.id)).toEqual([wild.id]);
    expect(() => playProperty(state, PLAYER, wild.id, "red")).toThrow(DomainRuleViolation);
  });

  it("forces a discard before ending above the hand limit", () => {
    const pool = createPool();
    const hand = Array.from({ length: HAND_LIMIT + 1 }, () => pool.takeAny());
    const state = makeState({ playerHand: hand });

    expect(() => endTurn(state, PLAYER)).toThrow(DomainRuleViolation);

    const afterDiscard = applyEvents(state, discardCards(state, PLAYER, [hand[0].id]));
    const ended = applyEvents(afterDiscard, endTurn(afterDiscard, PLAYER));

    expect(ended.currentTurn).toBe(DEALER);
    expect(ended.mustDraw).toBe(true);
    expect(ended.players[PLAYER].hand).toHaveLength(HAND_LIMIT);
  });
});

describe("action cards and rent", () => {
  it("resolves Pass Go by discarding the action and drawing two", () => {
    const pool = createPool();
    const passGo = pool.takeAction("passGo");
    const drawOne = pool.takeMoney(1);
    const drawTwo = pool.takeProperty("green");
    const state = makeState({ playerHand: [passGo], deck: [drawOne, drawTwo] });

    const next = applyEvents(state, playPassGo(state, PLAYER, passGo.id));

    expect(next.discard.map((card) => card.id)).toContain(passGo.id);
    expect(next.players[PLAYER].hand.map((card) => card.id)).toEqual([drawOne.id, drawTwo.id]);
    expect(next.playsRemaining).toBe(2);
  });

  it("charges rent, supports Double the Rent, and overpayment has no change", () => {
    const pool = createPool();
    const rent = pool.takeRent((card) => card.colors.includes("brown"));
    const doubleRent = pool.takeAction("doubleRent");
    const five = pool.takeMoney(5);
    const state = makeState({
      playerHand: [rent, doubleRent],
      playerProperties: {
        brown: [pool.takeProperty("brown"), pool.takeProperty("brown")]
      },
      dealerBank: [five]
    });

    const next = applyEvents(
      state,
      playRent(state, PLAYER, rent.id, DEALER, "brown", doubleRent.id)
    );

    expect(bankValue(next.players[PLAYER])).toBe(5);
    expect(next.players[DEALER].bank).toHaveLength(0);
    expect(next.discard.map((card) => card.id)).toEqual(expect.arrayContaining([rent.id, doubleRent.id]));
    expect(next.playsRemaining).toBe(1);
  });

  it("standard rent charges every opponent in a multiplayer game", () => {
    const pool = createPool();
    const rent = pool.takeRent((card) => card.scope === "all" && card.colors.includes("brown"));
    const one = pool.takeMoney(1);
    const two = pool.takeMoney(2);
    const events: DomainEvent[] = [
      {
        type: "GameStarted",
        gameId: "three-player",
        seed: "seed",
        players: [
          { id: "a", name: "A", role: "bot" },
          { id: "b", name: "B", role: "bot" },
          { id: "c", name: "C", role: "bot" }
        ],
        startingPlayerId: "a",
        hands: { a: [rent], b: [one], c: [two] },
        deck: []
      },
      { type: "TurnStarted", playerId: "a" },
      { type: "CardsDrawn", playerId: "a", cards: [] },
      {
        type: "PropertyPlayed",
        playerId: "a",
        card: pool.takeProperty("brown"),
        color: "brown"
      },
      { type: "CardBanked", playerId: "b", card: one },
      { type: "CardBanked", playerId: "c", card: two },
      { type: "TurnStarted", playerId: "a" },
      { type: "CardsDrawn", playerId: "a", cards: [] }
    ];
    const state = projectEvents(events);

    const next = applyEvents(state, playRent(state, "a", rent.id, null, "brown"));

    expect(bankValue(next.players.a)).toBe(3);
    expect(next.players.b.bank).toHaveLength(0);
    expect(next.players.c.bank).toHaveLength(0);
  });

  it("bot targets can cancel targeted action cards with Just Say No", () => {
    const pool = createPool();
    const debtCollector = pool.takeAction("debtCollector");
    const justSayNo = pool.takeAction("justSayNo");
    const five = pool.takeMoney(5);
    const state = makeState({
      playerHand: [debtCollector],
      dealerHand: [justSayNo],
      dealerBank: [five]
    });

    const next = applyEvents(
      state,
      playDebtCollector(state, PLAYER, debtCollector.id, DEALER)
    );

    expect(bankValue(next.players[PLAYER])).toBe(0);
    expect(bankValue(next.players[DEALER])).toBe(5);
    expect(next.discard.map((card) => card.id)).toEqual(
      expect.arrayContaining([debtCollector.id, justSayNo.id])
    );
  });

  it("collects property when the payer has no bank", () => {
    const pool = createPool();
    const debtCollector = pool.takeAction("debtCollector");
    const green = pool.takeProperty("green");
    const state = makeState({
      playerHand: [debtCollector],
      dealerProperties: {
        green: [green]
      }
    });

    const next = applyEvents(
      state,
      playDebtCollector(state, PLAYER, debtCollector.id, DEALER)
    );

    expect(next.players[DEALER].sets.green.properties).toHaveLength(0);
    expect(next.players[PLAYER].sets.green.properties.map((card) => card.id)).toEqual([green.id]);
  });

  it("adds house and hotel rent only on complete improvable sets", () => {
    const pool = createPool();
    const house = pool.takeAction("house");
    const hotel = pool.takeAction("hotel");
    const state = makeState({
      playerHand: [house, hotel],
      playerProperties: {
        red: [
          pool.takeProperty("red"),
          pool.takeProperty("red"),
          pool.takeProperty("red")
        ]
      }
    });

    expect(() => buildImprovement(state, PLAYER, hotel.id, "red")).toThrow(DomainRuleViolation);

    const withHouse = applyEvents(state, buildImprovement(state, PLAYER, house.id, "red"));
    const withHotel = applyEvents(withHouse, buildImprovement(withHouse, PLAYER, hotel.id, "red"));

    expect(rentFor(withHotel.players[PLAYER], "red")).toBe(13);
  });
});

describe("steal and swap actions", () => {
  it("prevents Sly Deal from taking a complete set and allows incomplete targets", () => {
    const pool = createPool();
    const sly = pool.takeAction("slyDeal");
    const completeState = makeState({
      playerHand: [sly],
      dealerProperties: {
        brown: [pool.takeProperty("brown"), pool.takeProperty("brown")]
      }
    });

    expect(() =>
      playSlyDeal(
        completeState,
        PLAYER,
        sly.id,
        DEALER,
        completeState.players[DEALER].sets.brown.properties[0].id
      )
    ).toThrow(DomainRuleViolation);

    const secondPool = createPool();
    const secondSly = secondPool.takeAction("slyDeal");
    const target = secondPool.takeProperty("orange");
    const state = makeState({
      playerHand: [secondSly],
      dealerProperties: { orange: [target] }
    });
    const next = applyEvents(state, playSlyDeal(state, PLAYER, secondSly.id, DEALER, target.id));

    expect(next.players[PLAYER].sets.orange.properties.map((card) => card.id)).toEqual([target.id]);
    expect(next.players[DEALER].sets.orange.properties).toHaveLength(0);
  });

  it("steals a complete set with Deal Breaker including improvements", () => {
    const pool = createPool();
    const dealBreaker = pool.takeAction("dealBreaker");
    const house = pool.takeAction("house");
    const state = makeState({
      playerHand: [dealBreaker],
      dealerProperties: {
        brown: [pool.takeProperty("brown"), pool.takeProperty("brown")]
      },
      dealerImprovements: {
        brown: [house]
      }
    });

    const next = applyEvents(
      state,
      playDealBreaker(state, PLAYER, dealBreaker.id, DEALER, "brown")
    );

    expect(isCompleteSet(next.players[PLAYER].sets.brown, "brown")).toBe(true);
    expect(next.players[PLAYER].sets.brown.improvements.map((card) => card.id)).toEqual([house.id]);
    expect(next.players[DEALER].sets.brown.properties).toHaveLength(0);
  });

  it("swaps two incomplete properties with Forced Deal", () => {
    const pool = createPool();
    const forcedDeal = pool.takeAction("forcedDeal");
    const offered = pool.takeProperty("brown");
    const received = pool.takeProperty("lightBlue");
    const state = makeState({
      playerHand: [forcedDeal],
      playerProperties: { brown: [offered] },
      dealerProperties: { lightBlue: [received] }
    });

    const next = applyEvents(
      state,
      playForcedDeal(state, PLAYER, forcedDeal.id, DEALER, offered.id, received.id)
    );

    expect(next.players[PLAYER].sets.lightBlue.properties.map((card) => card.id)).toEqual([
      received.id
    ]);
    expect(next.players[DEALER].sets.brown.properties.map((card) => card.id)).toEqual([
      offered.id
    ]);
  });
});

describe("bot policy", () => {
  it("draws first, then prefers playing property cards", () => {
    const pool = createPool();
    const property = pool.takeProperty("yellow");
    const state = makeState({
      dealerHand: [property],
      deck: [pool.takeMoney(1), pool.takeMoney(2)],
      currentPlayer: DEALER,
      mustDraw: true
    });

    const drawEvents = chooseBotEvents(state, DEALER, "medium");
    expect(drawEvents?.[0].type).toBe("CardsDrawn");

    const ready = applyEvents(state, drawEvents ?? []);
    const playEvents = chooseBotEvents(ready, DEALER, "medium");
    expect(playEvents?.[0].type).toBe("PropertyPlayed");
  });

  it("banks Pass Go instead of resolving a zero-card draw loop", () => {
    const pool = createPool();
    const passGo = pool.takeAction("passGo");
    const state = makeState({
      dealerHand: [passGo],
      currentPlayer: DEALER
    });

    expect(() => playPassGo(state, DEALER, passGo.id)).toThrow(DomainRuleViolation);

    const events = chooseBotEvents(state, DEALER, "builder");
    expect(events?.[0]).toMatchObject({
      type: "CardBanked",
      playerId: DEALER,
      card: passGo
    });
  });

  it("resolves strategy plugins from the active bot player config", () => {
    const pool = createPool();
    const property = pool.takeProperty("yellow");
    const money = pool.takeMoney(5);
    const strategyId = "test-bank-first";
    registerBotStrategy({
      id: strategyId,
      name: "Test Bank First",
      description: "Test strategy that banks before building.",
      chooseEvents: ({ state, playerId }) => {
        const card = state.players[playerId].hand.find(isBankableCard);
        return card ? playCardToBank(state, playerId, card.id) : null;
      }
    });
    const state = makeState({
      dealerHand: [property, money],
      currentPlayer: DEALER
    });
    const configured: GameState = {
      ...state,
      players: {
        ...state.players,
        [DEALER]: {
          ...state.players[DEALER],
          botStrategyId: strategyId
        }
      }
    };

    const events = chooseBotEvents(configured, DEALER, "medium");

    expect(events?.[0].type).toBe("CardBanked");
    expect(events?.[0]).toMatchObject({ playerId: DEALER, card: money });
  });

  it("runs mixed strategy self-play without losing physical cards", () => {
    let state = projectEvents(
      startGame({
        gameId: "mixed-strategy-prefix",
        seed: "mixed-strategy-seed",
        players: ["a", "b", "c", "d"].map((id, index) => ({
          id,
          name: id.toUpperCase(),
          role: "bot" as const,
          botStrategyId: COMPETITION_BOT_STRATEGY_IDS[index]
        }))
      })
    );

    expectConservedCards(state);
    for (let step = 0; step < 180 && state.status === "active"; step += 1) {
      const current = state.currentTurn;
      expect(current).toBeTruthy();
      const events = chooseBotEvents(state, current as PlayerId, "medium");
      expect(events).toBeTruthy();
      state = applyEvents(state, events ?? []);
      expectConservedCards(state);
    }
  });
});
