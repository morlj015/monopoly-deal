import type { GameEvent } from "../events/game.events";
import type { GameState } from "../types/game.types";

export abstract class AggregateRoot {
  protected state!: GameState;
  private _pending: GameEvent[] = [];
  private _version = 0;

  protected raise(event: GameEvent): void {
    this._pending.push(event);
    this.apply(event);
    this._version++;
  }

  rehydrate(events: GameEvent[]): void {
    for (const e of events) {
      this.apply(e);
      this._version++;
    }
  }

  protected abstract apply(event: GameEvent): void;

  flush(): GameEvent[] {
    const out = this._pending.slice();
    this._pending = [];
    return out;
  }

  get snapshot(): Readonly<GameState> {
    return this.state;
  }

  get version(): number {
    return this._version;
  }
}
