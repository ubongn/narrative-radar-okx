/**
 * Narrative mention tracking engine.
 *
 * Holds the in-memory store of narratives + their mention history and derives
 * current metrics (velocity / acceleration / phase / trend score) for each.
 *
 * On cold start the store is seeded with deterministic synthetic history so the
 * product is fully functional out of the box. Phase 2 swaps `collect()` for a
 * real collector (social feeds / on-chain) and runs it on the cron schedule.
 */

import cron from "node-cron";

import { BUCKET_MS, HISTORY_BUCKETS } from "./config";
import { buildCatalog, seedShapes } from "./tokens";
import type {
  MentionSample,
  Narrative,
  NarrativeMetrics,
} from "./types";
import {
  latestAcceleration,
  latestJerk,
  latestVelocity,
  peakVelocity,
  totalMentions,
  trendScore,
} from "./physics";
import { classifyPhase } from "./phase";

/** Deterministic PRNG so the same seed always yields the same demo curves. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** String → 32-bit integer hash (for seeding the PRNG from a narrative id). */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Shape function: returns a multiplier 0..1 for how "hot" the narrative is at
 * progress `t` (0 = start of history, 1 = now), per the seed shape.
 */
function shapeAt(shape: string, t: number): number {
  switch (shape) {
    case "dormant":
      return 0.15 + 0.05 * Math.sin(t * Math.PI * 4);
    case "emerging":
      // slow exponential ramp
      return 0.12 + 0.78 * Math.pow(t, 2.2);
    case "accelerating":
      // late, sharp ramp
      return 0.1 + 0.9 * Math.pow(t, 3.4);
    case "viral":
      // explosive then plateau
      return t < 0.7 ? Math.pow(t / 0.7, 0.45) : 1 - 0.12 * (t - 0.7) / 0.3;
    case "exhausting":
      // rise to a peak then decay
      return t < 0.5 ? Math.pow(t / 0.5, 0.6) : Math.pow(1 - (t - 0.5) / 0.5, 1.4) * 0.85 + 0.15;
    default:
      return 0.2;
  }
}

/** Generate deterministic synthetic history for a narrative. */
function synthesizeHistory(
  id: string,
  shape: string,
  base: number,
  amplitude: number,
): MentionSample[] {
  const rnd = mulberry32(hashString(id));
  const now = Date.now();
  // anchor "now" to the current hour bucket
  const bucketStart = now - (now % BUCKET_MS);
  const samples: MentionSample[] = [];
  for (let i = HISTORY_BUCKETS - 1; i >= 0; i--) {
    const t = 1 - i / (HISTORY_BUCKETS - 1); // 0 → 1 across the window
    const level = base + amplitude * shapeAt(shape, t);
    const noise = (rnd() - 0.5) * level * 0.25;
    const count = Math.max(0, Math.round(level + noise));
    samples.push({ timestamp: bucketStart - i * BUCKET_MS, count });
  }
  return samples;
}

class NarrativeTracker {
  private narratives: Narrative[] = [];
  private cronTask: cron.ScheduledTask | null = null;

  constructor() {
    this.seed();
  }

  /** Seed the store with the catalog + synthetic history. */
  seed(): void {
    const shapes = seedShapes();
    this.narratives = buildCatalog().map((n) => {
      const s = shapes[n.id];
      return {
        ...n,
        history: synthesizeHistory(n.id, s.shape, s.base, s.amplitude),
      };
    });
  }

  /** All narratives with their raw history. */
  getAll(): Narrative[] {
    return this.narratives;
  }

  /** A single narrative by id / slug / name. */
  get(query: string): Narrative | undefined {
    const q = query.trim().toLowerCase();
    return (
      this.narratives.find((n) => n.id.toLowerCase() === q) ??
      this.narratives.find((n) => n.slug === q) ??
      this.narratives.find((n) => n.name.toLowerCase() === q) ??
      this.narratives.find((n) => n.keywords.some((k) => k.includes(q)))
    );
  }

  /** Derive current metrics for a narrative. */
  metrics(n: Narrative): NarrativeMetrics {
    const velocity = latestVelocity(n.history);
    const acceleration = latestAcceleration(n.history);
    const jerk = latestJerk(n.history);
    const peak = peakVelocity(n.history);
    const { phase, confidence, reason } = classifyPhase(
      velocity,
      acceleration,
      jerk,
      peak,
    );
    return {
      id: n.id,
      name: n.name,
      slug: n.slug,
      category: n.category,
      velocity: round(velocity),
      acceleration: round(acceleration),
      jerk: round(jerk),
      phase,
      confidence,
      totalMentions: totalMentions(n.history),
      trendScore: trendScore(velocity, acceleration, peak),
      lastUpdated: n.history.length
        ? n.history[n.history.length - 1].timestamp
        : Date.now(),
      tokens: n.tokens,
      // reason kept out of the typed contract; exposed via phase rationale tool
      ...(reason ? {} : {}),
    } as NarrativeMetrics;
  }

  /** Metrics for every narrative, sorted by trend score descending. */
  allMetrics(): NarrativeMetrics[] {
    return this.narratives
      .map((n) => this.metrics(n))
      .sort((a, b) => b.trendScore - a.trendScore);
  }

  /**
   * Add mentions observed since the last bucket. In production the collector
   * calls this; for the scaffold it is exercised by `tick()`.
   */
  recordMentions(id: string, count: number): void {
    const n = this.narratives.find((x) => x.id === id);
    if (!n) return;
    const now = Date.now();
    const bucketStart = now - (now % BUCKET_MS);
    const last = n.history[n.history.length - 1];
    if (last && last.timestamp === bucketStart) {
      last.count += count;
    } else {
      n.history.push({ timestamp: bucketStart, count });
      // trim to the rolling window
      if (n.history.length > HISTORY_BUCKETS) n.history.shift();
    }
  }

  /**
   * Advance the store by one bucket — appends a fresh (near-zero) sample so the
   * next collection cycle has a place to accumulate into.
   */
  tick(): void {
    const now = Date.now();
    const bucketStart = now - (now % BUCKET_MS);
    for (const n of this.narratives) {
      const last = n.history[n.history.length - 1];
      if (!last || last.timestamp < bucketStart) {
        n.history.push({ timestamp: bucketStart, count: 0 });
        if (n.history.length > HISTORY_BUCKETS) n.history.shift();
      }
    }
  }

  /**
   * Start the background collector on a cron schedule.
   *
   * NOTE: long-lived schedulers only make sense on a persistent server. On
   * Vercel serverless this is effectively a no-op (the process recycles between
   * invocations); Phase 2 moves collection onto a cron-triggered route.
   *
   * @param expression cron expression, default every hour on the hour.
   */
  startBackgroundCollection(expression = "0 * * * *"): cron.ScheduledTask | null {
    if (this.cronTask) return this.cronTask;
    try {
      this.cronTask = cron.schedule(expression, () => {
        this.tick();
        // Phase 2: collect() from real feeds here, then recordMentions().
      });
      return this.cronTask;
    } catch {
      return null;
    }
  }

  stopBackgroundCollection(): void {
    this.cronTask?.stop();
    this.cronTask = null;
  }
}

const round = (x: number) => Math.round(x * 100) / 100;

/**
 * Process-wide singleton. Module-level singletons are safe to read in API
 * routes; each serverless invocation re-seeds deterministically.
 */
export const tracker = new NarrativeTracker();
