import {
  ConcurrencyError,
  type EventStore,
  type GameSummary,
  type StoredEvent
} from "../application/eventStore";
import type { DomainEvent } from "../domain/events";

const DB_NAME = "monopoly-deal-event-store";
const DB_VERSION = 1;
const EVENTS_STORE = "events";
const GAMES_STORE = "games";

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });

export class IndexedDbEventStore implements EventStore {
  private databasePromise: Promise<IDBDatabase> | null = null;

  private database(): Promise<IDBDatabase> {
    if (this.databasePromise) {
      return this.databasePromise;
    }

    if (typeof indexedDB === "undefined") {
      return Promise.reject(new Error("IndexedDB is not available in this environment."));
    }

    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(EVENTS_STORE)) {
          const events = database.createObjectStore(EVENTS_STORE, { keyPath: "id" });
          events.createIndex("byGame", "gameId", { unique: false });
          events.createIndex("byGameSequence", ["gameId", "sequence"], { unique: true });
        }

        if (!database.objectStoreNames.contains(GAMES_STORE)) {
          database.createObjectStore(GAMES_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.databasePromise;
  }

  async appendEvents(
    gameId: string,
    events: readonly DomainEvent[],
    expectedRevision?: number
  ): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const existingEvents = await this.loadEvents(gameId);
    if (expectedRevision !== undefined && existingEvents.length !== expectedRevision) {
      throw new ConcurrencyError(
        `Expected revision ${expectedRevision}, found ${existingEvents.length}.`
      );
    }

    const database = await this.database();
    const transaction = database.transaction([EVENTS_STORE, GAMES_STORE], "readwrite");
    const eventsStore = transaction.objectStore(EVENTS_STORE);
    const gamesStore = transaction.objectStore(GAMES_STORE);
    const now = new Date().toISOString();

    events.forEach((event, index) => {
      const sequence = existingEvents.length + index + 1;
      const record: StoredEvent = {
        id: `${gameId}:${sequence.toString().padStart(8, "0")}`,
        gameId,
        sequence,
        event,
        createdAt: now
      };
      eventsStore.put(record);
    });

    const summary: GameSummary = {
      id: gameId,
      version: existingEvents.length + events.length,
      updatedAt: now
    };
    gamesStore.put(summary);

    await transactionDone(transaction);
  }

  async loadEvents(gameId: string): Promise<DomainEvent[]> {
    const database = await this.database();
    const transaction = database.transaction(EVENTS_STORE, "readonly");
    const store = transaction.objectStore(EVENTS_STORE);
    const index = store.index("byGameSequence");
    const range = IDBKeyRange.bound([gameId, 0], [gameId, Number.MAX_SAFE_INTEGER]);
    const records = await requestToPromise<StoredEvent[]>(index.getAll(range));
    return records.sort((left, right) => left.sequence - right.sequence).map((record) => record.event);
  }

  async listGames(): Promise<GameSummary[]> {
    const database = await this.database();
    const transaction = database.transaction(GAMES_STORE, "readonly");
    const store = transaction.objectStore(GAMES_STORE);
    const games = await requestToPromise<GameSummary[]>(store.getAll());
    return games.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async deleteGame(gameId: string): Promise<void> {
    const events = await this.loadEvents(gameId);
    const database = await this.database();
    const transaction = database.transaction([EVENTS_STORE, GAMES_STORE], "readwrite");
    const eventsStore = transaction.objectStore(EVENTS_STORE);
    const gamesStore = transaction.objectStore(GAMES_STORE);

    events.forEach((_, index) => {
      eventsStore.delete(`${gameId}:${(index + 1).toString().padStart(8, "0")}`);
    });
    gamesStore.delete(gameId);

    await transactionDone(transaction);
  }
}
