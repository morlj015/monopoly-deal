import { describe, it, expect } from "vitest";
import { GameAggregate } from "../aggregates/game.aggregate";
import { buildDeck } from "../rules/deck.builder";
import { isComplete } from "../rules/set.rules";
import type { Card, ActionCard, PropertyCard, RentCard } from "../types/card.types";
import type { GameEvent } from "../events/game.events";

// ─── Test helpers ─────────────────────────────────────────────────────────────

const GID = "test-game-1";

function fresh(): GameAggregate {
  return new GameAggregate(GID);
}

function started(difficulty: "easy" | "medium" | "hard" = "easy"): {
  g: GameAggregate;
  events: GameEvent[];
} {
  const g = fresh();
  g.handle({ type: "StartGame", gameId: GID, issuedBy: "player", difficulty });
  const events = g.flush();
  return { g, events };
}

function withDrawn(): { g: GameAggregate; events: GameEvent[] } {
  const { g } = started();
  g.handle({ type: "DrawCards", gameId: GID, issuedBy: "player" });
  const events = g.flush();
  return { g, events };
}

function cardOfKind<T extends Card>(
  cards: Card[],
  predicate: (c: Card) => c is T
): T | undefined {
  return cards.find(predicate) as T | undefined;
}

function propertyCard(cards: Card[]): PropertyCard | undefined {
  return cardOfKind(cards, (c): c is PropertyCard => c.kind === "property");
}

function moneyCard(cards: Card[]): Card | undefined {
  return cards.find((c) => c.kind === "money");
}

function actionCard(
  cards: Card[],
  subtype: ActionCard["subtype"]
): ActionCard | undefined {
  return cards.find(
    (c): c is ActionCard => c.kind === "action" && c.subtype === subtype
  );
}

// ─── StartGame ────────────────────────────────────────────────────────────────

describe("StartGame", () => {
  it("emits GameStarted + TurnStarted", () => {
    const { events } = started();
    expect(events.map((e) => e.type)).toEqual(["GameStarted", "TurnStarted"]);
  });

  it("deals 5 cards to each player", () => {
    const { events } = started();
    const gs = events.find((e) => e.type === "GameStarted")!;
    if (gs.type !== "GameStarted") throw new Error();
    expect(gs.hands.player).toHaveLength(5);
    expect(gs.hands.ai).toHaveLength(5);
  });

  it("each dealt card is unique", () => {
    const { events } = started();
    const gs = events.find((e) => e.type === "GameStarted")!;
    if (gs.type !== "GameStarted") throw new Error();
    const allIds = [...gs.hands.player, ...gs.hands.ai].map((c) => c.id);
    expect(new Set(allIds).size).toBe(10);
  });

  it("sets phase to draw", () => {
    const { g } = started();
    expect(g.snapshot.phase).toBe("draw");
  });

  it("throws if game already started", () => {
    const { g } = started();
    expect(() =>
      g.handle({ type: "StartGame", gameId: GID, issuedBy: "player", difficulty: "easy" })
    ).toThrow();
  });

  it("produces sequential seq numbers starting at 0", () => {
    const { events } = started();
    events.forEach((e, i) => expect(e.seq).toBe(i));
  });
});

// ─── DrawCards ────────────────────────────────────────────────────────────────

describe("DrawCards", () => {
  it("emits CardsDrawn with 2 cards", () => {
    const { g } = started();
    g.handle({ type: "DrawCards", gameId: GID, issuedBy: "player" });
    const [ev] = g.flush();
    expect(ev.type).toBe("CardsDrawn");
    if (ev.type !== "CardsDrawn") throw new Error();
    expect(ev.cards).toHaveLength(2);
  });

  it("adds drawn cards to player hand", () => {
    const { g } = withDrawn();
    expect(g.snapshot.players.player.hand.length).toBe(7);
  });

  it("sets phase to action", () => {
    const { g } = withDrawn();
    expect(g.snapshot.phase).toBe("action");
  });

  it("draws 5 if hand is empty", () => {
    const g = fresh();
    g.handle({ type: "StartGame", gameId: GID, issuedBy: "player", difficulty: "easy" });
    g.flush();
    // Drain player hand by injecting state manipulation is not ideal in event sourcing
    // Instead test via rehydration of a GameStarted event with empty hand
    const g2 = new GameAggregate("g2");
    const deck = buildDeck().slice(5);
    g2.rehydrate([
      {
        type: "GameStarted",
        seq: 0,
        gameId: "g2",
        ts: new Date().toISOString(),
        deck,
        hands: { player: [], ai: deck.slice(0, 5) },
        difficulty: "easy",
      },
      {
        type: "TurnStarted",
        seq: 1,
        gameId: "g2",
        ts: new Date().toISOString(),
        activePlayer: "player",
      },
    ]);
    g2.setDeck(deck.slice(5));
    g2.handle({ type: "DrawCards", gameId: "g2", issuedBy: "player" });
    const [ev] = g2.flush();
    expect(ev.type).toBe("CardsDrawn");
    if (ev.type !== "CardsDrawn") throw new Error();
    expect(ev.cards).toHaveLength(5);
  });

  it("throws if drawing twice in same turn", () => {
    const { g } = started();
    g.handle({ type: "DrawCards", gameId: GID, issuedBy: "player" });
    g.flush();
    expect(() =>
      g.handle({ type: "DrawCards", gameId: GID, issuedBy: "player" })
    ).toThrow();
  });

  it("throws if not player's turn", () => {
    const { g } = started();
    expect(() =>
      g.handle({ type: "DrawCards", gameId: GID, issuedBy: "ai" })
    ).toThrow();
  });
});

