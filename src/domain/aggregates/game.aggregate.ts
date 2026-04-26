import { AggregateRoot } from "./aggregate-root";
import { buildShuffledDeck } from "../rules/deck.builder";
import { calcRent } from "../rules/rent.calculator";
import { isComplete, hasWon, SET_SIZES } from "../rules/set.rules";
import type { GameEvent, ActionInitiated } from "../events/game.events";
import type { GameCommand } from "../commands/game.commands";
import type {
  Card,
  PropertyCard,
  PropertyColor,
  BankableCard,
} from "../types/card.types";
import type { GameState, GamePhase, PlayerId, PlayerZone, PropertySets } from "../types/game.types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function err(msg: string): never {
  throw new Error(msg);
}

function ts(): string {
  return new Date().toISOString();
}

function findCardInHand(hand: Card[], id: string): Card {
  return hand.find((c) => c.id === id) ?? err(`Card ${id} not in hand`);
}

function bankTotal(bank: BankableCard[]): number {
  return bank.reduce((s, c) => s + c.value, 0);
}

function setTotal(sets: PropertySets): number {
  return (Object.values(sets) as PropertyCard[][]).flat().reduce(
    (s, c) => s + c.value,
    0
  );
}

// ─── Initial state ────────────────────────────────────────────────────────────

function emptyZone(id: PlayerId): PlayerZone {
  return { id, hand: [], bank: [], sets: {}, houses: {}, hotels: {} };
}

function initState(gameId: string): GameState {
  return {
    gameId,
    phase: "idle",
    turn: {
      activePlayer: "player",
      playsLeft: 3,
      hasDrawn: false,
      doubleRentPending: false,
    },
    players: { player: emptyZone("player"), ai: emptyZone("ai") },
    deckSize: 0,
    discardPile: [],
    pendingReaction: null,
    winner: null,
    difficulty: "medium",
    version: 0,
  };
}

// ─── Pure projection ──────────────────────────────────────────────────────────

function phaseAfterPlay(s: GameState): GamePhase {
  if (s.turn.playsLeft > 0) return "action";
  return s.players[s.turn.activePlayer].hand.length > 7 ? "discard" : "action";
}

