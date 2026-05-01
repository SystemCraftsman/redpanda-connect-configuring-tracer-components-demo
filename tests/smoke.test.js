// tests/smoke.test.js
// Smoke test: spin up Redpanda Connect in Docker with both tracer config
// variants, verify the HTTP /ping endpoint returns "pong", then tear down.
//
// Requirements:
//   • Docker daemon running
//   • Ports 4195 and 4196 available on localhost
//
// Run:
//   node tests/smoke.test.js
//
// Exit code 0 = all checks passed, non-zero = failure.

'use strict';

const path = require('path');
const assert = require('assert');

const {
  buildNoTracerConfig,
  buildJaegerConfig,
  buildOtelConfig,
  writeConfigFile,
  runConnectDocker,
  stopConnectDocker,
  waitForConnect,
  pingConnect,
} = require('../src/index');

// ── Config ──────────────────────────────────────────────────────────────────
const IMAGE = process.env.REDPANDA_CONNECT_IMAGE || 'docker.redpanda.com/redpandadata/connect:latest';
const HOST  = process.env.CONNECT_HOST || 'localhost';

// Ports for the two test containers
const PORT_NO_TRACER = 4195;
const PORT_JAEGER    = 4196;

// Docker container names (used to force-remove after tests)
const NAME_NO_TRACER = 'smoke-no-tracer';
const NAME_JAEGER    = 'smoke-jaeger';