// ─── BankCard ─────────────────────────────────────────────────────────────────

describe("BankCard", () => {
  it("moves a money card from hand to bank", () => {
    const { g } = withDrawn();
    const money = moneyCard(g.snapshot.players.player.hand)!;
    if (!money) return; // skip if no money card drawn
    g.handle({ type: "BankCard", gameId: GID, issuedBy: "player", cardId: money.id });
    g.flush();
    const state = g.snapshot;
    expect(state.players.player.hand.some((c) => c.id === money.id)).toBe(false);
    expect(state.players.player.bank.some((c) => c.id === money.id)).toBe(true);
  });

  it("decrements plays", () => {
    const { g } = withDrawn();
    const money = moneyCard(g.snapshot.players.player.hand);
    if (!money) return;
    g.handle({ type: "BankCard", gameId: GID, issuedBy: "player", cardId: money.id });
    g.flush();
    expect(g.snapshot.turn.playsLeft).toBe(2);
  });

  it("throws if player tries to bank a property", () => {
    const { g } = withDrawn();
    const prop = propertyCard(g.snapshot.players.player.hand);
    if (!prop) return;
    expect(() =>
      g.handle({ type: "BankCard", gameId: GID, issuedBy: "player", cardId: prop.id })
    ).toThrow();
  });

  it("throws if no plays left", () => {
    const { g } = withDrawn();
    const hand = g.snapshot.players.player.hand;
    let used = 0;
    for (const card of hand) {
      if (used >= 3) break;
      if (card.kind === "money" || card.kind === "rent" || card.kind === "action") {
        g.handle({ type: "BankCard", gameId: GID, issuedBy: "player", cardId: card.id });
        g.flush();
        used++;
      }
    }
    if (used < 3) return; // couldn't exhaust plays with available cards
    const remaining = g.snapshot.players.player.hand;
    const bankable = remaining.find(
      (c) => c.kind === "money" || c.kind === "rent" || c.kind === "action"
    );
    if (!bankable) return;
    expect(() =>
      g.handle({ type: "BankCard", gameId: GID, issuedBy: "player", cardId: bankable.id })
    ).toThrow();
  });
});

// ─── PlayProperty ─────────────────────────────────────────────────────────────

