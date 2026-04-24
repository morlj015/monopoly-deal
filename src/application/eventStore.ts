import type { DomainEvent } from "../domain/events";

export interface StoredEvent {
  id: string;
  gameId: string;
  sequence: number;
  event: DomainEvent;
  createdAt: string;
}

export interface GameSummary {
  id: string;
  version: number;
  updatedAt: string;
}

export interface EventStore {
  appendEvents(
    gameId: string,
    events: readonly DomainEvent[],
    expectedRevision?: number
  ): Promise<void>;
  loadEvents(gameId: string): Promise<DomainEvent[]>;
  listGames(): Promise<GameSummary[]>;
  deleteGame(gameId: string): Promise<void>;
}

export class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConcurrencyError";
  }
}