function applyEvent(state: GameState, event: GameEvent): GameState {
  const s = structuredClone(state) as GameState;
  s.version++;

  switch (event.type) {
    case "GameStarted": {
      s.phase = "draw";
      s.difficulty = event.difficulty;
      s.deckSize = event.deck.length;
      s.players.player.hand = [...event.hands.player];
      s.players.ai.hand = [...event.hands.ai];
      s.turn = {
        activePlayer: "player",
        playsLeft: 3,
        hasDrawn: false,
        doubleRentPending: false,
      };
      break;
    }
    case "TurnStarted": {
      s.phase = "draw";
      s.turn = {
        activePlayer: event.activePlayer,
        playsLeft: 3,
        hasDrawn: false,
        doubleRentPending: false,
      };
      break;
    }
    case "CardsDrawn": {
      s.players[event.player].hand.push(...event.cards);
      s.deckSize -= event.cards.length;
      s.turn.hasDrawn = true;
      s.phase = "action";
      break;
    }
    case "CardBanked": {
      const p = s.players[event.player];
      p.hand = p.hand.filter((c) => c.id !== event.card.id);
      p.bank.push(event.card);
      s.turn.playsLeft--;
      s.phase = phaseAfterPlay(s);
      break;
    }
    case "PropertyPlayed": {
      const p = s.players[event.player];
      p.hand = p.hand.filter((c) => c.id !== event.card.id);
      // Store the card with color = toColor so downstream logic (rent, forced deal checks)
      // always sees the card as belonging to the set it was placed in.
      const placed = { ...event.card, color: event.toColor };
      p.sets[event.toColor] = [...(p.sets[event.toColor] ?? []), placed];
      s.turn.playsLeft--;
      s.phase = phaseAfterPlay(s);
      break;
    }
    case "PassGoPlayed": {
      const p = s.players[event.player];
      const played = p.hand.find((c) => c.id === event.cardId);
      p.hand = p.hand.filter((c) => c.id !== event.cardId);
      p.hand.push(...event.drawnCards);
      s.deckSize -= event.drawnCards.length;
      if (played) s.discardPile.unshift(played);
      s.turn.playsLeft--;
      s.phase = phaseAfterPlay(s);
      break;
    }
    case "DoubleRentStacked": {
      const p = s.players[event.player];
      const played = p.hand.find((c) => c.id === event.cardId);
      p.hand = p.hand.filter((c) => c.id !== event.cardId);
      if (played) s.discardPile.unshift(played);
      s.turn.doubleRentPending = true;
      s.turn.playsLeft--;
      s.phase = phaseAfterPlay(s);
      break;
    }
    case "HousePlayed": {
      const p = s.players[event.player];
      const played = p.hand.find((c) => c.id === event.cardId);
      p.hand = p.hand.filter((c) => c.id !== event.cardId);
      if (played) s.discardPile.unshift(played);
      p.houses[event.color] = true;
      s.turn.playsLeft--;
      s.phase = phaseAfterPlay(s);
      break;
    }
    case "HotelPlayed": {
      const p = s.players[event.player];
      const played = p.hand.find((c) => c.id === event.cardId);
      p.hand = p.hand.filter((c) => c.id !== event.cardId);
      if (played) s.discardPile.unshift(played);
      p.hotels[event.color] = true;
      s.turn.playsLeft--;
      s.phase = phaseAfterPlay(s);
      break;
    }
    case "ActionInitiated": {
      const p = s.players[event.player];
      const played = p.hand.find((c) => c.id === event.cardId);
      p.hand = p.hand.filter((c) => c.id !== event.cardId);
      if (played) s.discardPile.unshift(played);
      s.turn.playsLeft--;
      s.pendingReaction = {
        kind: "jsnCheck",
        reactingPlayer: event.target,
        triggerSeq: event.seq,
        jsnChain: 0,
        actionKind: event.actionKind,
        color: event.color,
        baseAmount: event.baseAmount,
        doubled: event.doubled,
        targetCardId: event.targetCardId,
        offeredCardId: event.offeredCardId,
      };
      s.phase = "reaction";
      break;
    }
    case "JustSayNoPlayed": {
      const p = s.players[event.player];
      const played = p.hand.find((c) => c.id === event.cardId);
      p.hand = p.hand.filter((c) => c.id !== event.cardId);
      if (played) s.discardPile.unshift(played);
      if (s.pendingReaction?.kind === "jsnCheck") {
        const pr = s.pendingReaction;
        const other: PlayerId =
          pr.reactingPlayer === "player" ? "ai" : "player";
        s.pendingReaction = {
          kind: "jsnCheck",
          reactingPlayer: other,
          triggerSeq: pr.triggerSeq,
          jsnChain: event.jsnChain,
          actionKind: pr.actionKind,
          color: pr.color,
          baseAmount: pr.baseAmount,
          doubled: pr.doubled,
          targetCardId: pr.targetCardId,
          offeredCardId: pr.offeredCardId,
        };
      }
      break;
    }
    case "ActionBlocked": {
      s.pendingReaction = null;
      s.phase = phaseAfterPlay(s);
      break;
    }
    case "ActionAccepted": {
      s.pendingReaction = null;
      break;
    }
    case "DebtOwed": {
      s.pendingReaction = {
        kind: "payDebt",
        creditor: event.creditor,
        debtor: event.debtor,
        amountOwed: event.amount,
        triggerSeq: event.seq,
      };
      s.phase = "reaction";
      break;
    }
    case "DebtPaid": {
      const payer = s.players[event.payer];
      const recipient = s.players[event.recipient];
      for (const c of event.cards) {
        if (c.kind === "property") {
          for (const col of Object.keys(payer.sets) as PropertyColor[]) {
            payer.sets[col] = payer.sets[col]?.filter((x) => x.id !== c.id);
            if ((payer.sets[col]?.length ?? 0) === 0) delete payer.sets[col];
          }
          recipient.sets[c.color] = [
            ...(recipient.sets[c.color] ?? []),
            c as PropertyCard,
          ];
        } else {
          payer.bank = payer.bank.filter((b) => b.id !== c.id);
          recipient.bank.push(c as BankableCard);
        }
      }
      s.pendingReaction = null;
      s.phase = phaseAfterPlay(s);
      break;
    }
    case "PropertyStolen": {
      const victim = s.players[event.victim];
      const thief = s.players[event.thief];
      for (const col of Object.keys(victim.sets) as PropertyColor[]) {
        victim.sets[col] = victim.sets[col]?.filter(
          (c) => c.id !== event.card.id
        );
        if ((victim.sets[col]?.length ?? 0) === 0) delete victim.sets[col];
      }
      thief.sets[event.card.color] = [
        ...(thief.sets[event.card.color] ?? []),
        event.card,
      ];
      s.pendingReaction = null;
      s.phase = phaseAfterPlay(s);
      break;
    }
    case "SetStolen": {
      const victim = s.players[event.victim];
      const thief = s.players[event.thief];
      delete victim.sets[event.color];
      delete victim.houses[event.color];
      delete victim.hotels[event.color];
      thief.sets[event.color] = [...event.cards];
      // Transfer house/hotel if any (deal breaker takes the lot)
      if (state.players[event.victim].houses[event.color]) {
        thief.houses[event.color] = true;
      }
      if (state.players[event.victim].hotels[event.color]) {
        thief.hotels[event.color] = true;
      }
      s.pendingReaction = null;
      s.phase = phaseAfterPlay(s);
      break;
    }
    case "CardSwapped": {
      const init = s.players[event.initiator];
      const tgt = s.players[event.target];
      // Remove taken from victim
      for (const col of Object.keys(tgt.sets) as PropertyColor[]) {
        tgt.sets[col] = tgt.sets[col]?.filter((c) => c.id !== event.taken.id);
        if ((tgt.sets[col]?.length ?? 0) === 0) delete tgt.sets[col];
      }
      init.sets[event.taken.color] = [
        ...(init.sets[event.taken.color] ?? []),
        event.taken,
      ];
      // Remove given from initiator
      for (const col of Object.keys(init.sets) as PropertyColor[]) {
        init.sets[col] = init.sets[col]?.filter((c) => c.id !== event.given.id);
        if ((init.sets[col]?.length ?? 0) === 0) delete init.sets[col];
      }
      tgt.sets[event.given.color] = [
        ...(tgt.sets[event.given.color] ?? []),
        event.given,
      ];
      s.pendingReaction = null;
      s.phase = phaseAfterPlay(s);
      break;
    }
    case "PropertyMoved": {
      const p = s.players[event.player];
      p.sets[event.fromColor] = p.sets[event.fromColor]?.filter(c => c.id !== event.card.id);
      if ((p.sets[event.fromColor]?.length ?? 0) === 0) delete p.sets[event.fromColor];
      const moved = { ...event.card, color: event.toColor };
      p.sets[event.toColor] = [...(p.sets[event.toColor] ?? []), moved];
      break;
    }
    case "TurnEnded": {
      break;
    }
    case "CardsDiscarded": {
      const p = s.players[event.player];
      const ids = new Set(event.cards.map((c) => c.id));
      p.hand = p.hand.filter((c) => !ids.has(c.id));
      s.discardPile.unshift(...event.cards);
      break;
    }
    case "GameEnded": {
      s.winner = event.winner;
      s.phase = "over";
      break;
    }
  }

  return s;
}