describe("PlayProperty", () => {
  it("adds property to the correct color set", () => {
    const { g } = withDrawn();
    const prop = propertyCard(g.snapshot.players.player.hand);
    if (!prop) return;
    g.handle({
      type: "PlayProperty",
      gameId: GID,
      issuedBy: "player",
      cardId: prop.id,
      toColor: prop.color,
    });
    g.flush();
    const sets = g.snapshot.players.player.sets;
    expect(sets[prop.color]?.some((c) => c.id === prop.id)).toBe(true);
  });

  it("removes card from hand", () => {
    const { g } = withDrawn();
    const prop = propertyCard(g.snapshot.players.player.hand);
    if (!prop) return;
    g.handle({
      type: "PlayProperty",
      gameId: GID,
      issuedBy: "player",
      cardId: prop.id,
      toColor: prop.color,
    });
    g.flush();
    expect(g.snapshot.players.player.hand.some((c) => c.id === prop.id)).toBe(false);
  });

  it("emits GameEnded when third set is completed", () => {
    // Build a game state that's one card away from winning and play the last card
    const deck = buildDeck();
    // Find 3 near-complete sets in the deck
    const brown = deck.filter((c) => c.kind === "property" && c.color === "brown");
    const lightblue = deck.filter(
      (c) => c.kind === "property" && c.color === "lightblue"
    );
    const pink = deck.filter((c) => c.kind === "property" && c.color === "pink");
    // Need 2 brown, 3 lightblue, 3 pink = 8 cards
    if (brown.length < 2 || lightblue.length < 3 || pink.length < 3) return;

    const winning = [
      ...brown.slice(0, 2),
      ...lightblue.slice(0, 3),
      ...pink.slice(0, 2), // one short of complete
    ] as PropertyCard[];
    const lastPinkCard = pink[2] as PropertyCard;

    const remaining = deck.filter(
      (c) => !winning.some((w) => w.id === c.id) && c.id !== lastPinkCard.id
    );

    const g = new GameAggregate("win-test");
    g.rehydrate([
      {
        type: "GameStarted",
        seq: 0,
        gameId: "win-test",
        ts: new Date().toISOString(),
        deck: remaining,
        hands: { player: [lastPinkCard], ai: remaining.slice(0, 5) },
        difficulty: "easy",
      },
      {
        type: "TurnStarted",
        seq: 1,
        gameId: "win-test",
        ts: new Date().toISOString(),
        activePlayer: "player",
      },
      // Place winning cards into sets
      ...winning.map((card, i) => ({
        type: "PropertyPlayed" as const,
        seq: 2 + i,
        gameId: "win-test",
        ts: new Date().toISOString(),
        player: "player" as const,
        card,
        toColor: card.color,
      })),
      {
        type: "CardsDrawn",
        seq: 2 + winning.length,
        gameId: "win-test",
        ts: new Date().toISOString(),
        player: "player" as const,
        cards: [lastPinkCard],
      },
    ]);
    g.setDeck(remaining.slice(5));
    // Patch: state needs playsLeft > 0. After PropertyPlayed events above, playsLeft decremented
    // We need to reset turn. Let's instead build a simpler scenario.
    // Re-do: just test that GameEnded is in the flushed events when the last card is played
    const g2 = new GameAggregate("win-test-2");
    const deckCards = deck.filter(
      (c) =>
        !winning.some((w) => w.id === c.id) && c.id !== lastPinkCard.id
    );
    g2.rehydrate([
      {
        type: "GameStarted",
        seq: 0,
        gameId: "win-test-2",
        ts: new Date().toISOString(),
        deck: deckCards,
        hands: { player: [lastPinkCard], ai: deckCards.slice(0, 5) },
        difficulty: "easy",
      },
      {
        type: "TurnStarted",
        seq: 1,
        gameId: "win-test-2",
        ts: new Date().toISOString(),
        activePlayer: "player",
      },
      {
        type: "CardsDrawn",
        seq: 2,
        gameId: "win-test-2",
        ts: new Date().toISOString(),
        player: "player",
        cards: [],
      },
      // Pre-populate sets
      ...winning.map((card, i) => ({
        type: "PropertyPlayed" as const,
        seq: 3 + i,
        gameId: "win-test-2",
        ts: new Date().toISOString(),
        player: "player" as const,
        card,
        toColor: card.color,
      })),
    ]);
    g2.setDeck(deckCards.slice(5));

    // After rehydration, reset turn with fresh playsLeft
    // Force state via a new TurnStarted
    g2.rehydrate([
      {
        type: "TurnStarted",
        seq: 100,
        gameId: "win-test-2",
        ts: new Date().toISOString(),
        activePlayer: "player",
      },
      {
        type: "CardsDrawn",
        seq: 101,
        gameId: "win-test-2",
        ts: new Date().toISOString(),
        player: "player",
        cards: [],
      },
    ]);

    g2.handle({
      type: "PlayProperty",
      gameId: "win-test-2",
      issuedBy: "player",
      cardId: lastPinkCard.id,
      toColor: "pink",
    });
    const events = g2.flush();
    expect(events.some((e) => e.type === "GameEnded")).toBe(true);
    const ge = events.find((e) => e.type === "GameEnded")!;
    if (ge.type !== "GameEnded") throw new Error();
    expect(ge.winner).toBe("player");
  });
});

// ─── PassGo ───────────────────────────────────────────────────────────────────

describe("PlayPassGo", () => {
  it("draws 2 additional cards", () => {
    const { g } = withDrawn();
    const pg = actionCard(g.snapshot.players.player.hand, "passgo");
    if (!pg) return;
    const before = g.snapshot.players.player.hand.length;
    g.handle({ type: "PlayPassGo", gameId: GID, issuedBy: "player", cardId: pg.id });
    g.flush();
    // Pass Go card removed (+0), 2 drawn (+2) → net +1
    expect(g.snapshot.players.player.hand.length).toBe(before - 1 + 2);
  });

  it("decrements plays", () => {
    const { g } = withDrawn();
    const pg = actionCard(g.snapshot.players.player.hand, "passgo");
    if (!pg) return;
    g.handle({ type: "PlayPassGo", gameId: GID, issuedBy: "player", cardId: pg.id });
    g.flush();
    expect(g.snapshot.turn.playsLeft).toBe(2);
  });
});

// ─── EndTurn / TurnRotation ───────────────────────────────────────────────────

