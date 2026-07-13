/**
 * Lifecycle phase classification.
 *
 * Maps a narrative's motion (velocity / acceleration / jerk) onto a hype
 * lifecycle, so we can alert *before* a narrative goes viral:
 *
 *   dormant → emerging → accelerating → viral → exhausting
 *
 * The aim of NarrativeRadar is to surface narratives while they are
 * `emerging` or `accelerating` — i.e. before `viral`.
 */

import type { Phase } from "./types";

export interface PhaseResult {
  phase: Phase;
  /** 0..1 — how decisively the signal satisfies the phase's thresholds. */
  confidence: number;
  /** Human-readable rationale for the classification. */
  reason: string;
}

// --- Tunable thresholds (mentions / hour, unless noted) ---------------------
const V_DORMANT = 8; // below this a narrative is effectively asleep
const V_EMERGING = 30; // rising chatter
const V_VIRAL = 200; // mainstream attention
const A_WAKE = 2; // mentions/hr^2 — the "speeding up" signal
const A_HOT = 8; // mentions/hr^2 — clearly accelerating
const A_DECAY = -3; // mentions/hr^2 — cooling off

/** Clamp helper. */
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/**
 * Smoothstep-style membership: how strongly `value` has crossed `lo → hi`.
 * Returns 0..1, used to build a blended confidence.
 */
function membership(value: number, lo: number, hi: number): number {
  if (value <= lo) return 0;
  if (value >= hi) return 1;
  const t = (value - lo) / (hi - lo);
  return t * t * (3 - 2 * t);
}

/**
 * Classify a narrative's phase from its motion.
 *
 * @param velocity      latest mentions / hour
 * @param acceleration  latest mentions / hour^2
 * @param jerk          latest change in acceleration
 * @param peakVelocity  highest smoothed velocity seen — exhaustion detector
 */
export function classifyPhase(
  velocity: number,
  acceleration: number,
  jerk: number,
  peakVelocity: number,
): PhaseResult {
  const v = Math.max(velocity, 0);
  const a = acceleration;

  // Exhausting: already famous but losing steam. Detect cooling after a peak.
  if (v >= V_EMERGING && a <= A_DECAY && peakVelocity >= V_VIRAL * 0.6) {
    const conf = clamp(0.55 + membership(-a, 0, 40) * 0.4, 0, 1);
    return {
      phase: "exhausting",
      confidence: round(conf),
      reason: `High base (${Math.round(v)}/hr) but decelerating (${Math.round(a)}/hr²) past its peak of ${Math.round(peakVelocity)}/hr.`,
    };
  }

  // Viral: very high velocity, still rising or only just cresting.
  if (v >= V_VIRAL && a > A_DECAY) {
    const conf = clamp(0.7 + membership(v, V_VIRAL, V_VIRAL * 2.2) * 0.3, 0, 1);
    return {
      phase: "viral",
      confidence: round(conf),
      reason: `Mainstream-level attention (${Math.round(v)}/hr); acceleration ${Math.round(a)}/hr².`,
    };
  }

  // Accelerating: climbing fast. Strong positive acceleration on a real base.
  if (v >= V_EMERGING && a >= A_HOT) {
    const conf = clamp(
      0.6 + membership(a, A_HOT, A_HOT * 3) * 0.3 + (jerk > 0 ? 0.1 : 0),
      0,
      1,
    );
    return {
      phase: "accelerating",
      confidence: round(conf),
      reason: `Velocity ${Math.round(v)}/hr and climbing hard (+${Math.round(a)}/hr²).`,
    };
  }

  // Emerging: waking up. Low-to-moderate base but positive acceleration.
  if (v >= V_DORMANT && a >= A_WAKE) {
    const conf = clamp(0.5 + membership(a, A_WAKE, A_HOT) * 0.4, 0, 1);
    return {
      phase: "emerging",
      confidence: round(conf),
      reason: `Growing from a small base (${Math.round(v)}/hr, +${Math.round(a)}/hr²).`,
    };
  }

  // Dormant: little chatter and not speeding up.
  const conf = clamp(0.6 + (1 - membership(v, 0, V_DORMANT)) * 0.3, 0, 1);
  return {
    phase: "dormant",
    confidence: round(conf),
    reason: `Quiet (${Math.round(v)}/hr) with no meaningful acceleration.`,
  };
}

/** Short, human-readable description for a phase badge. */
export function phaseDescription(phase: Phase): string {
  switch (phase) {
    case "dormant":
      return "Barely any chatter. Not actionable yet.";
    case "emerging":
      return "Mentions rising from a small base — the earliest signal.";
    case "accelerating":
      return "Attention is climbing fast. Prime window to act.";
    case "viral":
      return "Mainstream attention. The move is largely priced in.";
    case "exhausting":
      return "Still loud but losing momentum. Late / risk of reversal.";
  }
}

const round = (x: number) => Math.round(x * 100) / 100;