// ─── Aggregate ────────────────────────────────────────────────────────────────

export class GameAggregate extends AggregateRoot {
  /** Ordered remaining draw pile — maintained in-memory from GameStarted */
  private _deck: Card[] = [];

  /** Lookup from ActionInitiated.seq → event payload for resolution */
  private _pendingActions = new Map<number, ActionInitiated>();

  constructor(gameId: string) {
    super();
    this.state = initState(gameId);
  }

  /** Inject the ordered remaining draw pile (used after rehydration). */
  setDeck(cards: Card[]): void {
    this._deck = [...cards];
  }

  protected apply(event: GameEvent): void {
    this.state = applyEvent(this.state, event);
  }

  protected raise(event: GameEvent): void {
    if (event.type === "ActionInitiated") {
      this._pendingActions.set(event.seq, event);
    }
    super.raise(event);
  }

  rehydrate(events: GameEvent[]): void {
    for (const e of events) {
      if (e.type === "GameStarted") {
        this._deck = [...e.deck];
      }
      if (e.type === "ActionInitiated") {
        this._pendingActions.set(e.seq, e);
      }
      // Remove drawn cards from deck
      if (e.type === "CardsDrawn") {
        this._deck.splice(0, e.cards.length);
      }
      if (e.type === "PassGoPlayed") {
        this._deck.splice(0, e.drawnCards.length);
      }
    }
    super.rehydrate(events);
  }

  private get s(): GameState {
    return this.state;
  }

  private get gid(): string {
    return this.s.gameId;
  }

  private nextSeq(): number {
    return this.s.version;
  }

  private draw(count: number): Card[] {
    return this._deck.splice(0, count);
  }

