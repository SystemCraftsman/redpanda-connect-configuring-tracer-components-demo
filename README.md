# redpanda-tracer-tutorial

Working configuration files for adding distributed tracing to Redpanda Connect pipelines using the `tracer` component. Covers both the native Jaeger tracer and the OpenTelemetry Collector tracer, with sampling configuration and Helm deployment examples.

## Prerequisites

- [Redpanda Connect](https://docs.redpanda.com/redpanda-connect/get-started/install/) (`rpk connect` v4.x or later)
- Docker and Docker Compose
- macOS, Linux, or WSL2 on Windows

## Installation

No additional packages to install beyond Redpanda Connect and Docker. All pipeline configs are plain YAML.

Install Redpanda Connect if you haven't already:

```bash
# macOS
brew install redpanda-data/tap/redpanda

# Linux / WSL2
rpk connect install
```

## Configuration

No `.env` file is required. All configuration lives in the YAML files under `pipeline/` and `docker/`.

If you want to point the OTel tracer at a remote collector, update the `url` field in `pipeline/03-otel-tracing.yaml` to your collector endpoint.

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
│   ├── docker-compose.yml          # Runs Jaeger all-in-one and OTel Collector
│   └── otel-collector-config.yaml  # OTel Collector: receives OTLP gRPC, exports to Jaeger
├── pipeline/
│   ├── 01-basic-pipeline.yaml      # Base pipeline with no tracing (generate -> bloblang -> log -> stdout)
│   ├── 02-jaeger-tracing.yaml      # Same pipeline with native Jaeger tracer configured
│   └── 03-otel-tracing.yaml        # Same pipeline with OpenTelemetry Collector tracer configured
└── README.md
```

## Ports

| Service | Port | Purpose |
|---|---|---|
| Jaeger UI | 16686 | Trace viewer |
| Jaeger agent (UDP) | 6831 | Receives spans from native jaeger tracer |
| Jaeger collector | 14250 / 14268 | Receives spans from OTel Collector |
| OTel Collector gRPC | 4317 | Receives OTLP spans from Redpanda Connect |
| OTel Collector HTTP | 4318 | Alternative HTTP OTLP endpoint |

## References

- [Redpanda Connect tracer component docs](https://docs.redpanda.com/redpanda-connect/components/tracers/about/)
- [Jaeger getting started](https://www.jaegertracing.io/docs/latest/getting-started/)
- [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/)