import { describe, expect, it } from "vitest";
import {
  COMPETITION_BOT_STRATEGY_IDS,
  getBotStrategy
} from "../domain/bot";
import { botPlayers, createBotGameEvents, playersForDifficulty } from "./session";

describe("session bot lineups", () => {
  it("tags a human-game dealer with the selected strategy plugin", () => {
    const players = playersForDifficulty("hard");
    const dealer = players[1];

    expect(dealer).toMatchObject({
      id: "dealer",
      name: `${getBotStrategy("hard").name} Dealer`,
      role: "bot",
      botStrategyId: "hard"
    });
  });

  it("creates mixed competition bot tables by default", () => {
    const players = botPlayers(4);

    expect(players.map((player) => player.botStrategyId)).toEqual([
      ...COMPETITION_BOT_STRATEGY_IDS
    ]);
    expect(new Set(players.map((player) => player.name)).size).toBe(4);
  });

  it("persists bot strategy ids into new self-play game events", () => {
    const events = createBotGameEvents(4, ["builder", "rent-shark"], "game", "seed");
    const started = events[0];

    expect(started.type).toBe("GameStarted");
    if (started.type !== "GameStarted") {
      return;
    }
    expect(started.players.map((player) => player.botStrategyId)).toEqual([
      "builder",
      "rent-shark",
      "builder",
      "rent-shark"
    ]);
  });
});