  // ── Guards ──────────────────────────────────────────────────────────────────

  private phase(...phases: GameState["phase"][]): void {
    if (!phases.includes(this.s.phase)) {
      err(`Expected phase [${phases.join(" | ")}], got "${this.s.phase}"`);
    }
  }

  private myTurn(id: PlayerId): void {
    if (this.s.turn.activePlayer !== id) err(`Not ${id}'s turn`);
  }

  private hasPlays(): void {
    if (this.s.turn.playsLeft <= 0) err("No plays remaining");
  }

  // ── Public handle ───────────────────────────────────────────────────────────

  handle(cmd: GameCommand): void {
    switch (cmd.type) {
      case "StartGame":         return this.cmdStartGame(cmd);
      case "DrawCards":         return this.cmdDrawCards(cmd);
      case "BankCard":          return this.cmdBankCard(cmd);
      case "PlayProperty":      return this.cmdPlayProperty(cmd);
      case "MoveProperty":      return this.cmdMoveProperty(cmd);
      case "PlayPassGo":        return this.cmdPlayPassGo(cmd);
      case "PlayDoubleRent":    return this.cmdPlayDoubleRent(cmd);
      case "PlayRent":          return this.cmdPlayRent(cmd);
      case "PlayBirthday":      return this.cmdPlayBirthday(cmd);
      case "PlayDebtCollector": return this.cmdPlayDebtCollector(cmd);
      case "PlaySlyDeal":       return this.cmdPlaySlyDeal(cmd);
      case "PlayForcedDeal":    return this.cmdPlayForcedDeal(cmd);
      case "PlayDealBreaker":   return this.cmdPlayDealBreaker(cmd);
      case "PlayHouse":         return this.cmdPlayHouse(cmd);
      case "PlayHotel":         return this.cmdPlayHotel(cmd);
      case "RespondJsn":        return this.cmdRespondJsn(cmd);
      case "PayDebt":           return this.cmdPayDebt(cmd);
      case "GiveCard":          return this.cmdGiveCard(cmd);
      case "DiscardCards":      return this.cmdDiscardCards(cmd);
      case "EndTurn":           return this.cmdEndTurn(cmd);
    }
  }

  // ── Commands ────────────────────────────────────────────────────────────────

  private cmdStartGame(cmd: GameCommand & { type: "StartGame" }): void {
    if (this.s.phase !== "idle") err("Game already started");
    const deck = buildShuffledDeck();
    const playerHand = deck.splice(0, 5);
    const aiHand = deck.splice(0, 5);
    this._deck = deck;
    this.raise({
      type: "GameStarted",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      deck: [...deck],
      hands: { player: playerHand, ai: aiHand },
      difficulty: cmd.difficulty,
    });
    this.raise({
      type: "TurnStarted",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      activePlayer: "player",
    });
  }

  private cmdDrawCards(cmd: GameCommand & { type: "DrawCards" }): void {
    this.phase("draw");
    this.myTurn(cmd.issuedBy);
    if (this.s.turn.hasDrawn) err("Already drawn this turn");
    const handSize = this.s.players[cmd.issuedBy].hand.length;
    const count = handSize === 0 ? 5 : 2;
    const cards = this.draw(count);
    this.raise({
      type: "CardsDrawn",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      player: cmd.issuedBy,
      cards,
    });
  }

  private cmdBankCard(cmd: GameCommand & { type: "BankCard" }): void {
    this.phase("action");
    this.myTurn(cmd.issuedBy);
    this.hasPlays();
    const hand = this.s.players[cmd.issuedBy].hand;
    const card = findCardInHand(hand, cmd.cardId);
    if (card.kind === "property") err("Cannot bank a property — play it to the board instead");
    this.raise({
      type: "CardBanked",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      player: cmd.issuedBy,
      card: card as BankableCard,
    });
  }

  private cmdPlayProperty(cmd: GameCommand & { type: "PlayProperty" }): void {
    this.phase("action");
    this.myTurn(cmd.issuedBy);
    this.hasPlays();
    const p = this.s.players[cmd.issuedBy];
    const card = findCardInHand(p.hand, cmd.cardId);
    if (card.kind !== "property") err("Not a property card");
    const validColors = card.colors ?? [card.color];
    if (!validColors.includes(cmd.toColor)) err("This card cannot be placed in that colour set");
    const existing = p.sets[cmd.toColor] ?? [];
    if (existing.length >= SET_SIZES[cmd.toColor]) err("That set is already complete");
    this.raise({
      type: "PropertyPlayed",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      player: cmd.issuedBy,
      card,
      toColor: cmd.toColor,
    });
    if (hasWon(this.s.players[cmd.issuedBy].sets)) {
      this.raise({
        type: "GameEnded",
        seq: this.nextSeq(),
        gameId: this.gid,
        ts: ts(),
        winner: cmd.issuedBy,
      });
    }
  }

