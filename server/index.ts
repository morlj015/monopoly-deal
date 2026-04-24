import http from "node:http";
import mqtt from "mqtt";
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from "prom-client";

import type { DomainEvent, PlayerId } from "../src/domain/events.ts";
import type { GameSnapshot } from "../src/domain/snapshot.ts";

const MQTT_URL = process.env.MQTT_URL ?? "mqtt://mqtt.lab:1883";
const PORT = Number(process.env.PORT ?? 9104);
const TOPIC_PREFIX = process.env.TOPIC_PREFIX ?? "monopoly-deal";

type TelemetryEventEnvelope = {
  gameId: string;
  seq: number;
  ts: number;
  type: DomainEvent["type"];
  playerId: string | null;
  event: DomainEvent;
};

const registry = new Registry();
collectDefaultMetrics({ register: registry });

const PLAYER_LABELS = ["game", "player"] as const;

const completedSetsGauge = new Gauge({
  name: "monopoly_deal_completed_sets",
  help: "Completed property sets per player.",
  labelNames: PLAYER_LABELS,
  registers: [registry]
});
const handCardsGauge = new Gauge({
  name: "monopoly_deal_hand_cards",
  help: "Cards in hand per player.",
  labelNames: PLAYER_LABELS,
  registers: [registry]
});
const bankValueGauge = new Gauge({
  name: "monopoly_deal_bank_value",
  help: "Bank value in millions per player.",
  labelNames: PLAYER_LABELS,
  registers: [registry]
});
const propertyValueGauge = new Gauge({
  name: "monopoly_deal_property_value",
  help: "Property and building value in millions per player.",
  labelNames: PLAYER_LABELS,
  registers: [registry]
});
const exposedValueGauge = new Gauge({
  name: "monopoly_deal_exposed_value",
  help: "Bank plus property value in millions per player.",
  labelNames: PLAYER_LABELS,
  registers: [registry]
});
const rentPotentialGauge = new Gauge({
  name: "monopoly_deal_rent_potential",
  help: "Sum of current undoubled rent values across each player's property colors.",
  labelNames: PLAYER_LABELS,
  registers: [registry]
});
const propertiesByColorGauge = new Gauge({
  name: "monopoly_deal_properties_by_color",
  help: "Property cards played per player and color.",
  labelNames: [...PLAYER_LABELS, "color"],
  registers: [registry]
});
const currentPlayerGauge = new Gauge({
  name: "monopoly_deal_current_player",
  help: "1 if this player is the current player in the game.",
  labelNames: PLAYER_LABELS,
  registers: [registry]
});
const deckGauge = new Gauge({
  name: "monopoly_deal_deck_cards",
  help: "Cards remaining in the draw deck.",
  labelNames: ["game"],
  registers: [registry]
});
const discardGauge = new Gauge({
  name: "monopoly_deal_discard_cards",
  help: "Cards in the discard pile.",
  labelNames: ["game"],
  registers: [registry]
});
const seqGauge = new Gauge({
  name: "monopoly_deal_event_seq",
  help: "Latest observed event sequence number.",
  labelNames: ["game"],
  registers: [registry]
});
const gameOverGauge = new Gauge({
  name: "monopoly_deal_game_over",
  help: "1 when a game has ended.",
  labelNames: ["game", "winner"],
  registers: [registry]
});

const eventsCounter = new Counter({
  name: "monopoly_deal_events_total",
  help: "Event count by domain event type.",
  labelNames: ["game", "type"],
  registers: [registry]
});
const gamesStarted = new Counter({
  name: "monopoly_deal_games_started_total",
  help: "Games observed through retained snapshots.",
  labelNames: ["game"],
  registers: [registry]
});
const victoriesCounter = new Counter({
  name: "monopoly_deal_game_victories_total",
  help: "Game victories by player.",
  labelNames: PLAYER_LABELS,
  registers: [registry]
});
const paymentsCounter = new Counter({
  name: "monopoly_deal_payment_value_total",
  help: "Total value paid between players.",
  labelNames: ["game", "from", "to"],
  registers: [registry]
});
const rentCounter = new Counter({
  name: "monopoly_deal_rent_charged_total",
  help: "Total rent demand value by charging player and color before payment shortfalls.",
  labelNames: ["game", "player", "color"],
  registers: [registry]
});
const cardsDrawnCounter = new Counter({
  name: "monopoly_deal_cards_drawn_total",
  help: "Cards drawn by player.",
  labelNames: PLAYER_LABELS,
  registers: [registry]
});
const turnHist = new Histogram({
  name: "monopoly_deal_turn_duration_seconds",
  help: "Wall-clock turn duration observed from TurnStarted to TurnEnded.",
  labelNames: PLAYER_LABELS,
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [registry]
});

