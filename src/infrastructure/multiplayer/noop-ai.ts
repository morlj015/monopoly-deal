// Placeholder AI used in multiplayer host: does nothing (human guest plays the "ai" role).
import type { IAIStrategy } from "../ai/ai-strategy.interface";
import type { GameState } from "../../domain/types/game.types";
import type { GameCommand } from "../../domain/commands/game.commands";

export const noopAI: IAIStrategy = {
  difficulty: "medium",
  decide(_state: GameState): GameCommand | null { return null; },
  decideJsn(_state: GameState, _seq: number): GameCommand | null { return null; },
  decideDebt(state: GameState, _amount: number, triggerSeq: number): GameCommand {
    return { type: "PayDebt", gameId: state.gameId, issuedBy: "ai", bankCards: [], propertyCards: [], triggerSeq };
  },
};
