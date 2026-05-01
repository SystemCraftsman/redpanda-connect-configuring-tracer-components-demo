// Step 3 – OpenTelemetry Collector tracer: configure Redpanda Connect to send
// spans to an OpenTelemetry Collector over HTTP and/or gRPC.
//
// This tracer type supports both HTTP (port 4318) and gRPC (port 4317)
// collector endpoints simultaneously.
//
// Prerequisites:
//   - An OpenTelemetry Collector running locally.
//     Quick start: https://opentelemetry.io/docs/collector/getting-started/
//
// Environment variables (all optional – defaults shown):
//   OTEL_SERVICE_NAME=redpanda-connect
//   OTEL_HTTP_ADDRESS=localhost:4318
//   OTEL_GRPC_ADDRESS=localhost:4317
//   OTEL_SECURE=false
//
// Run: node examples/03-otel-tracer.js

'use strict';

const path = require('path');
const { buildOtelConfig, writeConfigFile } = require('../src/index');

try {
  // ── Tracer options ──────────────────────────────────────────────────────
  // service     : logical service name shown in trace UIs (e.g. Jaeger, Tempo)
  // httpAddress : endpoint of an HTTP OTLP receiver (port 4318 by default)
  // grpcAddress : endpoint of a gRPC OTLP receiver  (port 4317 by default)
  // httpSecure  : set true when the collector requires TLS
  // grpcSecure  : set true when the collector uses mTLS
  const tracerOpts = {
    service:     process.env.OTEL_SERVICE_NAME || 'redpanda-connect',
    httpAddress: process.env.OTEL_HTTP_ADDRESS || 'localhost:4318',
    grpcAddress: process.env.OTEL_GRPC_ADDRESS || 'localhost:4317',
    httpSecure:  process.env.OTEL_SECURE === 'true',
    grpcSecure:  process.env.OTEL_SECURE === 'true',
    // Sampling disabled by default — enable in Step 4
    samplingEnabled: false,
    samplingRatio:   1.0,
    tags: {
      env:      'staging',
      pipeline: 'otel-demo',
      team:     'data-engineering',
    },
  };

  const yaml = buildOtelConfig(
    {
      input: `input:
  generate:
    mapping: 'root = {"event": "page_view", "user_id": uuid_v4(), "ts": now()}'
    interval: 2s
    count: 0`,

      pipeline: `pipeline:
  processors:
    # Processor spans will appear nested under the root ingestion span
    - mapping: |
        root = this
        root.region = "us-east-1"
    - mapping: |
        root = this
        root.processed = true`,

      output: `output:
  stdout: {}`,
    },
    tracerOpts,
  );

  const configPath = path.join('/tmp', 'connect-otel.yaml');
  writeConfigFile(configPath, yaml);

  console.log('\n--- Generated YAML (OTel Collector tracer) ---');
  console.log(yaml);
  console.log(`Config written to: ${configPath}`);
  console.log('\nRun the pipeline:');
  console.log(`  rpk connect run ${configPath}`);
} catch (err) {
  console.error('Error building OTel config:', err.message);
  process.exit(1);
}