# REVIEWER.md

## Article: How to Configure Tracer Components in Redpanda Connect for Distributed Tracing

### Setup Steps to Verify the Tutorial

**1. Install Redpanda Connect**
```bash
# macOS
brew install redpanda-data/tap/redpanda
rpk connect --version

# Linux
rpk connect install
rpk connect --version
```
Expected: version 4.x or later.

**2. Clone the companion repo**
```bash
git clone https://github.com/your-org/redpanda-tracer-tutorial
cd redpanda-tracer-tutorial
```

**3. Run the base pipeline**
```bash
rpk connect run ./pipeline/01-basic-pipeline.yaml
```
Expected: 20 JSON objects printed to stdout, then process exits cleanly.

**4. Start Jaeger**
```bash
docker compose -f docker/docker-compose.yml up jaeger
```
Expected: Jaeger UI available at http://localhost:16686

**5. Run the Jaeger-traced pipeline**
```bash
rpk connect run ./pipeline/02-jaeger-tracing.yaml
```
Expected:
- 20 JSON objects printed to stdout
- Traces visible at http://localhost:16686 under service name `benthos`
- Each trace has one root span and two child spans (`bloblang`, `log`)
- Tags `pipeline: purchase-events` and `env: local` visible on spans

**6. Start full Docker Compose stack (Jaeger + OTel Collector)**
```bash
docker compose -f docker/docker-compose.yml up
```
Expected: Both services start without errors. OTel Collector listens on port 4317.

**7. Run the OTel-traced pipeline**
```bash
rpk connect run ./pipeline/03-otel-tracing.yaml
```
Expected:
- 20 JSON objects printed to stdout
- Traces visible at http://localhost:16686 under service name `purchase-pipeline`
- Same span hierarchy as the Jaeger tracer run

### Manual Checklist

#### Article quality
- [ ] No em dashes present anywhere in the article
- [ ] No banned words: leverage, streamline, robust, utilize, harness, tapestry, landscape, paradigm, synergy, delve, fundamentally, remarkably, arguably, very, highly, extremely, incredibly
- [ ] No "In conclusion" / "To sum up" / "In summary" signposted conclusions
- [ ] No negative parallelism constructions ("It's not X, it's Y" / "Not X. Y.")
- [ ] No colon-fragment rhetorical setups ("The hard boundary:", "The result:")
- [ ] No "this is where X comes in" / "this is where X fits" transitions
- [ ] No fractal summaries (same point restated at section end)
- [ ] No bold-first bullet points
- [ ] No semicolons joining independent clauses
- [ ] No consecutive single-sentence micro-paragraphs for rhetorical punch
- [ ] Active voice throughout
- [ ] All significant claims backed by hyperlinks
- [ ] No vague attributions ("experts say", "industry reports suggest")
- [ ] No unicode arrows (→)
- [ ] All \$ signs escaped

#### Technical accuracy
- [ ] `tracer` block YAML syntax is valid
- [ ] Jaeger agent_address port 6831 is correct (UDP)
- [ ] Jaeger UI port 16686 is correct
- [ ] Jaeger collector HTTP endpoint path `/api/traces` at port 14268 is correct
- [ ] OTel Collector gRPC default port 4317 is correct
- [ ] OTel Collector HTTP default port 4318 is correct
- [ ] `open_telemetry_collector` `ratio` field documented as string value
- [ ] `sampler_type: probabilistic` with `sampler_param: 0.1` gives ~10% sampling
- [ ] Default service name `benthos` is accurate for Redpanda Connect
- [ ] Helm `values.yaml` `tracing.openTelemetry` key structure is accurate
- [ ] `flush_interval` field is on `jaeger` tracer (not on `open_telemetry_collector`)
- [ ] `collector_url` field requires version 3.38.0+ (verify against docs)

#### Code blocks
- [ ] All YAML snippets are valid YAML
- [ ] `pipeline/01-basic-pipeline.yaml` exists in companion repo
- [ ] `pipeline/02-jaeger-tracing.yaml` exists in companion repo
- [ ] `pipeline/03-otel-tracing.yaml` exists in companion repo
- [ ] `docker/docker-compose.yml` exists in companion repo
- [ ] `docker/otel-collector-config.yaml` exists in companion repo
- [ ] All `rpk connect run` commands execute without error
- [ ] `docker compose` commands start services correctly

#### Links
- [ ] https://docs.redpanda.com/redpanda-connect/components/tracers/about/ resolves
- [ ] https://docs.redpanda.com/redpanda-connect/components/tracers/jaeger/ resolves
- [ ] https://docs.redpanda.com/redpanda-connect/components/tracers/open_telemetry_collector/ resolves
- [ ] https://docs.redpanda.com/redpanda-connect/get-started/install/ resolves
- [ ] https://docs.redpanda.com/redpanda-connect/configuration/about/ resolves
- [ ] https://docs.redpanda.com/redpanda-connect/guides/streams_mode/ resolves
- [ ] https://docs.redpanda.com/redpanda-connect/components/metrics/about/ resolves
- [ ] https://opentelemetry.io/docs/what-is-opentelemetry/ resolves
- [ ] https://opentelemetry.io/docs/specs/otlp/ resolves
- [ ] https://opentelemetry.io/docs/collector/ resolves
- [ ] https://opentelemetry.io/docs/concepts/sampling/ resolves
- [ ] https://www.jaegertracing.io/docs/latest/getting-started/#all-in-one resolves
- [ ] https://artifacthub.io/packages/helm/redpanda-data/redpanda-connect resolves
- [ ] https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor resolves

#### README
- [ ] README makes no reference to the article or content production
- [ ] All file paths in the file reference table exist in the repo
- [ ] Port table is accurate
- [ ] Installation commands work on macOS and Linux

### Notes for Reviewer

- The article uses `benthos` as the default service name in Jaeger. Confirm this is still the default in the current Redpanda Connect version (it historically inherited from the Benthos codebase). If it has changed, update the article and the Jaeger UI instructions.
- The `collector_url` field requiring version 3.38.0+ is sourced from official Redpanda docs. Verify this version floor is still accurate.
- The `open_telemetry_collector` `ratio` field documented as a string (e.g. `"0.1"`) should be verified against the current schema, as type handling sometimes changes between releases.
- Companion repo GitHub URL (`https://github.com/your-org/redpanda-tracer-tutorial`) is a placeholder and must be updated to the real repo URL before publishing.