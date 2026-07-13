/**
 * Shared domain types for NarrativeRadar.
 */

import type { PHASE_ORDER } from "./config";

/** A narrative's position in its hype lifecycle. */
export type Phase = (typeof PHASE_ORDER)[number];

/** A single mention-count sample for one time bucket. */
export interface MentionSample {
  /** Bucket-start epoch milliseconds. */
  timestamp: number;
  /** Number of mentions observed during this bucket. */
  count: number;
}

/** A point on the derived velocity / acceleration curve. */
export interface VelocityPoint {
  /** Bucket-start epoch milliseconds. */
  timestamp: number;
  /** Mentions / hour at this point (smoothed). */
  velocity: number;
  /** Change in velocity, mentions / hour^2. */
  acceleration: number;
}

/** A tracked crypto narrative. */
export interface Narrative {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  /** Chronologically ordered mention samples (oldest first). */
  history: MentionSample[];
  /** Token symbols mapped to this narrative. */
  tokens: string[];
  /** Keyword patterns used to detect mentions (lower-cased). */
  keywords: string[];
}

/** Derived metrics for a narrative at the current moment. */
export interface NarrativeMetrics {
  id: string;
  name: string;
  slug: string;
  category: string;
  /** Mentions / hour (latest, smoothed). */
  velocity: number;
  /** Mentions / hour^2 (latest). */
  acceleration: number;
  /** Third derivative — change in acceleration. */
  jerk: number;
  phase: Phase;
  /** 0..1 confidence in the assigned phase. */
  confidence: number;
  /** Total mentions across retained history. */
  totalMentions: number;
  /** Composite 0..100 score used to rank narratives. */
  trendScore: number;
  /** Epoch ms of the most recent sample. */
  lastUpdated: number;
  tokens: string[];
}