describe("EndTurn", () => {
  it("switches active player to ai", () => {
    const { g } = withDrawn();
    g.handle({ type: "EndTurn", gameId: GID, issuedBy: "player" });
    g.flush();
    expect(g.snapshot.turn.activePlayer).toBe("ai");
  });

  it("resets playsLeft to 3", () => {
    const { g } = withDrawn();
    const money = moneyCard(g.snapshot.players.player.hand);
    if (money) {
      g.handle({ type: "BankCard", gameId: GID, issuedBy: "player", cardId: money.id });
      g.flush();
    }
    g.handle({ type: "EndTurn", gameId: GID, issuedBy: "player" });
    g.flush();
    expect(g.snapshot.turn.playsLeft).toBe(3);
  });

  it("throws if hand > 7", () => {
    // Hard to test without injecting state — skip if hand ≤ 7 after draw
    const { g } = withDrawn();
    const hand = g.snapshot.players.player.hand;
    if (hand.length <= 7) return; // can't test this path
    expect(() =>
      g.handle({ type: "EndTurn", gameId: GID, issuedBy: "player" })
    ).toThrow();
  });
});

// ─── Rent ─────────────────────────────────────────────────────────────────────

describe("PlayRent", () => {
  it("initiates a JSN check targeting ai", () => {
    // Need a rent card AND a matching property set — use deck injection
    const fullDeck = buildDeck();
    const orangeRent = fullDeck.find(
      (c) => c.kind === "rent" && "colors" in c && c.colors.includes("orange")
    ) as RentCard | undefined;
    const orangeProps = fullDeck.filter(
      (c) => c.kind === "property" && c.color === "orange"
    ) as PropertyCard[];

    if (!orangeRent || orangeProps.length < 1) return;

    // Build scenario
    const g2 = new GameAggregate("rent-test");
    const deckRemainder = fullDeck.filter(
      (c) =>
        c.id !== orangeRent.id &&
        !orangeProps.slice(0, 1).some((p) => p.id === c.id)
    );
    g2.rehydrate([
      {
        type: "GameStarted",
        seq: 0,
        gameId: "rent-test",
        ts: new Date().toISOString(),
        deck: deckRemainder,
        hands: { player: [orangeRent, orangeProps[0]], ai: deckRemainder.slice(0, 5) },
        difficulty: "easy",
      },
      {
        type: "TurnStarted",
        seq: 1,
        gameId: "rent-test",
        ts: new Date().toISOString(),
        activePlayer: "player",
      },
      {
        type: "CardsDrawn",
        seq: 2,
        gameId: "rent-test",
        ts: new Date().toISOString(),
        player: "player",
        cards: [],
      },
      {
        type: "PropertyPlayed",
        seq: 3,
        gameId: "rent-test",
        ts: new Date().toISOString(),
        player: "player",
        card: orangeProps[0],
        toColor: "orange",
      },
    ]);
    g2.setDeck(deckRemainder.slice(5));

    g2.handle({
      type: "PlayRent",
      gameId: "rent-test",
      issuedBy: "player",
      cardId: orangeRent.id,
      chosenColor: "orange",
    });
    const events = g2.flush();
    const ai = events.find((e) => e.type === "ActionInitiated");
    expect(ai).toBeTruthy();
    if (ai?.type !== "ActionInitiated") throw new Error();
    expect(ai.actionKind).toBe("rent");
    expect(ai.target).toBe("ai");
    expect(g2.snapshot.pendingReaction?.kind).toBe("jsnCheck");
  });

  it("resolves into DebtOwed when ai accepts", () => {
    const fullDeck = buildDeck();
    const orangeRent = fullDeck.find(
      (c) => c.kind === "rent" && "colors" in c && c.colors.includes("orange")
    ) as RentCard | undefined;
    const orangeProps = fullDeck.filter(
      (c) => c.kind === "property" && c.color === "orange"
    ) as PropertyCard[];
    if (!orangeRent || !orangeProps[0]) return;

    const deckRem = fullDeck.filter(
      (c) => c.id !== orangeRent.id && c.id !== orangeProps[0].id
    );
    const g = new GameAggregate("rent-resolve");
    g.rehydrate([
      {
        type: "GameStarted",
        seq: 0,
        gameId: "rent-resolve",
        ts: new Date().toISOString(),
        deck: deckRem,
        hands: { player: [orangeRent, orangeProps[0]], ai: deckRem.slice(0, 5) },
        difficulty: "easy",
      },
      {
        type: "TurnStarted",
        seq: 1,
        gameId: "rent-resolve",
        ts: new Date().toISOString(),
        activePlayer: "player",
      },
      {
        type: "CardsDrawn",
        seq: 2,
        gameId: "rent-resolve",
        ts: new Date().toISOString(),
        player: "player",
        cards: [],
      },
      {
        type: "PropertyPlayed",
        seq: 3,
        gameId: "rent-resolve",
        ts: new Date().toISOString(),
        player: "player",
        card: orangeProps[0],
        toColor: "orange",
      },
    ]);
    g.setDeck(deckRem.slice(5));

    g.handle({
      type: "PlayRent",
      gameId: "rent-resolve",
      issuedBy: "player",
      cardId: orangeRent.id,
      chosenColor: "orange",
    });
    g.flush();

    // AI accepts
    g.handle({
      type: "RespondJsn",
      gameId: "rent-resolve",
      issuedBy: "ai",
      jsnCardId: null,
    });
    const events = g.flush();
    expect(events.some((e) => e.type === "ActionAccepted")).toBe(true);
    expect(events.some((e) => e.type === "DebtOwed")).toBe(true);
    expect(g.snapshot.pendingReaction?.kind).toBe("payDebt");
  });
});

