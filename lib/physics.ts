/**
 * Physics engine — derives motion of narrative attention over time.
 *
 * Mentions are a position. Velocity is the first derivative (mentions / hour),
 * acceleration the second (mentions / hour^2), jerk the third. We compute these
 * with finite differences and an exponential moving average to tame noise.
 */

import { EMA_ALPHA } from "./config";
import type { MentionSample, VelocityPoint } from "./types";

const HOUR_MS = 3_600_000;

/** Smooth a series with an exponential moving average. */
export function ema(values: number[], alpha = EMA_ALPHA): number[] {
  if (values.length === 0) return [];
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * alpha + out[i - 1] * (1 - alpha));
  }
  return out;
}

/**
 * Raw instantaneous velocity between consecutive samples.
 * Because buckets are regular (1h), dt is effectively 1, but we compute it
 * defensively against accidental gaps.
 */
export function rawVelocity(samples: MentionSample[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const dt = Math.max(
      (samples[i].timestamp - samples[i - 1].timestamp) / HOUR_MS,
      1e-6,
    );
    out.push((samples[i].count - samples[i - 1].count) / dt);
  }
  return out;
}

/** Derivative of a uniformly-sampled series (per hour). */
function diff(series: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) {
    out.push(series[i] - series[i - 1]);
  }
  return out;
}

/** Build a full velocity / acceleration time series from raw samples. */
export function buildVelocitySeries(samples: MentionSample[]): VelocityPoint[] {
  if (samples.length < 2) return [];
  const vSmooth = ema(rawVelocity(samples));
  const aRaw = diff(vSmooth);
  const points: VelocityPoint[] = [];
  for (let i = 0; i < vSmooth.length; i++) {
    points.push({
      timestamp: samples[i + 1].timestamp,
      velocity: Math.round(vSmooth[i] * 100) / 100,
      acceleration: i > 0 ? Math.round(aRaw[i - 1] * 100) / 100 : 0,
    });
  }
  return points;
}

/** Latest smoothed velocity (mentions / hour). */
export function latestVelocity(samples: MentionSample[]): number {
  const v = ema(rawVelocity(samples));
  return v.length ? v[v.length - 1] : 0;
}

/** Latest acceleration (mentions / hour^2). */
export function latestAcceleration(samples: MentionSample[]): number {
  const v = ema(rawVelocity(samples));
  const a = diff(v);
  return a.length ? a[a.length - 1] : 0;
}

/** Latest jerk — second derivative of velocity. */
export function latestJerk(samples: MentionSample[]): number {
  const v = ema(rawVelocity(samples));
  const a = diff(v);
  const j = diff(a);
  return j.length ? j[j.length - 1] : 0;
}

/** Peak smoothed velocity across the series — used to detect exhaustion. */
export function peakVelocity(samples: MentionSample[]): number {
  const v = ema(rawVelocity(samples));
  return v.reduce((max, x) => (x > max ? x : max), 0);
}

/** Sum of all mention counts. */
export function totalMentions(samples: MentionSample[]): number {
  return samples.reduce((sum, s) => sum + s.count, 0);
}

/**
 * Composite trend score 0..100 blending momentum and acceleration, so a
 * narrative that is both fast AND speeding up ranks highest.
 */
export function trendScore(
  velocity: number,
  acceleration: number,
  peak: number,
): number {
  const vPart = Math.min(velocity / 250, 1) * 60;
  const aPart = Math.min(Math.max(acceleration, 0) / 60, 1) * 30;
  const noveltyPart = peak > 0 ? Math.min(velocity / (peak || 1), 1) * 10 : 10;
  return Math.round((vPart + aPart + noveltyPart) * 10) / 10;
}