  private cmdMoveProperty(cmd: GameCommand & { type: "MoveProperty" }): void {
    this.phase("action");
    this.myTurn(cmd.issuedBy);
    const p = this.s.players[cmd.issuedBy];
    const card = (Object.values(p.sets) as PropertyCard[][])
      .flat()
      .find(c => c.id === cmd.cardId);
    if (!card) err("Card not in your sets");
    const validColors = card.colors ?? [card.color];
    if (!validColors.includes(cmd.toColor)) err("Card cannot be placed in that colour");
    if (card.color === cmd.toColor) err("Card is already in that colour set");
    if (isComplete(p.sets, card.color)) err("Cannot move a card from a complete set");
    if ((p.sets[cmd.toColor]?.length ?? 0) >= SET_SIZES[cmd.toColor]) err("Destination set is already complete");
    this.raise({
      type: "PropertyMoved",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      player: cmd.issuedBy,
      card,
      fromColor: card.color,
      toColor: cmd.toColor,
    });
  }

  private cmdPlayPassGo(cmd: GameCommand & { type: "PlayPassGo" }): void {
    this.phase("action");
    this.myTurn(cmd.issuedBy);
    this.hasPlays();
    const card = findCardInHand(this.s.players[cmd.issuedBy].hand, cmd.cardId);
    if (card.kind !== "action" || card.subtype !== "passgo") err("Not a Pass Go card");
    const drawn = this.draw(2);
    this.raise({
      type: "PassGoPlayed",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      player: cmd.issuedBy,
      cardId: cmd.cardId,
      drawnCards: drawn,
    });
  }

  private cmdPlayDoubleRent(cmd: GameCommand & { type: "PlayDoubleRent" }): void {
    this.phase("action");
    this.myTurn(cmd.issuedBy);
    this.hasPlays();
    const card = findCardInHand(this.s.players[cmd.issuedBy].hand, cmd.cardId);
    if (card.kind !== "action" || card.subtype !== "doublerent") err("Not a Double Rent card");
    if (this.s.turn.doubleRentPending) err("Double Rent already stacked");
    this.raise({
      type: "DoubleRentStacked",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      player: cmd.issuedBy,
      cardId: cmd.cardId,
    });
  }

  private cmdPlayRent(cmd: GameCommand & { type: "PlayRent" }): void {
    this.phase("action");
    this.myTurn(cmd.issuedBy);
    this.hasPlays();
    const p = this.s.players[cmd.issuedBy];
    const card = findCardInHand(p.hand, cmd.cardId);
    if (card.kind !== "rent") err("Not a rent card");
    if (!card.isWild && !card.colors.includes(cmd.chosenColor)) {
      err(`Rent card does not cover color ${cmd.chosenColor}`);
    }
    if (!(p.sets[cmd.chosenColor]?.length)) err("You have no properties of that color");
    const target: PlayerId = cmd.issuedBy === "player" ? "ai" : "player";
    const amount = calcRent(
      p.sets,
      cmd.chosenColor,
      this.s.turn.doubleRentPending,
      p.houses,
      p.hotels
    );
    this.raise({
      type: "ActionInitiated",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      player: cmd.issuedBy,
      cardId: cmd.cardId,
      actionKind: "rent",
      target,
      color: cmd.chosenColor,
      baseAmount: amount,
      doubled: this.s.turn.doubleRentPending,
    });
  }

  private cmdPlayBirthday(cmd: GameCommand & { type: "PlayBirthday" }): void {
    this.phase("action");
    this.myTurn(cmd.issuedBy);
    this.hasPlays();
    const card = findCardInHand(this.s.players[cmd.issuedBy].hand, cmd.cardId);
    if (card.kind !== "action" || card.subtype !== "birthday") err("Not a Birthday card");
    const target: PlayerId = cmd.issuedBy === "player" ? "ai" : "player";
    this.raise({
      type: "ActionInitiated",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      player: cmd.issuedBy,
      cardId: cmd.cardId,
      actionKind: "birthday",
      target,
      baseAmount: 2,
      doubled: false,
    });
  }

