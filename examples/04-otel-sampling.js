// Step 4 – OpenTelemetry tracer with sampling enabled.
//
// For high-volume production pipelines sampling lets you control what fraction
// of traces are actually exported to your backend, keeping costs and storage
// under control.
//
// Requires Redpanda Connect >= 4.25.0.
//
// Environment variables:
//   OTEL_SERVICE_NAME=redpanda-connect-prod
//   OTEL_HTTP_ADDRESS=otel-collector:4318
//   OTEL_SAMPLING_ENABLED=true
//   OTEL_SAMPLING_RATIO=0.1   (sample 10 % of traces)
//
// Run: node examples/04-otel-sampling.js

'use strict';

const path = require('path');
const { buildOtelConfig, writeConfigFile } = require('../src/index');

try {
  const samplingRatio = parseFloat(process.env.OTEL_SAMPLING_RATIO || '0.1');

  if (samplingRatio < 0 || samplingRatio > 1) {
    throw new Error(`OTEL_SAMPLING_RATIO must be between 0.0 and 1.0, got: ${samplingRatio}`);
  }

  const tracerOpts = {
    service:         process.env.OTEL_SERVICE_NAME    || 'redpanda-connect-prod',
    httpAddress:     process.env.OTEL_HTTP_ADDRESS     || 'localhost:4318',
    grpcAddress:     process.env.OTEL_GRPC_ADDRESS     || '',
    httpSecure:      process.env.OTEL_SECURE === 'true',
    // ASSUMPTION: sampling requires Redpanda Connect >= 4.25.0
    samplingEnabled: process.env.OTEL_SAMPLING_ENABLED === 'true' || true,
    samplingRatio,
    tags: {
      env:         'production',
      pipeline:    'otel-sampled-demo',
      sampling:    String(samplingRatio),
    },
  };

  const yaml = buildOtelConfig(
    {
      input: `input:
  generate:
    mapping: 'root = {"event": "purchase", "amount": random_int(), "ts": now()}'
    interval: 500ms
    count: 0`,

      pipeline: `pipeline:
  processors:
    - mapping: |
        root = this
        root.currency = "USD"
        root.validated = true`,

      output: `output:
  stdout: {}`,
    },
    tracerOpts,
  );

  const configPath = path.join('/tmp', 'connect-otel-sampled.yaml');
  writeConfigFile(configPath, yaml);

  console.log('\n--- Generated YAML (OTel Collector tracer + sampling) ---');
  console.log(yaml);
  console.log(`Config written to: ${configPath}`);
  console.log(`\nSampling ratio: ${samplingRatio * 100}% of traces will be exported.`);
  console.log('Increase OTEL_SAMPLING_RATIO toward 1.0 for debugging, keep it low in production.');
} catch (err) {
  console.error('Error building OTel sampling config:', err.message);
  process.exit(1);
}