type GameMeta = {
  players: string[];
  turnStartTs?: number;
  winnerCounted?: string;
};
const meta = new Map<string, GameMeta>();

type SnapshotRow = GameSnapshot;
type EventRow = {
  seq: number;
  ts: number;
  type: DomainEvent["type"];
  playerId: string | null;
};
const history = new Map<string, { snapshots: SnapshotRow[]; events: EventRow[] }>();
const HISTORY_CAP = 20000;

const bump = (gameId: string) => {
  let gameHistory = history.get(gameId);
  if (!gameHistory) {
    gameHistory = { snapshots: [], events: [] };
    history.set(gameId, gameHistory);
  }
  return gameHistory;
};

function onSnapshot(gameId: string, snapshot: GameSnapshot) {
  const previous = meta.get(gameId);
  if (!previous) {
    meta.set(gameId, { players: snapshot.players.map((player) => player.id) });
    gamesStarted.inc({ game: gameId });
  }

  seqGauge.set({ game: gameId }, snapshot.seq);
  deckGauge.set({ game: gameId }, snapshot.deckTotal);
  discardGauge.set({ game: gameId }, snapshot.discardTotal);

  for (const player of snapshot.players) {
    completedSetsGauge.set({ game: gameId, player: player.id }, player.completedSets);
    handCardsGauge.set({ game: gameId, player: player.id }, player.handTotal);
    bankValueGauge.set({ game: gameId, player: player.id }, player.bankValue);
    propertyValueGauge.set({ game: gameId, player: player.id }, player.propertyValue);
    exposedValueGauge.set({ game: gameId, player: player.id }, player.exposedValue);
    rentPotentialGauge.set({ game: gameId, player: player.id }, player.rentPotential);
    currentPlayerGauge.set(
      { game: gameId, player: player.id },
      player.id === snapshot.currentPlayer ? 1 : 0
    );
    for (const [color, value] of Object.entries(player.propertiesByColor)) {
      propertiesByColorGauge.set({ game: gameId, player: player.id, color }, value);
    }
  }

  if (snapshot.winner) {
    gameOverGauge.set({ game: gameId, winner: snapshot.winner }, 1);
    const m = meta.get(gameId);
    if (m && m.winnerCounted !== snapshot.winner) {
      victoriesCounter.inc({ game: gameId, player: snapshot.winner });
      m.winnerCounted = snapshot.winner;
    }
  }

  const gameHistory = bump(gameId);
  if (gameHistory.snapshots.at(-1)?.seq === snapshot.seq) {
    gameHistory.snapshots.pop();
  }
  gameHistory.snapshots.push(snapshot);
  if (gameHistory.snapshots.length > HISTORY_CAP) {
    gameHistory.snapshots.splice(0, gameHistory.snapshots.length - HISTORY_CAP);
  }
}