  private cmdPlayDebtCollector(
    cmd: GameCommand & { type: "PlayDebtCollector" }
  ): void {
    this.phase("action");
    this.myTurn(cmd.issuedBy);
    this.hasPlays();
    const card = findCardInHand(this.s.players[cmd.issuedBy].hand, cmd.cardId);
    if (card.kind !== "action" || card.subtype !== "debtcollector") {
      err("Not a Debt Collector card");
    }
    this.raise({
      type: "ActionInitiated",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      player: cmd.issuedBy,
      cardId: cmd.cardId,
      actionKind: "debtcollector",
      target: cmd.target,
      baseAmount: 5,
      doubled: false,
    });
  }

  private cmdPlaySlyDeal(cmd: GameCommand & { type: "PlaySlyDeal" }): void {
    this.phase("action");
    this.myTurn(cmd.issuedBy);
    this.hasPlays();
    const card = findCardInHand(this.s.players[cmd.issuedBy].hand, cmd.cardId);
    if (card.kind !== "action" || card.subtype !== "slydeal") err("Not a Sly Deal");
    const victim = this.s.players[cmd.targetPlayer];
    const tgt = (Object.values(victim.sets) as PropertyCard[][])
      .flat()
      .find((c) => c.id === cmd.targetCardId);
    if (!tgt) err("Target card not in victim's sets");
    if (isComplete(victim.sets, tgt.color)) err("Cannot Sly Deal from a complete set");
    this.raise({
      type: "ActionInitiated",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      player: cmd.issuedBy,
      cardId: cmd.cardId,
      actionKind: "slydeal",
      target: cmd.targetPlayer,
      targetCardId: cmd.targetCardId,
      doubled: false,
    });
  }

  private cmdPlayForcedDeal(cmd: GameCommand & { type: "PlayForcedDeal" }): void {
    this.phase("action");
    this.myTurn(cmd.issuedBy);
    this.hasPlays();
    const initiator = this.s.players[cmd.issuedBy];
    const card = findCardInHand(initiator.hand, cmd.cardId);
    if (card.kind !== "action" || card.subtype !== "forceddeal") err("Not a Forced Deal");
    const victim = this.s.players[cmd.targetPlayer];
    const tgt = (Object.values(victim.sets) as PropertyCard[][])
      .flat()
      .find((c) => c.id === cmd.targetCardId);
    if (!tgt) err("Target card not in victim's sets");
    if (isComplete(victim.sets, tgt.color)) err("Cannot Forced Deal from a complete set");
    const offered = (Object.values(initiator.sets) as PropertyCard[][])
      .flat()
      .find((c) => c.id === cmd.offeredCardId);
    if (!offered) err("Offered card not in your sets");
    if (isComplete(initiator.sets, offered.color)) {
      err("Cannot Forced Deal away a card from a complete set");
    }
    this.raise({
      type: "ActionInitiated",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      player: cmd.issuedBy,
      cardId: cmd.cardId,
      actionKind: "forceddeal",
      target: cmd.targetPlayer,
      targetCardId: cmd.targetCardId,
      offeredCardId: cmd.offeredCardId,
      doubled: false,
    });
  }

  private cmdPlayDealBreaker(cmd: GameCommand & { type: "PlayDealBreaker" }): void {
    this.phase("action");
    this.myTurn(cmd.issuedBy);
    this.hasPlays();
    const card = findCardInHand(this.s.players[cmd.issuedBy].hand, cmd.cardId);
    if (card.kind !== "action" || card.subtype !== "dealbreaker") err("Not a Deal Breaker");
    const victim = this.s.players[cmd.targetPlayer];
    if (!isComplete(victim.sets, cmd.targetColor)) err("Target set is not complete");
    this.raise({
      type: "ActionInitiated",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      player: cmd.issuedBy,
      cardId: cmd.cardId,
      actionKind: "dealbreaker",
      target: cmd.targetPlayer,
      color: cmd.targetColor,
      doubled: false,
    });
  }

