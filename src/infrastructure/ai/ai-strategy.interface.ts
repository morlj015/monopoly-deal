import type { GameState, Difficulty } from "../../domain/types/game.types";
import type { GameCommand } from "../../domain/commands/game.commands";

export interface IAIStrategy {
  readonly difficulty: Difficulty;
  decide(state: GameState): GameCommand | null;
  decideJsn(state: GameState, triggerSeq: number): GameCommand | null;
  decideDebt(state: GameState, amountOwed: number, triggerSeq: number): GameCommand;
}
