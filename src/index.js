// src/index.js
// Utilities for generating and managing Redpanda Connect pipeline configurations
// with tracer components (Jaeger and OpenTelemetry Collector).
//
// Redpanda Connect tracer docs: https://docs.redpanda.com/redpanda-connect/home/
// All tracer field names used here match the official Redpanda Connect YAML spec.

'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');
const { execSync, spawn } = require('child_process');

// ---------------------------------------------------------------------------
// Config builders
// ---------------------------------------------------------------------------

/**
 * Build a Redpanda Connect YAML config string that uses the `jaeger` tracer.
 *
 * Documented fields (source: Redpanda Connect tracer docs):
 *   agent_address  – address of a Jaeger agent (e.g. "localhost:6831")
 *   collector_url  – URL of a Jaeger collector; overrides agent_address when set
 *   flush_interval – period between each span flush (e.g. "500ms", "1s")
 *   sampler_param  – numeric sampling parameter; default 1 (sample all)
 *   sampler_type   – sampler strategy; default "const"
 *                    options: const | probabilistic | ratelimiting | remote
 *   tags           – map of extra tags added to every span
 *
 * @param {object} pipeline  - input / pipeline / output sections as raw YAML strings
 * @param {object} tracer    - jaeger tracer options
 * @returns {string} Complete Redpanda Connect YAML config
 */
function buildJaegerConfig(pipeline, tracer = {}) {
  const agentAddress  = tracer.agentAddress  || process.env.JAEGER_AGENT_ADDRESS  || 'localhost:6831';
  const collectorUrl  = tracer.collectorUrl  || process.env.JAEGER_COLLECTOR_URL  || '';
  const flushInterval = tracer.flushInterval || process.env.JAEGER_FLUSH_INTERVAL || '1s';
  // sampler_param default is 1 (const sampler → sample 100 % of traces)
  const samplerParam  = tracer.samplerParam  !== undefined ? tracer.samplerParam  : 1;
  const samplerType   = tracer.samplerType   || 'const';
  const tags          = tracer.tags          || {};

  // Serialise the tags map into YAML key: value lines
  const tagsYaml = Object.entries(tags)
    .map(([k, v]) => `      ${k}: "${v}"`)
    .join('\n');

  // Only emit collector_url when it is set — if empty the field is omitted
  const collectorLine = collectorUrl ? `\n      collector_url: "${collectorUrl}"` : '';

  return `
# Redpanda Connect pipeline with Jaeger tracer
# https://docs.redpanda.com/redpanda-connect/home/

${pipeline.input || _defaultInput()}

${pipeline.pipeline || _defaultPipeline()}

${pipeline.output || _defaultOutput()}

tracer:
  jaeger:
    agent_address: "${agentAddress}"${collectorLine}
    flush_interval: "${flushInterval}"
    sampler_param: ${samplerParam}
    sampler_type: ${samplerType}
    tags:
${tagsYaml || '      {}'}
`.trimStart();
}

/**
 * Build a Redpanda Connect YAML config string that uses the
 * `open_telemetry_collector` tracer.
 *
 * Documented fields (source: Redpanda Connect tracer docs):
 *   service          – service name reported to the collector (e.g. "my-pipeline")
 *   http             – list of HTTP collector endpoints
 *     address        – endpoint address (e.g. "localhost:4318")
 *     secure         – connect over HTTPS (default false)
 *   grpc             – list of gRPC collector endpoints
 *     address        – endpoint address (e.g. "localhost:4317")
 *     secure         – connect with TLS (default false)
 *   sampling.enabled – enable sampling (default false; requires v4.25.0+)
 *   sampling.ratio   – fraction of traces to sample (0.0 – 1.0)
 *   tags             – map of extra tags added to every span
 *
 * @param {object} pipeline - input / pipeline / output sections as raw YAML strings
 * @param {object} tracer   - otel tracer options
 * @returns {string} Complete Redpanda Connect YAML config
 */