  private cmdPlayHouse(cmd: GameCommand & { type: "PlayHouse" }): void {
    this.phase("action");
    this.myTurn(cmd.issuedBy);
    this.hasPlays();
    const p = this.s.players[cmd.issuedBy];
    const card = findCardInHand(p.hand, cmd.cardId);
    if (card.kind !== "action" || card.subtype !== "house") err("Not a House card");
    if (!isComplete(p.sets, cmd.targetColor)) err("Set must be complete to place a House");
    if (p.houses[cmd.targetColor]) err("Set already has a House");
    this.raise({
      type: "HousePlayed",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      player: cmd.issuedBy,
      cardId: cmd.cardId,
      color: cmd.targetColor,
    });
  }

  private cmdPlayHotel(cmd: GameCommand & { type: "PlayHotel" }): void {
    this.phase("action");
    this.myTurn(cmd.issuedBy);
    this.hasPlays();
    const p = this.s.players[cmd.issuedBy];
    const card = findCardInHand(p.hand, cmd.cardId);
    if (card.kind !== "action" || card.subtype !== "hotel") err("Not a Hotel card");
    if (!isComplete(p.sets, cmd.targetColor)) err("Set must be complete to place a Hotel");
    if (!p.houses[cmd.targetColor]) err("Must place a House before a Hotel");
    if (p.hotels[cmd.targetColor]) err("Set already has a Hotel");
    this.raise({
      type: "HotelPlayed",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      player: cmd.issuedBy,
      cardId: cmd.cardId,
      color: cmd.targetColor,
    });
  }

  private cmdRespondJsn(cmd: GameCommand & { type: "RespondJsn" }): void {
    this.phase("reaction");
    const pr = this.s.pendingReaction;
    if (pr?.kind !== "jsnCheck") err("No JSN check pending");
    if (pr.reactingPlayer !== cmd.issuedBy) {
      err(`Waiting for ${pr.reactingPlayer} to respond`);
    }

    if (cmd.jsnCardId === null) {
      // Accept
      const blocked = pr.jsnChain % 2 === 1;
      if (blocked) {
        this.raise({
          type: "ActionBlocked",
          seq: this.nextSeq(),
          gameId: this.gid,
          ts: ts(),
          triggerSeq: pr.triggerSeq,
        });
      } else {
        this.raise({
          type: "ActionAccepted",
          seq: this.nextSeq(),
          gameId: this.gid,
          ts: ts(),
          triggerSeq: pr.triggerSeq,
        });
        this.resolveAction(pr.triggerSeq);
      }
    } else {
      const hand = this.s.players[cmd.issuedBy].hand;
      const jsnCard = findCardInHand(hand, cmd.jsnCardId);
      if (jsnCard.kind !== "action" || jsnCard.subtype !== "jsn") {
        err("That is not a Just Say No card");
      }
      this.raise({
        type: "JustSayNoPlayed",
        seq: this.nextSeq(),
        gameId: this.gid,
        ts: ts(),
        player: cmd.issuedBy,
        cardId: cmd.jsnCardId,
        jsnChain: pr.jsnChain + 1,
      });
    }
  }

  private resolveAction(triggerSeq: number): void {
    const action = this._pendingActions.get(triggerSeq);
    if (!action) err(`No action found at seq ${triggerSeq}`);

    switch (action.actionKind) {
      case "rent":
      case "birthday":
      case "debtcollector": {
        this.raise({
          type: "DebtOwed",
          seq: this.nextSeq(),
          gameId: this.gid,
          ts: ts(),
          creditor: action.player,
          debtor: action.target,
          amount: action.baseAmount ?? 0,
        });
        break;
      }
      case "slydeal": {
        const victim = this.s.players[action.target];
        const card = (Object.values(victim.sets) as PropertyCard[][])
          .flat()
          .find((c) => c.id === action.targetCardId);
        if (!card) err("Target card no longer in victim's sets");
        this.raise({
          type: "PropertyStolen",
          seq: this.nextSeq(),
          gameId: this.gid,
          ts: ts(),
          thief: action.player,
          victim: action.target,
          card,
        });
        if (hasWon(this.s.players[action.player].sets)) {
          this.raise({
            type: "GameEnded",
            seq: this.nextSeq(),
            gameId: this.gid,
            ts: ts(),
            winner: action.player,
          });
        }
        break;
      }
      case "forceddeal": {
        const victim = this.s.players[action.target];
        const taken = (Object.values(victim.sets) as PropertyCard[][])
          .flat()
          .find((c) => c.id === action.targetCardId);
        if (!taken) err("Target card no longer in victim's sets");
        const initiatorP = this.s.players[action.player];
        const given = (Object.values(initiatorP.sets) as PropertyCard[][])
          .flat()
          .find((c) => c.id === action.offeredCardId);
        if (!given) err("Offered card no longer in initiator's sets");
        this.raise({
          type: "CardSwapped",
          seq: this.nextSeq(),
          gameId: this.gid,
          ts: ts(),
          initiator: action.player,
          target: action.target,
          taken,
          given,
        });
        if (hasWon(this.s.players[action.player].sets)) {
          this.raise({
            type: "GameEnded",
            seq: this.nextSeq(),
            gameId: this.gid,
            ts: ts(),
            winner: action.player,
          });
        }
        break;
      }
      case "dealbreaker": {
        const color = action.color!;
        const victim = this.s.players[action.target];
        const cards = (victim.sets[color] ?? []) as PropertyCard[];
        this.raise({
          type: "SetStolen",
          seq: this.nextSeq(),
          gameId: this.gid,
          ts: ts(),
          thief: action.player,
          victim: action.target,
          color,
          cards,
        });
        if (hasWon(this.s.players[action.player].sets)) {
          this.raise({
            type: "GameEnded",
            seq: this.nextSeq(),
            gameId: this.gid,
            ts: ts(),
            winner: action.player,
          });
        }
        break;
      }
    }
  }