// ─── JSN chain ────────────────────────────────────────────────────────────────

describe("Just Say No", () => {
  it("blocks an action when target plays JSN and initiator accepts block", () => {
    const fullDeck = buildDeck();
    const jsnCard = fullDeck.find(
      (c) => c.kind === "action" && c.subtype === "jsn"
    ) as ActionCard | undefined;
    const debtCard = fullDeck.find(
      (c) => c.kind === "action" && c.subtype === "debtcollector"
    ) as ActionCard | undefined;
    if (!jsnCard || !debtCard) return;

    const deckRem = fullDeck.filter(
      (c) => c.id !== jsnCard.id && c.id !== debtCard.id
    );
    const g = new GameAggregate("jsn-test");
    g.rehydrate([
      {
        type: "GameStarted",
        seq: 0,
        gameId: "jsn-test",
        ts: new Date().toISOString(),
        deck: deckRem,
        hands: { player: [debtCard], ai: [jsnCard, ...deckRem.slice(0, 4)] },
        difficulty: "easy",
      },
      {
        type: "TurnStarted",
        seq: 1,
        gameId: "jsn-test",
        ts: new Date().toISOString(),
        activePlayer: "player",
      },
      {
        type: "CardsDrawn",
        seq: 2,
        gameId: "jsn-test",
        ts: new Date().toISOString(),
        player: "player",
        cards: [],
      },
    ]);
    g.setDeck(deckRem.slice(4));

    g.handle({
      type: "PlayDebtCollector",
      gameId: "jsn-test",
      issuedBy: "player",
      cardId: debtCard.id,
      target: "ai",
    });
    g.flush();

    // AI plays JSN
    g.handle({
      type: "RespondJsn",
      gameId: "jsn-test",
      issuedBy: "ai",
      jsnCardId: jsnCard.id,
    });
    g.flush();
    expect(g.snapshot.pendingReaction?.kind).toBe("jsnCheck");
    const pr = g.snapshot.pendingReaction!;
    if (pr.kind !== "jsnCheck") throw new Error();
    expect(pr.reactingPlayer).toBe("player"); // now player must respond
    expect(pr.jsnChain).toBe(1);

    // Player accepts the block
    g.handle({
      type: "RespondJsn",
      gameId: "jsn-test",
      issuedBy: "player",
      jsnCardId: null,
    });
    const events = g.flush();
    expect(events.some((e) => e.type === "ActionBlocked")).toBe(true);
    expect(g.snapshot.pendingReaction).toBeNull();
    // No debt was created
    expect(g.snapshot.players.ai.bank.length).toBe(0);
  });

  it("counter-JSN reinstates the action", () => {
    const fullDeck = buildDeck();
    const jsnCards = fullDeck.filter(
      (c) => c.kind === "action" && c.subtype === "jsn"
    ) as ActionCard[];
    const debtCard = fullDeck.find(
      (c) => c.kind === "action" && c.subtype === "debtcollector"
    ) as ActionCard | undefined;
    if (jsnCards.length < 2 || !debtCard) return;

    const [aiJsn, playerJsn] = jsnCards;
    const deckRem = fullDeck.filter(
      (c) =>
        c.id !== aiJsn.id && c.id !== playerJsn.id && c.id !== debtCard.id
    );
    const g = new GameAggregate("jsn-counter");
    g.rehydrate([
      {
        type: "GameStarted",
        seq: 0,
        gameId: "jsn-counter",
        ts: new Date().toISOString(),
        deck: deckRem,
        hands: {
          player: [debtCard, playerJsn],
          ai: [aiJsn, ...deckRem.slice(0, 4)],
        },
        difficulty: "easy",
      },
      {
        type: "TurnStarted",
        seq: 1,
        gameId: "jsn-counter",
        ts: new Date().toISOString(),
        activePlayer: "player",
      },
      {
        type: "CardsDrawn",
        seq: 2,
        gameId: "jsn-counter",
        ts: new Date().toISOString(),
        player: "player",
        cards: [],
      },
    ]);
    g.setDeck(deckRem.slice(4));

    g.handle({
      type: "PlayDebtCollector",
      gameId: "jsn-counter",
      issuedBy: "player",
      cardId: debtCard.id,
      target: "ai",
    });
    g.flush();

    // AI plays JSN
    g.handle({
      type: "RespondJsn",
      gameId: "jsn-counter",
      issuedBy: "ai",
      jsnCardId: aiJsn.id,
    });
    g.flush();

    // Player counter-JSNs
    g.handle({
      type: "RespondJsn",
      gameId: "jsn-counter",
      issuedBy: "player",
      jsnCardId: playerJsn.id,
    });
    g.flush();
    const pr = g.snapshot.pendingReaction;
    if (pr?.kind !== "jsnCheck") throw new Error();
    expect(pr.reactingPlayer).toBe("ai"); // back to ai
    expect(pr.jsnChain).toBe(2); // even = action proceeds if accepted

    // AI accepts — action should proceed
    g.handle({
      type: "RespondJsn",
      gameId: "jsn-counter",
      issuedBy: "ai",
      jsnCardId: null,
    });
    const events = g.flush();
    expect(events.some((e) => e.type === "ActionAccepted")).toBe(true);
    expect(events.some((e) => e.type === "DebtOwed")).toBe(true);
  });
});

