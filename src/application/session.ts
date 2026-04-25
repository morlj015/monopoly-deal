import { startGame } from "../domain/commands";
import type { DomainEvent, PlayerConfig } from "../domain/events";
import {
  COMPETITION_BOT_STRATEGY_IDS,
  getBotStrategy,
  type BotDifficulty,
  type BotStrategyId
} from "../domain/bot";

export const HUMAN_PLAYER_ID = "player";
export const BOT_PLAYER_ID = "dealer";

export type BotLineup = BotStrategyId | readonly BotStrategyId[];

export const playersForDifficulty = (difficulty: BotDifficulty): PlayerConfig[] => {
  const strategy = getBotStrategy(difficulty);
  return [
    { id: HUMAN_PLAYER_ID, name: "You", role: "human" },
    {
      id: BOT_PLAYER_ID,
      name: `${strategy.name} Dealer`,
      role: "bot",
      botStrategyId: strategy.id
    }
  ];
};

const botNames = ["Atlas", "Blitz", "Copper", "Delta", "Echo"];

const normalizeLineup = (lineup: BotLineup = COMPETITION_BOT_STRATEGY_IDS): readonly BotStrategyId[] => {
  if (typeof lineup === "string") {
    return [lineup];
  }
  return lineup.length > 0 ? lineup : [getBotStrategy().id];
};

export const botPlayers = (
  count: number,
  lineup: BotLineup = COMPETITION_BOT_STRATEGY_IDS
): PlayerConfig[] => {
  const strategyIds = normalizeLineup(lineup);
  return Array.from({ length: count }, (_, index) => {
    const strategy = getBotStrategy(strategyIds[index % strategyIds.length]);
    return {
      id: `bot-${index + 1}`,
      name: `${botNames[index] ?? `Bot ${index + 1}`} ${strategy.name}`,
      role: "bot",
      botStrategyId: strategy.id
    };
  });
};

export const createGameId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `game-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createSeed = (): string =>
  `seed-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const createNewGameEvents = (
  difficulty: BotDifficulty,
  gameId = createGameId(),
  seed = createSeed()
): DomainEvent[] =>
  startGame({
    gameId,
    seed,
    players: playersForDifficulty(difficulty)
  });

export const createBotGameEvents = (
  playerCount: number,
  lineup: BotLineup = COMPETITION_BOT_STRATEGY_IDS,
  gameId = createGameId(),
  seed = createSeed()
): DomainEvent[] =>
  startGame({
    gameId,
    seed,
    players: botPlayers(playerCount, lineup)
  });