  private cmdPayDebt(cmd: GameCommand & { type: "PayDebt" }): void {
    this.phase("reaction");
    const pr = this.s.pendingReaction;
    if (pr?.kind !== "payDebt") err("No debt pending");
    if (pr.debtor !== cmd.issuedBy) err("Not your debt");
    if (cmd.triggerSeq !== pr.triggerSeq) err("Debt trigger seq mismatch");

    const p = this.s.players[cmd.issuedBy];
    let paid = 0;
    for (const c of cmd.bankCards) {
      const serverCard = p.bank.find((b) => b.id === c.id);
      if (!serverCard) err(`Bank card ${c.id} not yours`);
      paid += serverCard.value;
    }
    const allProperties = (Object.values(p.sets) as PropertyCard[][]).flat();
    for (const c of cmd.propertyCards) {
      const serverCard = allProperties.find((x) => x.id === c.id);
      if (!serverCard) err(`Property ${c.id} not in your sets`);
      paid += serverCard.value;
    }
    const owns = bankTotal(p.bank) + setTotal(p.sets);
    if (paid < pr.amountOwed && paid < owns) {
      err("Must pay the full amount (or everything you have if broke)");
    }
    this.raise({
      type: "DebtPaid",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      payer: cmd.issuedBy,
      recipient: pr.creditor,
      cards: [...cmd.bankCards, ...cmd.propertyCards],
      totalValue: paid,
    });
  }

  // GiveCard is handled automatically inside ForcedDeal resolution
  private cmdGiveCard(_cmd: GameCommand & { type: "GiveCard" }): void {
    err("GiveCard is resolved automatically — use PlayForcedDeal instead");
  }

  private cmdDiscardCards(cmd: GameCommand & { type: "DiscardCards" }): void {
    this.phase("discard");
    this.myTurn(cmd.issuedBy);
    const p = this.s.players[cmd.issuedBy];
    if (p.hand.length <= 7) err("Hand is already ≤ 7 cards");
    const needed = p.hand.length - 7;
    if (cmd.cardIds.length !== needed) {
      err(`Must discard exactly ${needed} card${needed !== 1 ? "s" : ""}`);
    }
    const cards = cmd.cardIds.map((id) => findCardInHand(p.hand, id));
    this.raise({
      type: "CardsDiscarded",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      player: cmd.issuedBy,
      cards,
    });
    this.endTurnAndAdvance(cmd.issuedBy);
  }

  private cmdEndTurn(cmd: GameCommand & { type: "EndTurn" }): void {
    this.phase("action");
    this.myTurn(cmd.issuedBy);
    const hand = this.s.players[cmd.issuedBy].hand;
    if (hand.length > 7) err("Discard to 7 before ending your turn");
    this.endTurnAndAdvance(cmd.issuedBy);
  }

  private endTurnAndAdvance(player: PlayerId): void {
    this.raise({
      type: "TurnEnded",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      player,
    });
    const next: PlayerId = player === "player" ? "ai" : "player";
    this.raise({
      type: "TurnStarted",
      seq: this.nextSeq(),
      gameId: this.gid,
      ts: ts(),
      activePlayer: next,
    });
  }
}

// Re-export applyEvent for the projection module
export { applyEvent };
