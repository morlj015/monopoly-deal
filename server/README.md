# monopoly-deal-metrics

MQTT to Prometheus exporter for Monopoly Deal self-play games.

The browser publishes:

- `monopoly-deal/<gameId>/events` for event counters and turn timing
- `monopoly-deal/<gameId>/snapshot` as a retained compact state snapshot for gauges

## Run

```bash
cd ~/game-studio/monopoly-deal/server
npm install
npm run dev
```

The exporter listens on `:9104`.

Environment overrides:

- `MQTT_URL`, default `mqtt://mqtt.lab:1883`
- `PORT`, default `9104`
- `TOPIC_PREFIX`, default `monopoly-deal`

## Prometheus

Add a scrape target:

```yaml
- job_name: monopoly-deal-metrics
  scrape_interval: 5s
  static_configs:
    - targets: ["host.docker.internal:9104"]
```

Then import `server/dashboard.json` into Grafana with the Prometheus datasource. The
dashboard mirrors the Catan live dashboard and expects the Volkov Labs ECharts
panel plugin.

In the local lab stack this dashboard is provisioned as:

```text
http://grafana.lab/monopoly-live
```

## Browser MQTT

The app defaults to `ws://mqtt.lab/`. Override it with:

```js
localStorage.setItem("mqtt_url", "ws://localhost:9001")
localStorage.setItem("mqtt_topic_prefix", "monopoly-deal")
```
