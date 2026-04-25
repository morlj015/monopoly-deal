import { describe, expect, it } from "vitest";
import { MonopolyDealSimulation } from "./simulation";

describe("MCP simulation controller", () => {
  it("creates bot games with selected player counts and strategy lineups", () => {
    const simulation = new MonopolyDealSimulation();

    const state = simulation.newBotGame({
      playerCount: 5,
      lineup: ["builder", "rent-shark"],
      gameId: "mcp-test",
      seed: "mcp-seed"
    });

    expect(state.snapshot.players).toHaveLength(5);
    expect(state.snapshot.players.map((player) => player.botStrategyId)).toEqual([
      "builder",
      "rent-shark",
      "builder",
      "rent-shark",
      "builder"
    ]);
    expect(state.snapshot.deckTotal).toBe(81);
  });

  it("rejects unknown strategy ids instead of silently falling back", () => {
    const simulation = new MonopolyDealSimulation();

    expect(() =>
      simulation.newBotGame({
        lineup: ["missing-strategy"]
      })
    ).toThrow('Unknown bot strategy "missing-strategy".');
  });

  it("steps and runs the current bot simulation", () => {
    const simulation = new MonopolyDealSimulation();
    simulation.newBotGame({ playerCount: 4, gameId: "mcp-run", seed: "mcp-run-seed" });

    const firstStep = simulation.stepBot();
    expect(firstStep.advanced).toBe(true);
    expect(simulation.recentEvents(1).events).toHaveLength(1);

    const run = simulation.runBots({ steps: 40 });
    expect(run.appliedSteps).toBeGreaterThan(0);
    expect(run.state.eventCount).toBeGreaterThan(1);
    expect(["max-steps", "game-complete", "current-player-is-not-bot", "no-bot-events"]).toContain(
      run.stopReason
    );
  });
});
