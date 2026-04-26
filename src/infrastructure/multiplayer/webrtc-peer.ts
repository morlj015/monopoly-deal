// PeerJS-based transport — host registers a 4-char room code on the
// PeerJS signaling server; guest connects by entering that code.

import Peer, { type DataConnection } from "peerjs";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no O/I to avoid confusion
const PREFIX = "mdeal-";

function generateCode(): string {
  return Array.from({ length: 4 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join("");
}

export class WebRTCPeer {
  private peer: Peer;
  private conn: DataConnection | null = null;
  private onMessageCb: ((msg: string) => void) | null = null;
  private onConnectCb: (() => void) | null = null;
  private onDisconnectCb: (() => void) | null = null;
  private roomCode = "";

  constructor(_role: "host" | "guest") {
    // Peer ID assigned later (host picks a code, guest is anonymous)
    this.peer = new Peer();
  }

  // ── Host: open a room and return the 4-char code ──────────────────────────

  async host(): Promise<string> {
    this.roomCode = generateCode();
    const peerId = PREFIX + this.roomCode;

    // Try up to 5 codes in case one is taken
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await this.openWithId(peerId);
        break;
      } catch {
        this.roomCode = generateCode();
      }
    }

    this.peer.on("connection", (conn) => {
      this.conn = conn;
      this.bindConn(conn);
    });

    return this.roomCode;
  }

  // ── Guest: connect to a room code ─────────────────────────────────────────

  async join(code: string): Promise<void> {
    await this.waitForOpen();
    const peerId = PREFIX + code.trim().toUpperCase();
    const conn = this.peer.connect(peerId, { reliable: true });
    this.conn = conn;
    this.bindConn(conn);
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  send(msg: string): void {
    if (this.conn?.open) this.conn.send(msg);
  }

  onMessage(cb: (msg: string) => void) { this.onMessageCb = cb; }
  onConnect(cb: () => void)            { this.onConnectCb = cb; }
  onDisconnect(cb: () => void)         { this.onDisconnectCb = cb; }

  close() { this.peer.destroy(); }

  get connected() { return this.conn?.open ?? false; }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private bindConn(conn: DataConnection) {
    conn.on("open", () => this.onConnectCb?.());
    conn.on("data", (d) => this.onMessageCb?.(d as string));
    conn.on("close", () => this.onDisconnectCb?.());
    conn.on("error", () => this.onDisconnectCb?.());
  }

  private waitForOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.peer.id) { resolve(); return; }
      this.peer.once("open", () => resolve());
      this.peer.once("error", reject);
      setTimeout(() => reject(new Error("PeerJS timeout")), 10000);
    });
  }

  private openWithId(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.peer.destroy();
      this.peer = new Peer(id);
      this.peer.once("open", () => resolve());
      this.peer.once("error", (e) => reject(e));
      setTimeout(() => reject(new Error("Timeout")), 10000);
    });
  }
}