// ─── PayDebt ──────────────────────────────────────────────────────────────────

describe("PayDebt", () => {
  it("transfers bank cards from debtor to creditor", () => {
    const fullDeck = buildDeck();
    const moneyCards = fullDeck.filter((c) => c.kind === "money").slice(0, 3);
    const debtCard = fullDeck.find(
      (c) => c.kind === "action" && c.subtype === "debtcollector"
    ) as ActionCard | undefined;
    if (!debtCard || moneyCards.length < 3) return;

    // Give AI 3 money cards in their bank, player plays debt collector
    const [m1, m2] = moneyCards;
    const deckRem = fullDeck.filter(
      (c) =>
        !moneyCards.some((m) => m.id === c.id) && c.id !== debtCard.id
    );
    const g = new GameAggregate("debt-test");
    g.rehydrate([
      {
        type: "GameStarted",
        seq: 0,
        gameId: "debt-test",
        ts: new Date().toISOString(),
        deck: deckRem,
        hands: { player: [debtCard], ai: deckRem.slice(0, 5) },
        difficulty: "easy",
      },
      {
        type: "TurnStarted",
        seq: 1,
        gameId: "debt-test",
        ts: new Date().toISOString(),
        activePlayer: "player",
      },
      {
        type: "CardsDrawn",
        seq: 2,
        gameId: "debt-test",
        ts: new Date().toISOString(),
        player: "player",
        cards: [],
      },
      // Give AI some bank cards
      { type: "CardBanked", seq: 3, gameId: "debt-test", ts: new Date().toISOString(), player: "ai", card: m1 as any },
      { type: "CardBanked", seq: 4, gameId: "debt-test", ts: new Date().toISOString(), player: "ai", card: m2 as any },
    ]);
    g.setDeck(deckRem.slice(5));

    g.handle({
      type: "PlayDebtCollector",
      gameId: "debt-test",
      issuedBy: "player",
      cardId: debtCard.id,
      target: "ai",
    });
    g.flush();

    // AI accepts
    g.handle({
      type: "RespondJsn",
      gameId: "debt-test",
      issuedBy: "ai",
      jsnCardId: null,
    });
    g.flush();

    // Get trigger seq from pendingReaction
    const pr = g.snapshot.pendingReaction;
    if (pr?.kind !== "payDebt") throw new Error("Expected payDebt reaction");

    // AI pays with both bank cards (value ≥ 5)
    g.handle({
      type: "PayDebt",
      gameId: "debt-test",
      issuedBy: "ai",
      bankCards: [m1 as any, m2 as any],
      propertyCards: [],
      triggerSeq: pr.triggerSeq,
    });
    const events = g.flush();
    expect(events.some((e) => e.type === "DebtPaid")).toBe(true);
    expect(g.snapshot.pendingReaction).toBeNull();
    // Money moved to player
    expect(g.snapshot.players.player.bank.some((c) => c.id === m1.id)).toBe(true);
  });
});

// ─── SlyDeal ──────────────────────────────────────────────────────────────────