function onEvent(gameId: string, envelope: TelemetryEventEnvelope) {
  eventsCounter.inc({ game: gameId, type: envelope.type });
  const gameHistory = bump(gameId);
  gameHistory.events.push({
    seq: envelope.seq,
    ts: envelope.ts,
    type: envelope.type,
    playerId: envelope.playerId
  });
  if (gameHistory.events.length > HISTORY_CAP) {
    gameHistory.events.splice(0, gameHistory.events.length - HISTORY_CAP);
  }

  const event = envelope.event;
  if (event.type === "CardsDrawn") {
    cardsDrawnCounter.inc({ game: gameId, player: event.playerId }, event.cards.length);
  }
  if (event.type === "PaymentCollected") {
    paymentsCounter.inc(
      { game: gameId, from: event.fromPlayerId, to: event.toPlayerId },
      event.paidAmount
    );
  }
  if (event.type === "RentCharged") {
    rentCounter.inc(
      { game: gameId, player: event.playerId, color: event.color },
      event.amount * Math.max(1, event.targetPlayerIds.length)
    );
  }
  if (event.type === "GameWon") {
    victoriesCounter.inc({ game: gameId, player: event.playerId });
  }
  if (event.type === "TurnStarted") {
    const m = meta.get(gameId) ?? { players: [] };
    m.turnStartTs = Date.now();
    meta.set(gameId, m);
  }
  if (event.type === "TurnEnded") {
    const m = meta.get(gameId);
    if (m?.turnStartTs !== undefined) {
      turnHist.observe(
        { game: gameId, player: event.playerId },
        (Date.now() - m.turnStartTs) / 1000
      );
    }
  }
}

const client = mqtt.connect(MQTT_URL, { reconnectPeriod: 2000 });
client.on("connect", () => {
  const topics = [`${TOPIC_PREFIX}/+/snapshot`, `${TOPIC_PREFIX}/+/events`];
  client.subscribe(topics, (error) => {
    if (error) {
      console.error("[monopoly-deal-metrics] subscribe error", error);
    } else {
      console.log(`[monopoly-deal-metrics] subscribed to ${topics.join(", ")}`);
    }
  });
});
client.on("error", (error) => console.error("[monopoly-deal-metrics] mqtt error", error));

client.on("message", (topic, payload) => {
  const parts = topic.split("/");
  if (parts.length !== 3 || parts[0] !== TOPIC_PREFIX) {
    return;
  }
  const gameId = parts[1]!;
  const kind = parts[2]!;
  const raw = payload.toString();
  if (raw.length === 0) {
    return;
  }
  try {
    const body = JSON.parse(raw) as unknown;
    if (kind === "snapshot") {
      onSnapshot(gameId, body as GameSnapshot);
    } else if (kind === "events") {
      onEvent(gameId, body as TelemetryEventEnvelope);
    }
  } catch (error) {
    console.warn("[monopoly-deal-metrics] bad payload on", topic, error);
  }
});

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "content-type"
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", "http://local");
  if (url.pathname === "/metrics") {
    res.writeHead(200, { "content-type": registry.contentType, ...corsHeaders });
    res.end(await registry.metrics());
    return;
  }
  if (url.pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json", ...corsHeaders });
    res.end(JSON.stringify({ ok: true, games: meta.size, mqtt: client.connected }));
    return;
  }
  if (url.pathname === "/history") {
    const gameId = url.searchParams.get("game") ?? "";
    const since = Number(url.searchParams.get("since") ?? "0");
    const gameHistory = history.get(gameId);
    const body = gameHistory
      ? {
          snapshots: gameHistory.snapshots.filter((snapshot) => snapshot.seq >= since),
          events: gameHistory.events.filter((event) => event.seq >= since)
        }
      : { snapshots: [], events: [] };
    res.writeHead(200, { "content-type": "application/json", ...corsHeaders });
    res.end(JSON.stringify(body));
    return;
  }
  if (url.pathname === "/games") {
    const gameIds = [...history.entries()]
      .sort(([, left], [, right]) => {
        const leftTs = left.snapshots.at(-1)?.ts ?? 0;
        const rightTs = right.snapshots.at(-1)?.ts ?? 0;
        return leftTs - rightTs;
      })
      .map(([gameId]) => gameId);
    res.writeHead(200, { "content-type": "application/json", ...corsHeaders });
    res.end(JSON.stringify(gameIds));
    return;
  }

  res.writeHead(404, corsHeaders);
  res.end("monopoly-deal-metrics\ntry /metrics /healthz /history?game=<id> /games\n");
});

server.listen(PORT, () => {
  console.log(`[monopoly-deal-metrics] listening on :${PORT}, mqtt=${MQTT_URL}`);
});
