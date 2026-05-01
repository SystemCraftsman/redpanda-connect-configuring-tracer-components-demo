// Step 2 – Jaeger tracer: configure Redpanda Connect to emit OpenTracing spans
// to a Jaeger agent or collector.
//
// Prerequisites:
//   - Jaeger running locally (e.g. docker run -d -p 6831:6831/udp -p 16686:16686
//       jaegertracing/all-in-one:latest)
//
// Environment variables (all optional – defaults shown):
//   JAEGER_AGENT_ADDRESS=localhost:6831
//   JAEGER_COLLECTOR_URL=  (empty → use agent)
//   JAEGER_FLUSH_INTERVAL=1s
//
// Run: node examples/02-jaeger-tracer.js

'use strict';

const path = require('path');
const { buildJaegerConfig, writeConfigFile } = require('../src/index');

try {
  // ── Tracer options ──────────────────────────────────────────────────────
  // agent_address  : where the Jaeger agent listens for UDP spans (port 6831)
  // flush_interval : how often buffered spans are flushed to Jaeger
  // sampler_type   : "const" → always sample (good for dev / low-volume)
  // sampler_param  : 1 with const sampler = 100 % sampling
  // tags           : key-value metadata attached to every span in this pipeline
  const tracerOpts = {
    agentAddress:  process.env.JAEGER_AGENT_ADDRESS  || 'localhost:6831',
    collectorUrl:  process.env.JAEGER_COLLECTOR_URL  || '',
    flushInterval: process.env.JAEGER_FLUSH_INTERVAL || '1s',
    samplerType:   'const',
    samplerParam:  1,
    tags: {
      env:      'development',
      pipeline: 'jaeger-demo',
    },
  };

  const yaml = buildJaegerConfig(
    {
      input: `input:
  generate:
    mapping: 'root = {"event": "order_created", "order_id": uuid_v4(), "ts": now()}'
    interval: 3s
    count: 0`,

      pipeline: `pipeline:
  processors:
    # Each processor below becomes a child span in Jaeger
    - mapping: |
        root = this
        root.stage = "validated"
    - mapping: |
        root = this
        root.stage = "enriched"`,

      output: `output:
  stdout: {}`,
    },
    tracerOpts,
  );

  const configPath = path.join('/tmp', 'connect-jaeger.yaml');
  writeConfigFile(configPath, yaml);

  console.log('\n--- Generated YAML (Jaeger tracer) ---');
  console.log(yaml);
  console.log(`Config written to: ${configPath}`);
  console.log('\nStart Jaeger all-in-one (if not already running):');
  console.log('  docker run -d --name jaeger \\');
  console.log('    -p 6831:6831/udp \\');
  console.log('    -p 16686:16686 \\');
  console.log('    jaegertracing/all-in-one:latest');
  console.log('\nRun the pipeline:');
  console.log(`  rpk connect run ${configPath}`);
  console.log('\nOpen the Jaeger UI at http://localhost:16686 to inspect traces.');
} catch (err) {
  console.error('Error building Jaeger config:', err.message);
  process.exit(1);
}