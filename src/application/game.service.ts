import { GameAggregate } from "../domain/aggregates/game.aggregate";
import type { IEventStore } from "../infrastructure/event-store/event-store.interface";
import type { IAIStrategy } from "../infrastructure/ai/ai-strategy.interface";
import type { GameCommand } from "../domain/commands/game.commands";
import type { GameEvent } from "../domain/events/game.events";
import type { GameState } from "../domain/types/game.types";

const AI_THINK_MS = 300;

export class GameService {
  private aggregate: GameAggregate | null = null;
  private gameId: string | null = null;

  constructor(
    private readonly store: IEventStore,
    private readonly aiStrategy: IAIStrategy,
    private readonly onStateChange: (state: GameState) => void
  ) {}

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  async startNewGame(gameId: string, difficulty: "easy" | "medium" | "hard"): Promise<void> {
    this.gameId = gameId;
    this.aggregate = new GameAggregate(gameId);
    await this.exec({ type: "StartGame", gameId, issuedBy: "player", difficulty });
    // In case AI goes first (shouldn't happen but guard anyway)
    if (this.aggregate.snapshot.turn.activePlayer === "ai") {
      setTimeout(() => this.runAITurn(), AI_THINK_MS);
    }
  }

  async loadGame(gameId: string): Promise<void> {
    this.gameId = gameId;
    const events = await this.store.load(gameId);
    if (events.length === 0) throw new Error(`No events found for game ${gameId}`);
    this.aggregate = new GameAggregate(gameId);
    this.aggregate.rehydrate(events);
    const gs = events.find((e): e is Extract<GameEvent, { type: "GameStarted" }> =>
      e.type === "GameStarted"
    );
    if (gs) {
      // Rebuild remaining deck from events
      const drawnIds = new Set<string>();
      for (const e of events) {
        if (e.type === "CardsDrawn") e.cards.forEach((c) => drawnIds.add(c.id));
        if (e.type === "PassGoPlayed") e.drawnCards.forEach((c) => drawnIds.add(c.id));
        if (e.type === "GameStarted") {
          [...e.hands.player, ...e.hands.ai].forEach((c) => drawnIds.add(c.id));
        }
      }
      const remaining = gs.deck.filter((c) => !drawnIds.has(c.id));
      this.aggregate.setDeck(remaining);
    }
    this.emit();
  }

  // ── Player commands ─────────────────────────────────────────────────────────

  async dispatch(cmd: GameCommand): Promise<void> {
    await this.exec(cmd);
    if (this.aggregate && this.aiNeedsToAct(this.aggregate.snapshot)) {
      setTimeout(() => this.runAITurn(), AI_THINK_MS);
    }
  }

  private aiNeedsToAct(s: GameState): boolean {
    if (s.turn.activePlayer === "ai") return true;
    if (s.phase !== "reaction" || !s.pendingReaction) return false;
    const pr = s.pendingReaction;
    return (
      (pr.kind === "jsnCheck" && pr.reactingPlayer === "ai") ||
      (pr.kind === "payDebt" && pr.debtor === "ai") ||
      (pr.kind === "forcedDealGive" && pr.giver === "ai")
    );
  }

  // ── AI turn ─────────────────────────────────────────────────────────────────

  private async runAITurn(): Promise<void> {
    if (!this.aggregate) return;
    const s = this.aggregate.snapshot;
    if (s.phase === "over") return;

    // Handle pending reaction for AI
    if (s.phase === "reaction") {
      const pr = s.pendingReaction;
      if (!pr) return;

      if (pr.kind === "jsnCheck" && pr.reactingPlayer === "ai") {
        const cmd = this.aiStrategy.decideJsn(s, pr.triggerSeq);
        await this.exec(
          cmd ?? {
            type: "RespondJsn",
            gameId: s.gameId,
            issuedBy: "ai",
            jsnCardId: null,
          }
        );
        // Check if still in reaction after JSN
        if (this.aggregate.snapshot.phase === "reaction") {
          setTimeout(() => this.runAITurn(), AI_THINK_MS);
        } else if (this.aggregate.snapshot.turn.activePlayer === "ai") {
          setTimeout(() => this.runAITurn(), AI_THINK_MS);
        }
        return;
      }

      if (pr.kind === "payDebt" && pr.debtor === "ai") {
        const cmd = this.aiStrategy.decideDebt(s, pr.amountOwed, pr.triggerSeq);
        await this.exec(cmd);
        if (this.aggregate.snapshot.turn.activePlayer === "ai") {
          setTimeout(() => this.runAITurn(), AI_THINK_MS);
        }
        return;
      }
      return;
    }

    // Handle discard phase: AI discards cheapest cards down to 7
    if (s.phase === "discard" && s.turn.activePlayer === "ai") {
      const aiHand = [...s.players.ai.hand].sort((a, b) => a.value - b.value);
      const excess = aiHand.length - 7;
      const cardIds = aiHand.slice(0, excess).map(c => c.id);
      if (cardIds.length > 0) {
        await this.exec({ type: "DiscardCards", gameId: s.gameId, issuedBy: "ai", cardIds });
      }
      const next = this.aggregate!.snapshot;
      if (next.phase !== "over" && next.turn.activePlayer === "ai") {
        setTimeout(() => this.runAITurn(), AI_THINK_MS);
      }
      return;
    }

    const cmd = this.aiStrategy.decide(s);
    if (!cmd) return;
    await this.exec(cmd);

    const next = this.aggregate.snapshot;
    if (next.phase === "over") return;
    if (next.turn.activePlayer === "ai") {
      setTimeout(() => this.runAITurn(), AI_THINK_MS);
    }
  }

  // When player needs to respond to AI action (JSN check / debt)
  async respondAsPlayer(cmd: GameCommand): Promise<void> {
    await this.exec(cmd);
    const s = this.aggregate?.snapshot;
    if (s && this.aiNeedsToAct(s)) {
      setTimeout(() => this.runAITurn(), AI_THINK_MS);
    }
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private async exec(cmd: GameCommand): Promise<void> {
    if (!this.aggregate || !this.gameId) throw new Error("No active game");
    const before = this.aggregate.version;
    this.aggregate.handle(cmd);
    const events = this.aggregate.flush();
    if (events.length > 0) {
      await this.store.append(this.gameId, events, before);
    }
    this.emit();
  }

  private emit(): void {
    if (this.aggregate) this.onStateChange(this.aggregate.snapshot);
  }

  get state(): GameState | null {
    return this.aggregate?.snapshot ?? null;
  }
}
