import mqtt, { type MqttClient } from "mqtt";
import type { DomainEvent } from "./domain/events";
import { buildSnapshot, type GameSnapshot } from "./domain/snapshot";
import type { GameState } from "./domain/state";

export interface TelemetryEventEnvelope {
  gameId: string;
  seq: number;
  ts: number;
  type: DomainEvent["type"];
  playerId: string | null;
  event: DomainEvent;
}

const DEFAULT_URL =
  import.meta.env.VITE_MQTT_URL ??
  (typeof localStorage !== "undefined" ? localStorage.getItem("mqtt_url") : null) ??
  "ws://mqtt.lab/";

const TOPIC_PREFIX =
  import.meta.env.VITE_MQTT_TOPIC_PREFIX ??
  (typeof localStorage !== "undefined" ? localStorage.getItem("mqtt_topic_prefix") : null) ??
  "monopoly-deal";

let client: MqttClient | null = null;
let connecting = false;
let queue: Array<{ topic: string; body: string; retain: boolean }> = [];

const playerIdFrom = (event: DomainEvent): string | null => {
  if ("playerId" in event && typeof event.playerId === "string") {
    return event.playerId;
  }
  if ("fromPlayerId" in event && typeof event.fromPlayerId === "string") {
    return event.fromPlayerId;
  }
  return null;
};

const ensureClient = (): MqttClient | null => {
  if (client) {
    return client;
  }
  if (connecting || typeof window === "undefined") {
    return null;
  }

  connecting = true;
  try {
    const next = mqtt.connect(DEFAULT_URL, {
      reconnectPeriod: 2000,
      connectTimeout: 4000,
      clean: true
    });
    next.on("connect", () => {
      client = next;
      connecting = false;
      const pending = queue;
      queue = [];
      for (const message of pending) {
        next.publish(message.topic, message.body, { qos: 0, retain: message.retain });
      }
    });
    next.on("error", (error) => {
      console.warn("[telemetry] mqtt error", error.message);
    });
    next.on("close", () => {
      client = null;
      connecting = false;
    });
    return null;
  } catch (error) {
    connecting = false;
    console.warn("[telemetry] mqtt connect failed", error);
    return null;
  }
};

const publish = (topic: string, body: string, retain: boolean) => {
  const current = ensureClient();
  if (current?.connected) {
    current.publish(topic, body, { qos: 0, retain });
    return;
  }

  queue.push({ topic, body, retain });
  if (queue.length > 2000) {
    queue.shift();
  }
};

export const publishDomainEvent = (
  gameId: string,
  seq: number,
  event: DomainEvent
) => {
  const envelope: TelemetryEventEnvelope = {
    gameId,
    seq,
    ts: Date.now(),
    type: event.type,
    playerId: playerIdFrom(event),
    event
  };
  publish(`${TOPIC_PREFIX}/${gameId}/events`, JSON.stringify(envelope), false);
};

export const publishSnapshot = (state: GameState) => {
  if (!state.gameId) {
    return;
  }
  const snapshot: GameSnapshot = buildSnapshot(state);
  publish(`${TOPIC_PREFIX}/${state.gameId}/snapshot`, JSON.stringify(snapshot), true);
};

export const clearSnapshot = (gameId: string) => {
  publish(`${TOPIC_PREFIX}/${gameId}/snapshot`, "", true);
};

export const disposeTelemetry = () => {
  if (client) {
    client.end(true);
    client = null;
  }
};