// Shared pipeline sections — minimal generate → stdout for smoke purposes
const pipeline = {
  input: `input:
  generate:
    mapping: 'root = {"smoke": true}'
    interval: 1s
    count: 0`,
  pipeline: `pipeline:
  processors:
    - mapping: 'root = this'`,
  output: `output:
  stdout: {}`,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
let failures = 0;

function pass(msg) { console.log(`  ✓  ${msg}`); }
function fail(msg, err) {
  console.error(`  ✗  ${msg}`);
  if (err) console.error(`       ${err.message}`);
  failures++;
}

async function runTest(label, fn) {
  console.log(`\n[TEST] ${label}`);
  try {
    await fn();
  } catch (err) {
    fail(`Uncaught error in "${label}"`, err);
  }
}

// ── Cleanup guard ─────────────────────────────────────────────────────────
process.on('exit', () => {
  // Always attempt cleanup, even if tests crash mid-way
  stopConnectDocker(NAME_NO_TRACER);
  stopConnectDocker(NAME_JAEGER);
});

// ── Tests ────────────────────────────────────────────────────────────────────
(async () => {
  console.log('=== Redpanda Connect Tracer Smoke Tests ===');

  // ── Test 1: no-tracer config is valid YAML and can be written ────────────
  await runTest('No-tracer config generation', async () => {
    let yaml;
    try {
      yaml = buildNoTracerConfig(pipeline);
      pass('buildNoTracerConfig returned a string');
    } catch (err) {
      fail('buildNoTracerConfig threw', err);
      return;
    }

    try {
      assert.ok(yaml.includes('tracer:'), 'YAML contains tracer section');
      assert.ok(yaml.includes('none: {}'),   'YAML disables tracer with none: {}');
      pass('No-tracer YAML contains expected tracer: none: {} section');
    } catch (err) {
      fail('No-tracer YAML assertion failed', err);
    }

    const configPath = '/tmp/smoke-no-tracer.yaml';
    try {
      writeConfigFile(configPath, yaml);
      pass(`Config written to ${configPath}`);
    } catch (err) {
      fail('writeConfigFile threw', err);
    }
  });

  // ── Test 2: Jaeger config contains correct YAML structure ────────────────
  await runTest('Jaeger tracer config generation', async () => {
    let yaml;
    try {
      yaml = buildJaegerConfig(pipeline, {
        agentAddress:  'localhost:6831',
        flushInterval: '500ms',
        samplerType:   'const',
        samplerParam:  1,
        tags: { env: 'smoke-test' },
      });
      pass('buildJaegerConfig returned a string');
    } catch (err) {
      fail('buildJaegerConfig threw', err);
      return;
    }

    try {
      assert.ok(yaml.includes('jaeger:'),               'Contains jaeger: key');
      assert.ok(yaml.includes('agent_address:'),        'Contains agent_address field');
      assert.ok(yaml.includes('flush_interval:'),       'Contains flush_interval field');
      assert.ok(yaml.includes('sampler_param:'),        'Contains sampler_param field');
      assert.ok(yaml.includes('sampler_type: const'),   'Contains sampler_type: const');
      assert.ok(yaml.includes('env: "smoke-test"'),     'Contains custom tag');
      pass('Jaeger YAML structure is correct');
    } catch (err) {
      fail('Jaeger YAML assertion failed', err);
    }

    const configPath = '/tmp/smoke-jaeger.yaml';
    try {
      writeConfigFile(configPath, yaml);
      pass(`Config written to ${configPath}`);
    } catch (err) {
      fail('writeConfigFile threw', err);
    }
  });

  // ── Test 3: OTel config contains correct YAML structure ──────────────────
  await runTest('OpenTelemetry Collector tracer config generation', async () => {
    let yaml;
    try {
      yaml = buildOtelConfig(pipeline, {
        service:         'smoke-test-service',
        httpAddress:     'localhost:4318',
        grpcAddress:     'localhost:4317',
        httpSecure:      false,
        grpcSecure:      false,
        samplingEnabled: true,
        samplingRatio:   0.5,
        tags: { env: 'smoke-test' },
      });
      pass('buildOtelConfig returned a string');
    } catch (err) {
      fail('buildOtelConfig threw', err);
      return;
    }

    try {
      assert.ok(yaml.includes('open_telemetry_collector:'), 'Contains open_telemetry_collector: key');
      assert.ok(yaml.includes('service: "smoke-test-service"'), 'Contains service name');
      assert.ok(yaml.includes('http:'),                    'Contains http: section');
      assert.ok(yaml.includes('address: "localhost:4318"'),'Contains http address');
      assert.ok(yaml.includes('grpc:'),                    'Contains grpc: section');
      assert.ok(yaml.includes('address: "localhost:4317"'),'Contains grpc address');
      assert.ok(yaml.includes('enabled: true'),            'Sampling enabled is true');
      assert.ok(yaml.includes('ratio: 0.5'),               'Sampling ratio is 0.5');
      pass('OTel YAML structure is correct');
    } catch (err) {
      fail('OTel YAML assertion failed', err);
    }
  });

  // ── Test 4: Live Docker smoke test (no-tracer) ────────────────────────────
  // Skipped if SKIP_DOCKER=true to allow CI environments without Docker.
  if (process.env.SKIP_DOCKER === 'true') {
    console.log('\n[TEST] Docker health check — SKIPPED (SKIP_DOCKER=true)');
  } else {
    await runTest('Redpanda Connect health check via Docker (no-tracer)', async () => {
      const configPath = '/tmp/smoke-no-tracer.yaml';

      // Write config (may already exist from Test 1)
      try {
        const yaml = buildNoTracerConfig(pipeline);
        writeConfigFile(configPath, yaml);
      } catch (err) {
        fail('Failed to write config before Docker test', err);
        return;
      }

      // Start the container
      let child;
      try {
        child = runConnectDocker(configPath, {
          image: IMAGE,
          port:  PORT_NO_TRACER,
          name:  NAME_NO_TRACER,
        });
        pass(`Container '${NAME_NO_TRACER}' started`);
      } catch (err) {
        fail('runConnectDocker threw', err);
        return;
      }

      // Wait for /ping to respond
      try {
        // ASSUMPTION: /ping returns HTTP 200 with body "pong" when ready
        await waitForConnect(HOST, PORT_NO_TRACER, 20, 1500);
        pass(`/ping responded on ${HOST}:${PORT_NO_TRACER}`);
      } catch (err) {
        fail('waitForConnect timed out', err);
        stopConnectDocker(NAME_NO_TRACER);
        return;
      }

      // Verify /ping response
      try {
        const { status, body } = await pingConnect(HOST, PORT_NO_TRACER);
        assert.strictEqual(status, 200, `Expected HTTP 200, got ${status}`);
        assert.strictEqual(body, 'pong',  `Expected body "pong", got "${body}"`);
        pass(`GET /ping → ${status} "${body}"`);
      } catch (err) {
        fail('/ping response assertion failed', err);
      } finally {
        // Always stop the container
        if (child) child.kill('SIGTERM');
        stopConnectDocker(NAME_NO_TRACER);
      }
    });
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n=== Smoke Test Summary ===');
  if (failures === 0) {
    console.log('All checks passed ✓');
    process.exit(0);
  } else {
    console.error(`${failures} check(s) failed ✗`);
    process.exit(1);
  }
})();
