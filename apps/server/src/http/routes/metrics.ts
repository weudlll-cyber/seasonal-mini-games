/**
 * @file   apps/server/src/http/routes/metrics.ts
 * @module server/http
 * @brief  Prometheus /metrics: process metrics and the catalogue of 06 §4.6 and Bingo 08 §6.
 *
 * Responsibility: one Registry with the default Node metrics and the platform's own, all
 *                 under `smg_`: guesses by result and their acknowledgement time, the rounds'
 *                 queue depth, batch commit time, special and Frost delivery lag, socket round
 *                 trips (06 §4.6); HTTP requests and their duration, socket connections and
 *                 intents by type and result (Bingo 08 §6). Rounds by status, the queue depth
 *                 and the In Season feed's age are read when Prometheus scrapes. Served to
 *                 scrapers inside the server only: a request that came through a proxy
 *                 (X-Forwarded-For) gets 404, in every install type (audit S8).
 * Depends on:     prom-client, fastify, ../../round/actor (observer type)
 * Used by:        ../app.ts, ../../round/runtime (observer), ../../realtime/* (sockets)
 * Spec:           docs/spec/06-data-model-api-realtime.md §4.6; Bingo 08 §6, Bingo 06 §10
 */
import type { FastifyInstance } from 'fastify';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

import type { RoundObserver } from '../../round/actor.js';

// What the scrape reads from the runtime and the season feed.
export interface MetricSources {
  readonly rounds: () => {
    readonly byStatus: Readonly<Record<string, number>>;
    readonly queued: number;
  };
  readonly feedAgeSeconds: () => Promise<number | null>;
}

export interface MetricsHandle {
  readonly registry: Registry;
  readonly rounds: RoundObserver;
  readonly sockets: {
    connected(delta: 1 | -1): void;
    intent(type: string, result: string): void;
    rtt(seconds: number): void;
  };
  // Connects the scrape-time gauges to their sources once the runtime exists.
  attach(sources: MetricSources): void;
}

const LAG = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5];

function roundMetrics(registry: Registry): RoundObserver {
  const opts = { registers: [registry] };
  const guesses = new Counter({
    name: 'smg_guess_total',
    help: 'Guesses by result code.',
    labelNames: ['result'],
    ...opts,
  });
  const ack = new Histogram({
    name: 'smg_guess_ack_seconds',
    help: 'Receive to acknowledgement of a guess.',
    buckets: LAG,
    ...opts,
  });
  const batch = new Histogram({
    name: 'smg_round_batch_seconds',
    help: 'Commit time of one round batch.',
    buckets: LAG,
    ...opts,
  });
  const special = new Histogram({
    name: 'smg_special_lag_seconds',
    help: 'Due time to run of a round tick.',
    buckets: LAG,
    ...opts,
  });
  const frost = new Histogram({
    name: 'smg_frost_delivery_lag_seconds',
    help: 'Delivery time to release of a Frost answer.',
    buckets: LAG,
    ...opts,
  });
  return {
    guess: (result, seconds) => {
      guesses.inc({ result });
      ack.observe(seconds);
    },
    batch: (s) => {
      batch.observe(s);
    },
    tickLag: (s) => {
      special.observe(s);
    },
    frostLag: (s) => {
      frost.observe(s);
    },
  };
}

// The gauges read when Prometheus scrapes: rounds by status, queue depth, the feed's age.
function scrapeGauges(registry: Registry, source: () => MetricSources | null): void {
  const opts = { registers: [registry] };
  new Gauge({
    name: 'smg_rounds',
    help: 'Rounds in memory by status.',
    labelNames: ['status'],
    ...opts,
    collect() {
      this.reset();
      for (const [status, n] of Object.entries(source()?.rounds().byStatus ?? {}))
        this.set({ status }, n);
    },
  });
  new Gauge({
    name: 'smg_round_queue_depth',
    help: 'Unanswered items in all round queues.',
    ...opts,
    collect() {
      this.set(source()?.rounds().queued ?? 0);
    },
  });
  new Gauge({
    name: 'smg_season_feed_age_seconds',
    help: 'Age of the last good In Season answer (-1: none yet).',
    ...opts,
    async collect() {
      this.set((await source()?.feedAgeSeconds()) ?? -1);
    },
  });
}

export function createMetrics(): MetricsHandle {
  const registry = new Registry();
  // Default Node metrics (CPU, memory, GC, event loop lag) under the "smg_" prefix.
  collectDefaultMetrics({ register: registry, prefix: 'smg_' });
  const opts = { registers: [registry] };
  const connections = new Gauge({
    name: 'smg_ws_connections',
    help: 'Open game sockets.',
    ...opts,
  });
  const intents = new Counter({
    name: 'smg_ws_intents_total',
    help: 'Socket intents by type and result.',
    labelNames: ['type', 'result'],
    ...opts,
  });
  const rtt = new Histogram({
    name: 'smg_ws_rtt_seconds',
    help: 'Socket round trip, as clients measure it at clock sync.',
    buckets: LAG,
    ...opts,
  });
  let sources: MetricSources | null = null;
  scrapeGauges(registry, () => sources);
  return {
    registry,
    rounds: roundMetrics(registry),
    sockets: {
      connected: (delta) => {
        connections.inc(delta);
      },
      intent: (type, result) => {
        intents.inc({ type, result });
      },
      rtt: (s) => {
        rtt.observe(s);
      },
    },
    attach: (s) => {
      sources = s;
    },
  };
}

export function registerMetrics(app: FastifyInstance, metrics: MetricsHandle): void {
  const opts = { registers: [metrics.registry] };
  const requests = new Counter({
    name: 'smg_http_requests_total',
    help: 'HTTP requests by method, route and status.',
    labelNames: ['method', 'route', 'status'],
    ...opts,
  });
  const duration = new Histogram({
    name: 'smg_http_duration_seconds',
    help: 'HTTP request duration.',
    labelNames: ['method'],
    buckets: LAG,
    ...opts,
  });
  // Route patterns, not URLs: a label per match code would grow without end.
  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url ?? 'unmatched';
    requests.inc({ method: request.method, route, status: String(reply.statusCode) });
    duration.observe({ method: request.method }, reply.elapsedTime / 1_000);
  });
  app.get('/metrics', async (request, reply) => {
    // Only for scrapers inside the server: every proxy of ours (Caddy, the website's Caddy,
    // the nginx example) adds X-Forwarded-For, so a request from outside never sees it.
    if (request.headers['x-forwarded-for'] !== undefined) {
      return reply.status(404).send({ code: 'NOT_FOUND' });
    }
    const body = await metrics.registry.metrics();
    return reply.header('content-type', metrics.registry.contentType).send(body);
  });
}