function buildOtelConfig(pipeline, tracer = {}) {
  const service         = tracer.service         || process.env.OTEL_SERVICE_NAME    || 'redpanda-connect';
  const httpAddress     = tracer.httpAddress     || process.env.OTEL_HTTP_ADDRESS     || 'localhost:4318';
  const httpSecure      = tracer.httpSecure      !== undefined ? tracer.httpSecure      : (process.env.OTEL_SECURE === 'true');
  const grpcAddress     = tracer.grpcAddress     || process.env.OTEL_GRPC_ADDRESS     || '';
  const grpcSecure      = tracer.grpcSecure      !== undefined ? tracer.grpcSecure      : (process.env.OTEL_SECURE === 'true');
  const samplingEnabled = tracer.samplingEnabled !== undefined ? tracer.samplingEnabled : (process.env.OTEL_SAMPLING_ENABLED === 'true');
  const samplingRatio   = tracer.samplingRatio   !== undefined ? tracer.samplingRatio   : parseFloat(process.env.OTEL_SAMPLING_RATIO || '1.0');
  const tags            = tracer.tags            || {};

  const tagsYaml = Object.entries(tags)
    .map(([k, v]) => `      ${k}: "${v}"`)
    .join('\n');

  // Only include the grpc block when an address is provided
  const grpcBlock = grpcAddress
    ? `\n    grpc:\n      - address: "${grpcAddress}"\n        secure: ${grpcSecure}`
    : '';

  return `
# Redpanda Connect pipeline with OpenTelemetry Collector tracer
# Requires Redpanda Connect >= 4.25.0 for sampling support
# https://docs.redpanda.com/redpanda-connect/home/

${pipeline.input || _defaultInput()}

${pipeline.pipeline || _defaultPipeline()}

${pipeline.output || _defaultOutput()}

tracer:
  open_telemetry_collector:
    service: "${service}"
    http:
      - address: "${httpAddress}"
        secure: ${httpSecure}${grpcBlock}
    sampling:
      enabled: ${samplingEnabled}
      ratio: ${samplingRatio}
    tags:
${tagsYaml || '      {}'}
`.trimStart();
}

/**
 * Build a Redpanda Connect YAML config with NO tracer (tracing disabled).
 * Useful as a baseline before adding a tracer.
 *
 * @param {object} pipeline - input / pipeline / output sections
 * @returns {string}
 */
