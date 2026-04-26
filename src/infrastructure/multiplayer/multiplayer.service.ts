// Multiplayer service: host runs the game engine, guest mirrors it.
//
// Both players are mapped to "player" / "ai" in the game engine.
// Host plays as "player", guest plays as "ai".
// To keep both UIs identical, when we push state to the guest we flip
// player/ai so each person always sees themselves as "player".

import { WebRTCPeer } from "./webrtc-peer";
import { GameService } from "../../application/game.service";
import { IdbEventStore } from "../event-store/idb-event-store";
import { noopAI } from "./noop-ai";
import type { GameState } from "../../domain/types/game.types";
import type { GameCommand } from "../../domain/commands/game.commands";
import { v4 as uuid } from "uuid";

export interface PlayerNames { you: string; opponent: string; }

type Msg =
  | { type: "state"; state: GameState; hostName: string }
  | { type: "cmd"; cmd: Partial<GameCommand> & { type: string } }
  | { type: "ready"; name: string }
  | { type: "rematch-vote" };

function flipState(s: GameState): GameState {
  return {
    ...s,
    turn: {
      ...s.turn,
      activePlayer: s.turn.activePlayer === "player" ? "ai" : "player",
    },
    players: {
      player: { ...s.players.ai,  id: "player" },
      ai:     { ...s.players.player, id: "ai"  },
    },
    pendingReaction: s.pendingReaction ? flipReaction(s.pendingReaction) : null,
    winner: s.winner === "player" ? "ai" : s.winner === "ai" ? "player" : null,
  };
}

function flipReaction(pr: GameState["pendingReaction"]): GameState["pendingReaction"] {
  if (!pr) return null;
  if (pr.kind === "jsnCheck") {
    return { ...pr, reactingPlayer: pr.reactingPlayer === "player" ? "ai" : "player" };
  }
  if (pr.kind === "payDebt") {
    return {
      ...pr,
      creditor: pr.creditor === "player" ? "ai" : "player",
      debtor:   pr.debtor   === "player" ? "ai" : "player",
    };
  }
  if (pr.kind === "forcedDealGive") {
    return {
      ...pr,
      giver:    pr.giver    === "player" ? "ai" : "player",
      receiver: pr.receiver === "player" ? "ai" : "player",
    };
  }
  return pr;
}

function flipCmd(cmd: Partial<GameCommand> & { type: string }, gameId: string): GameCommand {
  return { ...cmd, gameId, issuedBy: "ai" } as GameCommand;
}

// ── Host ─────────────────────────────────────────────────────────────────────

export class MultiplayerHost {
  private svc: GameService;
  private gameId = uuid();
  private onNamesResolvedCb: ((names: PlayerNames) => void) | null = null;
  private onOpponentVoteCb: (() => void) | null = null;
  private hostVoted = false;
  private guestVoted = false;

  constructor(
    private readonly peer: WebRTCPeer,
    private readonly hostName: string,
    onStateChange: (s: GameState) => void,
  ) {
    this.svc = new GameService(
      new IdbEventStore(),
      noopAI,
      (s) => {
        onStateChange(s);
        this.pushToGuest(s);
      },
    );

    peer.onMessage((raw) => {
      let msg: Msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        console.warn("Received malformed message from peer, ignoring");
        return;
      }
      if (!msg || typeof msg.type !== "string") return;
      if (msg.type === "ready") {
        const guestName = msg.name || "Guest";
        this.onNamesResolvedCb?.({ you: hostName, opponent: guestName });
      } else if (msg.type === "cmd") {
        const cmd = flipCmd(msg.cmd, this.gameId);
        if (this.svc.state?.phase === "reaction") {
          this.svc.respondAsPlayer(cmd).catch(console.error);
        } else {
          this.svc.dispatch(cmd).catch(console.error);
        }
      } else if (msg.type === "rematch-vote") {
        this.guestVoted = true;
        this.onOpponentVoteCb?.();
        if (this.hostVoted) this.startRematch();
      }
    });
  }

  onNamesResolved(cb: (names: PlayerNames) => void) { this.onNamesResolvedCb = cb; }
  onOpponentVote(cb: () => void) { this.onOpponentVoteCb = cb; }

  sendRematchVote() {
    this.hostVoted = true;
    // Notify guest that host also wants a rematch
    if (this.peer.connected) {
      this.peer.send(JSON.stringify({ type: "rematch-vote" } satisfies Msg));
    }
    if (this.guestVoted) this.startRematch();
  }

  private startRematch() {
    this.hostVoted = false;
    this.guestVoted = false;
    this.gameId = uuid();
    this.svc.startNewGame(this.gameId, "medium").catch(console.error);
  }

  async openRoom(): Promise<string> { return this.peer.host(); }

  async startGame(): Promise<void> {
    await this.svc.startNewGame(this.gameId, "medium");
  }

  get isConnected() { return this.peer.connected; }

  async dispatch(cmd: Omit<GameCommand, "gameId" | "issuedBy"> & { type: string }): Promise<void> {
    const full = { ...cmd, gameId: this.gameId, issuedBy: "player" } as GameCommand;
    if (this.svc.state?.phase === "reaction") {
      await this.svc.respondAsPlayer(full);
    } else {
      await this.svc.dispatch(full);
    }
  }

  private pushToGuest(s: GameState) {
    if (!this.peer.connected) return;
    const msg: Msg = { type: "state", state: flipState(s), hostName: this.hostName };
    this.peer.send(JSON.stringify(msg));
  }
}

// ── Guest ─────────────────────────────────────────────────────────────────────

export class MultiplayerGuest {
  private onStateChangeCb: ((s: GameState) => void) | null = null;
  private onNamesResolvedCb: ((names: PlayerNames) => void) | null = null;
  private onOpponentVoteCb: (() => void) | null = null;
  private namesResolved = false;

  constructor(private readonly peer: WebRTCPeer, guestName: string) {
    peer.onMessage((raw) => {
      let msg: Msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        console.warn("Received malformed message from peer, ignoring");
        return;
      }
      if (!msg || typeof msg.type !== "string") return;
      if (msg.type === "state") {
        if (!this.namesResolved) {
          this.namesResolved = true;
          this.onNamesResolvedCb?.({ you: guestName, opponent: msg.hostName || "Host" });
        }
        this.onStateChangeCb?.(msg.state);
      } else if (msg.type === "rematch-vote") {
        // Host has also voted — notify UI
        this.onOpponentVoteCb?.();
      }
    });

    peer.onConnect(() => {
      const ready: Msg = { type: "ready", name: guestName };
      peer.send(JSON.stringify(ready));
    });
  }

  onNamesResolved(cb: (names: PlayerNames) => void) { this.onNamesResolvedCb = cb; }
  onStateChange(cb: (s: GameState) => void) { this.onStateChangeCb = cb; }
  onOpponentVote(cb: () => void) { this.onOpponentVoteCb = cb; }

  sendRematchVote() {
    const msg: Msg = { type: "rematch-vote" };
    this.peer.send(JSON.stringify(msg));
  }

  dispatch(cmd: Omit<GameCommand, "gameId" | "issuedBy"> & { type: string }) {
    const msg: Msg = { type: "cmd", cmd: { ...cmd, issuedBy: "player" } };
    this.peer.send(JSON.stringify(msg));
  }
}
