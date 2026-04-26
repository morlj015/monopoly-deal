import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { v4 as uuid } from "uuid";
import { GameService } from "./game.service";
import { IdbEventStore } from "../infrastructure/event-store/idb-event-store";
import { mediumStrategy } from "../infrastructure/ai/medium.strategy";
import type { GameState, Difficulty } from "../domain/types/game.types";
import type { GameCommand } from "../domain/commands/game.commands";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type CmdPartial = DistributiveOmit<GameCommand, "gameId" | "issuedBy">;

interface GameCtx {
  state: GameState | null;
  startGame: (difficulty: Difficulty) => Promise<void>;
  dispatch: (cmd: CmdPartial) => Promise<void>;
}

const Ctx = createContext<GameCtx | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState | null>(null);

  const service = useMemo(() => {
    const store = new IdbEventStore();
    return new GameService(store, mediumStrategy, setState);
  }, []);

  const startGame = useCallback(
    async (difficulty: Difficulty) => {
      const gameId = uuid();
      await service.startNewGame(gameId, difficulty);
    },
    [service]
  );

  const dispatch = useCallback(
    async (partial: CmdPartial) => {
      if (!service.state) throw new Error("No active game");
      const cmd = {
        ...partial,
        gameId: service.state.gameId,
        issuedBy: "player",
      } as GameCommand;
      if (service.state.phase === "reaction") {
        await service.respondAsPlayer(cmd);
      } else {
        await service.dispatch(cmd);
      }
    },
    [service]
  );

  return (
    <Ctx.Provider value={{ state, startGame, dispatch }}>
      {children}
    </Ctx.Provider>
  );
}

export function useGame(): GameCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGame must be used inside <GameProvider>");
  return ctx;
}
