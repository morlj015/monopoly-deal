import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { GameEvent } from "../../domain/events/game.events";
import {
  type IEventStore,
  type AppendResult,
  ConcurrencyError,
} from "./event-store.interface";

interface StoredEvent {
  /** Composite key: `${streamId}:${seq}` */
  pk: string;
  streamId: string;
  seq: number;
  event: GameEvent;
}

interface MonopolyDB extends DBSchema {
  events: {
    key: string;
    value: StoredEvent;
    indexes: {
      byStream: string;
    };
  };
  streams: {
    key: string;
    value: { streamId: string; version: number };
  };
}

const DB_NAME = "monopoly-deal";
const DB_VERSION = 1;

async function openStore(): Promise<IDBPDatabase<MonopolyDB>> {
  return openDB<MonopolyDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const evStore = db.createObjectStore("events", { keyPath: "pk" });
      evStore.createIndex("byStream", "streamId");
      db.createObjectStore("streams", { keyPath: "streamId" });
    },
  });
}

export class IdbEventStore implements IEventStore {
  private dbPromise = openStore();

  async append(
    streamId: string,
    events: GameEvent[],
    expectedVersion?: number
  ): Promise<AppendResult> {
    if (events.length === 0) return { storedCount: 0, newVersion: expectedVersion ?? 0 };
    const db = await this.dbPromise;
    const tx = db.transaction(["events", "streams"], "readwrite");

    const current = await tx.objectStore("streams").get(streamId);
    const currentVersion = current?.version ?? 0;

    if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
      await tx.done;
      throw new ConcurrencyError(streamId, expectedVersion, currentVersion);
    }

    for (const event of events) {
      const stored: StoredEvent = {
        pk: `${streamId}:${String(event.seq).padStart(8, "0")}`,
        streamId,
        seq: event.seq,
        event,
      };
      await tx.objectStore("events").put(stored);
    }

    const newVersion = currentVersion + events.length;
    await tx
      .objectStore("streams")
      .put({ streamId, version: newVersion });

    await tx.done;
    return { storedCount: events.length, newVersion };
  }

  async load(streamId: string): Promise<GameEvent[]> {
    const db = await this.dbPromise;
    const stored = await db.getAllFromIndex("events", "byStream", streamId);
    stored.sort((a, b) => a.seq - b.seq);
    return stored.map((s) => s.event);
  }

  async loadFrom(streamId: string, afterSeq: number): Promise<GameEvent[]> {
    const all = await this.load(streamId);
    return all.filter((e) => e.seq > afterSeq);
  }

  async listStreams(): Promise<string[]> {
    const db = await this.dbPromise;
    return db.getAllKeys("streams") as Promise<string[]>;
  }

  async deleteStream(streamId: string): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(["events", "streams"], "readwrite");
    const index = tx.objectStore("events").index("byStream");
    let cursor = await index.openCursor(streamId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.objectStore("streams").delete(streamId);
    await tx.done;
  }
}
