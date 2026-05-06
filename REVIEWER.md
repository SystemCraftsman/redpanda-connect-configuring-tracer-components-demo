# REVIEWER.md

## Article: How to Configure Tracer Components in Redpanda Connect for Distributed Tracing

### Environment Setup

The only prerequisite on the host is Docker (Engine 29 or higher). All tutorial tools (rpk, rpk connect, Docker CLI, curl) run inside a dev container.

**1. Build and start the reviewer container**

```bash
git clone https://github.com/draftdev/test--how-to-use-tracer-components-in-redpanda.git
cd test--how-to-use-tracer-components-in-redpanda

docker build -t reviewer -f Dockerfile.reviewer .

docker run -it --rm \
  --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd):/workspace \
  reviewer bash
```

You are now inside a clean environment with rpk, rpk connect, Docker CLI, and curl installed. All commands below run inside this container.

### Tutorial Walkthrough

**1. Verify tools**

```bash
rpk connect --version
docker compose version
```

Expected: rpk connect 4.88.0 or later, Docker Compose v2.x.

**2. Create workspace and base pipeline**

```bash
mkdir -p ~/redpanda-tracer-tutorial && cd ~/redpanda-tracer-tutorial
```

Create `01-basic-pipeline.yaml` with the content from the article and run it:

```bash
rpk connect run 01-basic-pipeline.yaml
```

Expected: 20 JSON objects printed to stdout, then process exits.

**3. Start Jaeger**

```bash
curl -O https://raw.githubusercontent.com/draftdev/test--how-to-use-tracer-components-in-redpanda/main/docker/docker-compose.yml
docker compose up -d jaeger
```

Expected: Jaeger UI available at http://localhost:16686

**4. Run the Jaeger-traced pipeline**

Copy `01-basic-pipeline.yaml` to `02-jaeger-tracing.yaml`, add the `tracer` block from the article, and run it:

```bash
rpk connect run 02-jaeger-tracing.yaml
```

Expected:
- 20 JSON objects printed to stdout
- Traces visible at http://localhost:16686 under service name `benthos`
- Each trace has one root span and two child spans (`bloblang`, `log`)
- Tags `pipeline: purchase-events` and `env: local` visible on spans

**5. Start OTel Collector**

```bash
curl -O https://raw.githubusercontent.com/draftdev/test--how-to-use-tracer-components-in-redpanda/main/docker/otel-collector-config.yaml
docker compose up -d
```

Expected: Both Jaeger and OTel Collector running. OTel Collector listening on port 4317.

**6. Run the OTel-traced pipeline**

Copy `01-basic-pipeline.yaml` to `03-otel-tracing.yaml`, add the `tracer` block from the article, and run it:

```bash
rpk connect run 03-otel-tracing.yaml
```

Expected:
- 20 JSON objects printed to stdout
- Traces visible at http://localhost:16686 under service name `purchase-pipeline`
- Same span hierarchy as the Jaeger tracer run

**7. Cleanup and exit**

```bash
docker compose down
exit
```

### Article Quality Checklist

- [ ] No em dashes present anywhere in the article
- [ ] No banned words: leverage, streamline, robust, utilize, harness, tapestry, landscape, paradigm, synergy, delve, fundamentally, remarkably, arguably, very, highly, extremely, incredibly
- [ ] No "In conclusion" / "To sum up" / "In summary" signposted conclusions
- [ ] No negative parallelism constructions ("It's not X, it's Y" / "Not X. Y.")
- [ ] No colon-fragment rhetorical setups ("The hard boundary:", "The result:")
- [ ] No "this is where X comes in" / "this is where X fits" transitions
- [ ] No bold-first bullet points
- [ ] Active voice throughout
- [ ] All significant claims backed by hyperlinks
- [ ] No vague attributions ("experts say", "industry reports suggest")

### Technical Accuracy Checklist

- [ ] `tracer` block YAML syntax is valid
- [ ] Jaeger agent_address port 6831 is correct (UDP)
- [ ] Jaeger UI port 16686 is correct
- [ ] Jaeger collector HTTP endpoint path `/api/traces` at port 14268 is correct
- [ ] OTel Collector gRPC default port 4317 is correct
- [ ] OTel Collector HTTP default port 4318 is correct
- [ ] `open_telemetry_collector` `ratio` field documented as string value
- [ ] `sampler_type: probabilistic` with `sampler_param: 0.1` gives ~10% sampling
- [ ] Default service name `benthos` is accurate for current Redpanda Connect version
- [ ] `collector_url` field requires version 3.38.0+ (verify against docs)
- [ ] Schema registry `format` options are correct: `json`, `protobuf`, `schema-registry-json`, `schema-registry-protobuf`
- [ ] `compression` codecs are correct: `lz4`, `snappy`, `gzip`, `zstd`, `none`
- [ ] `shutdown_delay` is a root-level field, not inside the `tracer` block

### Link Verification

- [ ] https://docs.redpanda.com/redpanda-connect/components/tracers/about/
- [ ] https://docs.redpanda.com/redpanda-connect/components/tracers/jaeger/
- [ ] https://docs.redpanda.com/redpanda-connect/components/tracers/open_telemetry_collector/
- [ ] https://docs.redpanda.com/redpanda-connect/get-started/install/
- [ ] https://docs.redpanda.com/redpanda-connect/configuration/about/
- [ ] https://docs.redpanda.com/redpanda-connect/components/processors/bloblang/
- [ ] https://docs.redpanda.com/current/get-started/rpk-install/
- [ ] https://docs.redpanda.com/current/manage/schema-reg/
- [ ] https://opentelemetry.io/docs/what-is-opentelemetry/
- [ ] https://opentelemetry.io/docs/specs/otlp/
- [ ] https://opentelemetry.io/docs/collector/
- [ ] https://opentelemetry.io/docs/concepts/sampling/
- [ ] https://www.jaegertracing.io/docs/latest/getting-started/#all-in-one
- [ ] https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor
- [ ] https://github.com/draftdev/test--how-to-use-tracer-components-in-redpanda

### Repository Checklist

- [ ] `docker/docker-compose.yml` exists and starts Jaeger + OTel Collector
- [ ] `docker/otel-collector-config.yaml` exists and is valid
- [ ] `pipeline/01-basic-pipeline.yaml` matches the article content
- [ ] `pipeline/02-jaeger-tracing.yaml` matches the article content
- [ ] `pipeline/03-otel-tracing.yaml` matches the article content
- [ ] Raw download URLs in the article resolve correctly
- [ ] README does not reference the article or content production
- [ ] No leftover placeholder URLs (e.g. `your-org/...`)
