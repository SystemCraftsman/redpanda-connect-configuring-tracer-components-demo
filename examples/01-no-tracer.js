// Step 1 – Baseline: a Redpanda Connect pipeline with tracing explicitly disabled.
//
// Run against a local Docker daemon:
//   node examples/01-no-tracer.js
//
// The script writes a config file to /tmp/connect-no-tracer.yaml and prints it
// so you can inspect the YAML structure before adding a tracer.

'use strict';

const path = require('path');
const { buildNoTracerConfig, writeConfigFile } = require('../src/index');

try {
  // Build a pipeline config with tracing disabled (tracer: none: {})
  const yaml = buildNoTracerConfig({
    // Custom input: generate synthetic events every 2 seconds
    input: `input:
  generate:
    mapping: 'root = {"msg": "hello from no-tracer pipeline", "ts": now()}'
    interval: 2s
    count: 5`,

    // Custom pipeline: one processor step (each step would normally become a span)
    pipeline: `pipeline:
  processors:
    - mapping: |
        root = this
        root.pipeline_step = "step-1"`,

    // Emit processed messages to stdout
    output: `output:
  stdout: {}`,
  });

  const configPath = path.join('/tmp', 'connect-no-tracer.yaml');
  writeConfigFile(configPath, yaml);

  console.log('\n--- Generated YAML ---');
  console.log(yaml);
  console.log(`Config written to: ${configPath}`);
  console.log('Run it locally with:');
  console.log(`  rpk connect run ${configPath}`);
  console.log('Or with Docker:');
  console.log(`  docker run --rm -v ${configPath}:/cfg.yaml docker.redpanda.com/redpandadata/connect:latest run /cfg.yaml`);
} catch (err) {
  console.error('Error building no-tracer config:', err.message);
  process.exit(1);
}