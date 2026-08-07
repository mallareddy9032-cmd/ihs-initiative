# IHS Sub-5-Min SLA Monitoring

Grafana + Prometheus stack that alerts when **average dispatch TAT exceeds 04:30** (270 seconds) — early warning before the hard **05:00** Sub-5-Min SLA.

## Alert rules

| Alert | Condition | For | Severity |
|-------|-----------|-----|----------|
| `Sub5MinSLA_AvgDispatchOverFourThirty` | `ihs_dispatch_avg_tat_seconds > 270` | 2m | warning |
| `Sub5MinSLA_HardBreach` | `ihs_dispatch_avg_tat_seconds > 300` | 1m | critical |

Provisioned in both:

- Prometheus: `prometheus/rules/dispatch-sla.yml`
- Grafana Unified Alerting: `grafana/provisioning/alerting/dispatch-sla.yml`

## Metrics (cloud-engine `:8080/metrics`)

| Metric | Meaning |
|--------|---------|
| `ihs_dispatch_avg_tat_seconds` | Rolling average dispatch TAT (alert target) |
| `ihs_dispatch_tat_seconds` | Histogram of observed TAT samples |
| `ihs_dispatch_sla_warn_threshold_seconds` | Constant `270` (04:30) |
| `ihs_dispatch_sla_hard_threshold_seconds` | Constant `300` (05:00) |
| `ihs_dispatch_sla_warn_breaches_total` | Samples that crossed 04:30 |

## Native light monitor (recommended on 8 GB Mac)

Docker Desktop is heavy on 8 GB RAM. Prefer the native Vite app:

```bash
cd apps/sla-monitor && npm install && npm run dev
# → http://localhost:3007
```

Proxies `/metrics` + `/healthz` from cloud-engine `:8080`. Memory-capped with `NODE_OPTIONS=--max-old-space-size=1024`.

## Docker stack (optional)

```bash
# 1. Cloud engine must expose /metrics (npm run dev in services/cloud-engine)
# 2. Start monitoring stack
docker compose -f infra/monitoring/docker-compose.monitoring.yml up -d
```

| Service | URL |
|---------|-----|
| Native SLA Monitor | http://localhost:3007 |
| Grafana (Docker) | http://localhost:3007 conflicts — use native OR change compose port |
| Prometheus | http://localhost:9090 |
| Engine metrics | http://localhost:8080/metrics |

Dashboard: **IHS Sub-5-Min Dispatch SLA** (folder *IHS Dispatch SLA*).

Alerts: Grafana → Alerting → Alert rules.