function buildNoTracerConfig(pipeline = {}) {
  return `
# Redpanda Connect pipeline – tracing disabled
# https://docs.redpanda.com/redpanda-connect/home/

${pipeline.input || _defaultInput()}

${pipeline.pipeline || _defaultPipeline()}

${pipeline.output || _defaultOutput()}

tracer:
  none: {}
`.trimStart();
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

/**
 * Write a Redpanda Connect YAML config string to disk.
 *
 * @param {string} filePath  - destination path (e.g. "/tmp/connect.yaml")
 * @param {string} yamlStr   - full YAML config string
 */
function writeConfigFile(filePath, yamlStr) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, yamlStr, 'utf8');
    console.log(`[connect] Config written to ${filePath}`);
  } catch (err) {
    throw new Error(`Failed to write config file: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Docker helpers
// ---------------------------------------------------------------------------

/**
 * Pull the Redpanda Connect Docker image.
 *
 * @param {string} image - Docker image reference
 */
function pullImage(image) {
  const img = image || process.env.REDPANDA_CONNECT_IMAGE || 'docker.redpanda.com/redpandadata/connect:latest';
  console.log(`[docker] Pulling ${img} …`);
  try {
    execSync(`docker pull ${img}`, { stdio: 'inherit' });
  } catch (err) {
    throw new Error(`docker pull failed: ${err.message}`);
  }
}

/**
 * Run Redpanda Connect in a Docker container using the provided YAML config.
 *
 * The function:
 *  1. Mounts the config file into the container at /connect/config.yaml
 *  2. Exposes the Redpanda Connect HTTP API port (default 4195)
 *  3. Returns a ChildProcess handle so the caller can later call .kill()
 *
 * ASSUMPTION: Docker daemon is running and accessible.
 * ASSUMPTION: The Redpanda Connect image exposes port 4195 as the HTTP API.
 *
 * @param {string} configPath   - absolute path to the YAML config on the host
 * @param {object} opts
 * @param {string} opts.image   - Docker image (falls back to env / default)
 * @param {number} opts.port    - host port to bind the Connect HTTP API on
 * @param {string} opts.name    - Docker container name
 * @returns {ChildProcess}
 */
function runConnectDocker(configPath, opts = {}) {
  const image    = opts.image || process.env.REDPANDA_CONNECT_IMAGE || 'docker.redpanda.com/redpandadata/connect:latest';
  const port     = opts.port  || parseInt(process.env.CONNECT_HTTP_PORT || '4195', 10);
  const name     = opts.name  || `rp-connect-${Date.now()}`;
  const absPath  = path.resolve(configPath);

  const args = [
    'run', '--rm',
    '--name', name,
    '-v', `${absPath}:/connect/config.yaml:ro`,
    '-p', `${port}:4195`,
    image,
    'run', '/connect/config.yaml',
  ];

  console.log(`[docker] Starting container: docker ${args.join(' ')}`);

  const child = spawn('docker', args, { stdio: 'pipe' });

  child.stdout.on('data', (d) => process.stdout.write(`[connect] ${d}`.replace(/\n/g, '\n[connect] ')));
  child.stderr.on('data', (d) => process.stderr.write(`[connect] ${d}`.replace(/\n/g, '\n[connect] ')));
  child.on('error',  (err) => console.error('[docker] Process error:', err.message));
  child.on('exit',   (code) => code !== 0 && console.warn(`[docker] Container exited with code ${code}`));

  return child;
}

/**
 * Stop and remove a running container by name.
 *
 * @param {string} name - container name passed to runConnectDocker
 */
function stopConnectDocker(name) {
  try {
    execSync(`docker rm -f ${name}`, { stdio: 'ignore' });
    console.log(`[docker] Removed container: ${name}`);
  } catch (_) {
    // Container may already be gone – ignore
  }
}

// ---------------------------------------------------------------------------
// Health-check helper
// ---------------------------------------------------------------------------

/**
 * Ping the Redpanda Connect HTTP API.
 *
 * Redpanda Connect exposes a lightweight HTTP server (default port 4195).
 * GET /ping returns HTTP 200 with body "pong" when the process is ready.
 *
 * ASSUMPTION: /ping endpoint is available on the Redpanda Connect HTTP API.
 *
 * @param {string} host - hostname or IP (default: "localhost")
 * @param {number} port - HTTP API port   (default: 4195)
 * @returns {Promise<{status: number, body: string}>}
 */
function pingConnect(host, port) {
  const h = host || process.env.CONNECT_HOST      || 'localhost';
  const p = port || parseInt(process.env.CONNECT_HTTP_PORT || '4195', 10);

  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: h, port: p, path: '/ping', timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end',  () => resolve({ status: res.statusCode, body: body.trim() }));
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Ping request timed out')); });
  });
}

/**
 * Wait for Redpanda Connect to become healthy, retrying up to `maxAttempts`.
 *
 * @param {string} host
 * @param {number} port
 * @param {number} maxAttempts  - total attempts before giving up (default 20)
 * @param {number} intervalMs   - milliseconds between attempts (default 1500)
 * @returns {Promise<void>}
 */
async function waitForConnect(host, port, maxAttempts = 20, intervalMs = 1500) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const { status, body } = await pingConnect(host, port);
      if (status === 200 && body === 'pong') {
        console.log(`[connect] Healthy after ${i} attempt(s)`);
        return;
      }
      console.log(`[connect] Not ready yet (attempt ${i}/${maxAttempts}): HTTP ${status}`);
    } catch (err) {
      console.log(`[connect] Not ready yet (attempt ${i}/${maxAttempts}): ${err.message}`);
    }
    await _sleep(intervalMs);
  }
  throw new Error(`Redpanda Connect did not become healthy after ${maxAttempts} attempts`);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Minimal stdin input for demo pipelines */
function _defaultInput() {
  return `input:
  generate:
    mapping: 'root = {"event": "trace-demo", "ts": now()}'
    interval: 5s
    count: 0`;
}

/** Identity processor — useful for tracing span demonstration */
function _defaultPipeline() {
  return `pipeline:
  processors:
    - mapping: |
        # Each processor step creates a child tracing span
        root = this
        root.processed_at = now()`;
}

/** stdout output for demo pipelines */
function _defaultOutput() {
  return `output:
  stdout: {}`;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  buildJaegerConfig,
  buildOtelConfig,
  buildNoTracerConfig,
  writeConfigFile,
  pullImage,
  runConnectDocker,
  stopConnectDocker,
  pingConnect,
  waitForConnect,
};
