import type { GameEvent } from "../../domain/events/game.events";

export interface AppendResult {
  readonly storedCount: number;
  readonly newVersion: number;
}

export class ConcurrencyError extends Error {
  constructor(
    public readonly streamId: string,
    public readonly expected: number,
    public readonly actual: number
  ) {
    super(
      `Stream "${streamId}": expected version ${expected}, found ${actual}`
    );
    this.name = "ConcurrencyError";
  }
}

export interface IEventStore {
  append(
    streamId: string,
    events: GameEvent[],
    expectedVersion?: number
  ): Promise<AppendResult>;

  load(streamId: string): Promise<GameEvent[]>;

  loadFrom(streamId: string, afterSeq: number): Promise<GameEvent[]>;

  listStreams(): Promise<string[]>;

  deleteStream(streamId: string): Promise<void>;
}
