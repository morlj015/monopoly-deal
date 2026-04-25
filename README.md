# Monopoly Deal

Event-sourced Monopoly Deal self-play implemented with Vite, React, TypeScript,
Three.js, IndexedDB, MQTT telemetry, Prometheus metrics, and a Grafana live
dashboard.

## Game

```bash
npm install
npm run dev
```

The Vite app runs at `http://127.0.0.1:5173`.

Useful checks:

```bash
npm test -- --run
npm run build
```

The browser stores event streams in IndexedDB and publishes telemetry over MQTT.
By default it connects to `ws://mqtt.lab/` and publishes under the
`monopoly-deal` topic prefix.

Override MQTT in the browser console when needed:

```js
localStorage.setItem("mqtt_url", "ws://localhost:9001")
localStorage.setItem("mqtt_topic_prefix", "monopoly-deal")
```

## Bot Strategy Plugins

Bot decisions are resolved through strategy plugins in `src/domain/bot.ts`.
Each bot player can carry a `botStrategyId`, and the self-play table seats a
mixed default lineup of Builder, Rent Shark, Deal Thief, and Banker.

Add a strategy by registering a plugin:

```ts
import { registerBotStrategy, type BotStrategyPlugin } from "./domain/bot";
import { isBankableCard } from "./domain/cards";
import { playCardToBank } from "./domain/commands";

export const cautiousBot: BotStrategyPlugin = {
  id: "cautious",
  name: "Cautious",
  description: "Banks money before taking riskier actions.",
  chooseEvents: ({ state, playerId }) => {
    const card = state.players[playerId].hand.find(isBankableCard);
    return card ? playCardToBank(state, playerId, card.id) : null;
  }
};

registerBotStrategy(cautiousBot);
```

For most bots, compose existing tactics with `createOrderedBotStrategy` and
`BOT_TACTICS` instead of writing every command decision from scratch. Make sure
the module that registers the plugin is imported during app startup.

## Local MCP Server

The repo includes a local MCP server for controlling and introspecting a
headless event-sourced Monopoly Deal simulation.

Run it over stdio for desktop MCP clients:

```bash
npm run mcp
```

Run it as a local Streamable HTTP server:

```bash
npm run mcp:http
```

The HTTP endpoint defaults to:

```text
http://127.0.0.1:3334/mcp
```

Available MCP tools:

- `monopoly_list_strategies`
- `monopoly_new_bot_game`
- `monopoly_new_human_game`
- `monopoly_state`
- `monopoly_recent_events`
- `monopoly_step_bot`
- `monopoly_run_bots`

Available MCP resources:

- `monopoly://state`
- `monopoly://events/recent`
- `monopoly://strategies`

## Metrics Exporter

```bash
cd server
npm install
npm run dev
```

The exporter listens on `:9104` and exposes:

- `GET /metrics` for Prometheus
- `GET /healthz`
- `GET /history?game=<gameId>` for sequence-based Grafana panels
- `GET /games`, ordered from oldest to newest observed snapshot

Environment overrides:

- `MQTT_URL`, default `mqtt://mqtt.lab:1883`
- `PORT`, default `9104`
- `TOPIC_PREFIX`, default `monopoly-deal`

Server checks:

```bash
cd server
npx tsc -p tsconfig.json
```

## Grafana

Import `server/dashboard.json` into Grafana with the Prometheus datasource UID
`prometheus`. The dashboard uses the Volkov Labs ECharts panel plugin, matching
the local Catan live dashboard setup.

Prometheus scrape target:

```yaml
- job_name: monopoly-deal-metrics
  scrape_interval: 5s
  static_configs:
    - targets: ["host.docker.internal:9104"]
```

For the local lab stack, provision the dashboard and friendly URL like this:

```bash
cp server/dashboard.json ~/lab/infra/grafana/dashboards/monopoly-live.json
```

Add this route inside the `http://grafana.lab` block in the lab Caddyfile:

```caddy
@monopoly_live path /monopoly-live
redir @monopoly_live /d/monopoly-live/monopoly-live 302
```

Restart the affected lab services:

```bash
cd ~/lab/infra
docker compose restart caddy prometheus grafana
```

Then open:

```text
http://grafana.lab/monopoly-live
```

The dashboard auto-follows the newest observed game by default. Toggle
auto-follow off in the dashboard if you want to inspect an older game.
