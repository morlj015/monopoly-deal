import { createBotGameEvents, createGameId, createNewGameEvents, createSeed } from "../application/session";
import {
  chooseBotEvents,
  listBotStrategies,
  type BotDifficulty,
  type BotStrategyId
} from "../domain/bot";
import type { Card } from "../domain/cards";
import type { DomainEvent } from "../domain/events";
import { assertGameInvariants } from "../domain/invariants";
import { buildSnapshot } from "../domain/snapshot";
import { applyEvents, projectEvents, type GameState } from "../domain/state";

export interface NewBotGameInput {
  playerCount?: number;
  lineup?: string[];
  gameId?: string;
  seed?: string;
}

export interface NewHumanGameInput {
  dealerStrategyId?: string;
  gameId?: string;
  seed?: string;
}

export interface StateViewInput {
  includeHands?: boolean;
}

export interface StepInput {
  steps?: number;
}

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 5;

const cardView = (card: Card) => ({
  id: card.id,
  name: card.name,
  kind: card.kind,
  value: card.value
});

const assertKnownStrategy = (strategyId: string): BotStrategyId => {
  const strategy = listBotStrategies().find((candidate) => candidate.id === strategyId);
  if (!strategy) {
    throw new Error(`Unknown bot strategy "${strategyId}".`);
  }
  return strategy.id;
};

const difficultyFor = (strategyId: string): BotDifficulty => {
  const known = assertKnownStrategy(strategyId);
  if (known === "easy" || known === "medium" || known === "hard") {
    return known as BotDifficulty;
  }
  throw new Error("Human games need an easy, medium, or hard dealer strategy.");
};

export class MonopolyDealSimulation {
  private events: DomainEvent[] = [];
  private state: GameState = projectEvents([]);
  private updatedAt = new Date().toISOString();

  constructor() {
    this.newBotGame({});
  }

  strategies() {
    return listBotStrategies().map((strategy) => ({
      id: strategy.id,
      name: strategy.name,
      description: strategy.description
    }));
  }

  newBotGame({
    playerCount = 4,
    lineup,
    gameId = createGameId(),
    seed = createSeed()
  }: NewBotGameInput) {
    if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
      throw new Error("Bot games need between 2 and 5 players.");
    }

    const strategyLineup = lineup?.map(assertKnownStrategy);
    this.reset(
      createBotGameEvents(playerCount, strategyLineup, gameId, seed)
    );
    return this.view({ includeHands: true });
  }

  newHumanGame({
    dealerStrategyId = "medium",
    gameId = createGameId(),
    seed = createSeed()
  }: NewHumanGameInput) {
    this.reset(createNewGameEvents(difficultyFor(dealerStrategyId), gameId, seed));
    return this.view({ includeHands: true });
  }

  view({ includeHands = false }: StateViewInput = {}) {
    return {
      updatedAt: this.updatedAt,
      eventCount: this.events.length,
      snapshot: buildSnapshot(this.state),
      turn: {
        currentPlayer: this.state.currentTurn,
        playsRemaining: this.state.playsRemaining,
        mustDraw: this.state.mustDraw
      },
      log: this.state.log,
      players: this.state.playerOrder.map((playerId) => {
        const player = this.state.players[playerId];
        return {
          id: player.id,
          name: player.name,
          role: player.role,
          botStrategyId: player.botStrategyId,
          hand: includeHands ? player.hand.map(cardView) : undefined,
          bank: player.bank.map(cardView),
          sets: Object.fromEntries(
            Object.entries(player.sets).map(([color, stack]) => [
              color,
              {
                properties: stack.properties.map(cardView),
                improvements: stack.improvements.map(cardView)
              }
            ])
          )
        };
      })
    };
  }

  recentEvents(limit = 20) {
    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    return {
      total: this.events.length,
      events: this.events.slice(-safeLimit)
    };
  }

  stepBot() {
    if (this.state.status !== "active") {
      return {
        advanced: false,
        stopReason: "game-complete",
        state: this.view()
      };
    }

    const playerId = this.state.currentTurn;
    if (!playerId || this.state.players[playerId]?.role !== "bot") {
      return {
        advanced: false,
        stopReason: "current-player-is-not-bot",
        state: this.view({ includeHands: true })
      };
    }

    const events = chooseBotEvents(this.state, playerId);
    if (!events || events.length === 0) {
      return {
        advanced: false,
        stopReason: "no-bot-events",
        state: this.view({ includeHands: true })
      };
    }

    this.append(events);
    return {
      advanced: true,
      stopReason: null,
      appliedEvents: events,
      state: this.view()
    };
  }

  runBots({ steps = 50 }: StepInput = {}) {
    const maxSteps = Math.max(1, Math.min(5000, Math.floor(steps)));
    let stopReason = "max-steps";
    let appliedSteps = 0;

    for (let index = 0; index < maxSteps; index += 1) {
      const result = this.stepBot();
      if (!result.advanced) {
        stopReason = result.stopReason ?? "unknown";
        break;
      }
      appliedSteps += 1;
      if (this.state.status !== "active") {
        stopReason = "game-complete";
        break;
      }
    }

    return {
      appliedSteps,
      stopReason,
      state: this.view()
    };
  }

  private reset(events: DomainEvent[]) {
    this.events = [...events];
    this.state = projectEvents(events);
    assertGameInvariants(this.state);
    this.touch();
  }

  private append(events: DomainEvent[]) {
    const nextState = applyEvents(this.state, events);
    assertGameInvariants(nextState);
    this.state = nextState;
    this.events = [...this.events, ...events];
    this.touch();
  }

  private touch() {
    this.updatedAt = new Date().toISOString();
  }
}
