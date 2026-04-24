import { startGame } from "../domain/commands";
import type { DomainEvent, PlayerConfig } from "../domain/events";
import type { BotDifficulty } from "../domain/bot";

export const HUMAN_PLAYER_ID = "player";
export const BOT_PLAYER_ID = "dealer";

export const playersForDifficulty = (difficulty: BotDifficulty): PlayerConfig[] => [
  { id: HUMAN_PLAYER_ID, name: "You", role: "human" },
  {
    id: BOT_PLAYER_ID,
    name:
      difficulty === "easy"
        ? "Easy Dealer"
        : difficulty === "medium"
          ? "Sharp Dealer"
          : "Ruthless Dealer",
    role: "bot"
  }
];

const botNames = ["Atlas", "Blitz", "Copper", "Delta", "Echo"];

export const botPlayers = (
  count: number,
  difficulty: BotDifficulty
): PlayerConfig[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `bot-${index + 1}`,
    name: `${botNames[index] ?? `Bot ${index + 1}`} ${difficulty}`,
    role: "bot"
  }));

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
  difficulty: BotDifficulty,
  gameId = createGameId(),
  seed = createSeed()
): DomainEvent[] =>
  startGame({
    gameId,
    seed,
    players: botPlayers(playerCount, difficulty)
  });
