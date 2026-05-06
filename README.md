# How to Configure Tracer Components in Redpanda Connect

Working configuration files for adding distributed tracing to Redpanda Connect pipelines using the `tracer` component. Covers the native Jaeger tracer and the OpenTelemetry Collector tracer with sampling configuration.

## Prerequisites

- [Redpanda Connect 4.88.0 or higher](https://docs.redpanda.com/redpanda-connect/get-started/install/)
- [Docker Engine 29 or higher](https://docs.docker.com/get-started/get-docker/) with Docker Compose
- [rpk CLI](https://docs.redpanda.com/current/get-started/rpk-install/)

## How to Run

### 1. Run the base pipeline (no tracing)

```bash
rpk connect run ./pipeline/01-basic-pipeline.yaml
```

Outputs 20 synthetic purchase events to stdout.

### 2. Run the Jaeger-traced pipeline

Start Jaeger first:

```bash
docker compose -f docker/docker-compose.yml up jaeger
```

Then run the pipeline:

```bash
rpk connect run ./pipeline/02-jaeger-tracing.yaml
```

Open `http://localhost:16686` and search for service `benthos` to view traces.

### 3. Run the OTel Collector-traced pipeline

Start Jaeger and the OTel Collector together:

```bash
docker compose -f docker/docker-compose.yml up
```

Then run the pipeline:

```bash
rpk connect run ./pipeline/03-otel-tracing.yaml
```

Open `http://localhost:16686` and search for service `purchase-pipeline` to view traces.

## File Reference

```
.
├── docker/
│   ├── docker-compose.yml          # Jaeger all-in-one and OTel Collector
│   └── otel-collector-config.yaml  # OTel Collector config: OTLP gRPC receiver, Jaeger exporter
├── pipeline/
│   ├── 01-basic-pipeline.yaml      # Base pipeline without tracing
│   ├── 02-jaeger-tracing.yaml      # Pipeline with native Jaeger tracer
│   └── 03-otel-tracing.yaml        # Pipeline with OpenTelemetry Collector tracer
└── README.md
```

## Ports

| Service | Port | Purpose |
|---|---|---|
| Jaeger UI | 16686 | Trace viewer |
| Jaeger agent (UDP) | 6831 | Receives spans from native Jaeger tracer |
| Jaeger collector | 14250 / 14268 | Receives spans from OTel Collector |
| OTel Collector gRPC | 4317 | Receives OTLP spans from Redpanda Connect |
| OTel Collector HTTP | 4318 | Alternative HTTP OTLP endpoint |

## References

- [Redpanda Connect tracer component docs](https://docs.redpanda.com/redpanda-connect/components/tracers/about/)
- [Jaeger getting started](https://www.jaegertracing.io/docs/latest/getting-started/)
- [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/)