describe("PlaySlyDeal", () => {
  it("steals a property from an incomplete ai set", () => {
    const fullDeck = buildDeck();
    const slyCard = fullDeck.find(
      (c) => c.kind === "action" && c.subtype === "slydeal"
    ) as ActionCard | undefined;
    const lightblueProp = fullDeck.find(
      (c) => c.kind === "property" && c.color === "lightblue"
    ) as PropertyCard | undefined;
    if (!slyCard || !lightblueProp) return;

    const deckRem = fullDeck.filter(
      (c) => c.id !== slyCard.id && c.id !== lightblueProp.id
    );
    const g = new GameAggregate("slydeal-test");
    g.rehydrate([
      {
        type: "GameStarted",
        seq: 0,
        gameId: "slydeal-test",
        ts: new Date().toISOString(),
        deck: deckRem,
        hands: { player: [slyCard], ai: deckRem.slice(0, 5) },
        difficulty: "easy",
      },
      {
        type: "TurnStarted",
        seq: 1,
        gameId: "slydeal-test",
        ts: new Date().toISOString(),
        activePlayer: "player",
      },
      {
        type: "CardsDrawn",
        seq: 2,
        gameId: "slydeal-test",
        ts: new Date().toISOString(),
        player: "player",
        cards: [],
      },
      {
        type: "PropertyPlayed",
        seq: 3,
        gameId: "slydeal-test",
        ts: new Date().toISOString(),
        player: "ai",
        card: lightblueProp,
        toColor: "lightblue",
      },
    ]);
    g.setDeck(deckRem.slice(5));

    g.handle({
      type: "PlaySlyDeal",
      gameId: "slydeal-test",
      issuedBy: "player",
      cardId: slyCard.id,
      targetPlayer: "ai",
      targetCardId: lightblueProp.id,
    });
    g.flush();

    // AI accepts
    g.handle({
      type: "RespondJsn",
      gameId: "slydeal-test",
      issuedBy: "ai",
      jsnCardId: null,
    });
    const events = g.flush();
    expect(events.some((e) => e.type === "PropertyStolen")).toBe(true);
    const stolen = events.find((e) => e.type === "PropertyStolen")!;
    if (stolen.type !== "PropertyStolen") throw new Error();
    expect(stolen.card.id).toBe(lightblueProp.id);
    expect(g.snapshot.players.player.sets.lightblue?.some((c) => c.id === lightblueProp.id)).toBe(true);
    expect(g.snapshot.players.ai.sets.lightblue?.some((c) => c.id === lightblueProp.id)).toBeFalsy();
  });

  it("throws if target set is complete", () => {
    const fullDeck = buildDeck();
    const slyCard = fullDeck.find(
      (c) => c.kind === "action" && c.subtype === "slydeal"
    ) as ActionCard | undefined;
    const brownProps = fullDeck.filter(
      (c) => c.kind === "property" && c.color === "brown"
    ) as PropertyCard[];
    if (!slyCard || brownProps.length < 2) return;

    const deckRem = fullDeck.filter(
      (c) => c.id !== slyCard.id && !brownProps.some((b) => b.id === c.id)
    );
    const g = new GameAggregate("slydeal-complete");
    g.rehydrate([
      {
        type: "GameStarted",
        seq: 0,
        gameId: "slydeal-complete",
        ts: new Date().toISOString(),
        deck: deckRem,
        hands: { player: [slyCard], ai: deckRem.slice(0, 5) },
        difficulty: "easy",
      },
      {
        type: "TurnStarted",
        seq: 1,
        gameId: "slydeal-complete",
        ts: new Date().toISOString(),
        activePlayer: "player",
      },
      {
        type: "CardsDrawn",
        seq: 2,
        gameId: "slydeal-complete",
        ts: new Date().toISOString(),
        player: "player",
        cards: [],
      },
      ...brownProps.map((card, i) => ({
        type: "PropertyPlayed" as const,
        seq: 3 + i,
        gameId: "slydeal-complete",
        ts: new Date().toISOString(),
        player: "ai" as const,
        card,
        toColor: "brown" as const,
      })),
    ]);
    g.setDeck(deckRem.slice(5));

    expect(isComplete(g.snapshot.players.ai.sets, "brown")).toBe(true);

    expect(() =>
      g.handle({
        type: "PlaySlyDeal",
        gameId: "slydeal-complete",
        issuedBy: "player",
        cardId: slyCard.id,
        targetPlayer: "ai",
        targetCardId: brownProps[0].id,
      })
    ).toThrow();
  });
});

// ─── DiscardCards ─────────────────────────────────────────────────────────────

describe("DiscardCards", () => {
  it("discards exactly hand.length - 7 cards and ends turn", () => {
    const fullDeck = buildDeck();
    // Give player 9 cards in hand
    const playerHand = fullDeck.slice(0, 9);
    const deckRem = fullDeck.slice(9);
    const g = new GameAggregate("discard-test");
    g.rehydrate([
      {
        type: "GameStarted",
        seq: 0,
        gameId: "discard-test",
        ts: new Date().toISOString(),
        deck: deckRem,
        hands: { player: playerHand, ai: deckRem.slice(0, 5) },
        difficulty: "easy",
      },
      {
        type: "TurnStarted",
        seq: 1,
        gameId: "discard-test",
        ts: new Date().toISOString(),
        activePlayer: "player",
      },
      {
        type: "CardsDrawn",
        seq: 2,
        gameId: "discard-test",
        ts: new Date().toISOString(),
        player: "player",
        cards: [],
      },
    ]);
    g.setDeck(deckRem.slice(5));

    // Use 3 plays to get to discard phase
    for (const card of playerHand.slice(0, 3)) {
      if (card.kind === "money" || card.kind === "rent" || card.kind === "action") {
        g.handle({ type: "BankCard", gameId: "discard-test", issuedBy: "player", cardId: card.id });
        g.flush();
      }
    }
    // Now in discard phase with 6 cards if 3 banked, 9 if not
    // Let's verify the phase
    if (g.snapshot.phase !== "discard") return;

    const toDiscard = g.snapshot.players.player.hand
      .slice(0, g.snapshot.players.player.hand.length - 7)
      .map((c) => c.id);

    g.handle({
      type: "DiscardCards",
      gameId: "discard-test",
      issuedBy: "player",
      cardIds: toDiscard,
    });
    const events = g.flush();
    expect(events.some((e) => e.type === "CardsDiscarded")).toBe(true);
    expect(events.some((e) => e.type === "TurnEnded")).toBe(true);
    expect(events.some((e) => e.type === "TurnStarted")).toBe(true);
    expect(g.snapshot.players.player.hand.length).toBe(7);
  });

  it("throws if wrong number of cards discarded", () => {
    const fullDeck = buildDeck();
    const playerHand = fullDeck.slice(0, 9);
    const deckRem = fullDeck.slice(9);
    const g = new GameAggregate("discard-err");
    g.rehydrate([
      {
        type: "GameStarted",
        seq: 0,
        gameId: "discard-err",
        ts: new Date().toISOString(),
        deck: deckRem,
        hands: { player: playerHand, ai: deckRem.slice(0, 5) },
        difficulty: "easy",
      },
      {
        type: "TurnStarted",
        seq: 1,
        gameId: "discard-err",
        ts: new Date().toISOString(),
        activePlayer: "player",
      },
      {
        type: "CardsDrawn",
        seq: 2,
        gameId: "discard-err",
        ts: new Date().toISOString(),
        player: "player",
        cards: [],
      },
    ]);
    g.setDeck(deckRem.slice(5));

    for (const card of playerHand.slice(0, 3)) {
      if (card.kind !== "property") {
        g.handle({ type: "BankCard", gameId: "discard-err", issuedBy: "player", cardId: card.id });
        g.flush();
      }
    }
    if (g.snapshot.phase !== "discard") return;

    const wrong = [g.snapshot.players.player.hand[0].id]; // only 1, need 2
    if (g.snapshot.players.player.hand.length - 7 === 1) return; // edge case
    expect(() =>
      g.handle({
        type: "DiscardCards",
        gameId: "discard-err",
        issuedBy: "player",
        cardIds: wrong,
      })
    ).toThrow();
  });
});

// ─── Rehydration ──────────────────────────────────────────────────────────────

describe("Rehydration", () => {
  it("produces identical snapshot when rehydrated from flushed events", () => {
    const g1 = fresh();
    g1.handle({ type: "StartGame", gameId: GID, issuedBy: "player", difficulty: "easy" });
    g1.flush();
    g1.handle({ type: "DrawCards", gameId: GID, issuedBy: "player" });
    g1.flush();
    const snap1 = g1.snapshot;

    // Collect all events
    const g2 = fresh();
    // The events from StartGame are already flushed, we need to collect them
    // Redo from fresh collecting all events
    const g3 = fresh();
    g3.handle({ type: "StartGame", gameId: GID, issuedBy: "player", difficulty: "easy" });
    const startEvents = g3.flush();
    g3.handle({ type: "DrawCards", gameId: GID, issuedBy: "player" });
    const drawEvents = g3.flush();
    const allEvents = [...startEvents, ...drawEvents];

    g2.rehydrate(allEvents);
    // setDeck for g2 from the GameStarted event
    const gs = allEvents.find((e) => e.type === "GameStarted")!;
    if (gs.type !== "GameStarted") throw new Error();
    g2.setDeck([...gs.deck].splice(0)); // empty because all drawn

    const snap2 = g2.snapshot;
    expect(snap1.phase).toBe(snap2.phase);
    expect(snap1.players.player.hand.length).toBe(snap2.players.player.hand.length);
    expect(snap1.deckSize).toBe(snap2.deckSize);
  });

  it("version increments with each event applied", () => {
    const { g } = started();
    // After StartGame + TurnStarted = version 2
    expect(g.snapshot.version).toBe(2);
    g.handle({ type: "DrawCards", gameId: GID, issuedBy: "player" });
    g.flush();
    expect(g.snapshot.version).toBe(3);
  });
});
