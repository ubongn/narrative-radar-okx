/**
 * NarrativeRadar — global configuration constants.
 *
 * Centralizes the x402 payment terms, chain config, and tracker defaults so
 * every module (MCP tools, API route, dashboard) reads from one source of truth.
 */

/** Lifecycle phases a narrative moves through, earliest → latest. */
export const PHASE_ORDER = [
  "dormant",
  "emerging",
  "accelerating",
  "viral",
  "exhausting",
] as const;

/** EVM network used for x402 settlement — OKX X Layer mainnet. */
export const PAYMENT_NETWORK = "eip155:196";

/**
 * Revenue wallet that receives x402 payments. All `exact` payments for
 * NarrativeRadar queries settle to this address.
 */
export const REVENUE_WALLET = "0xedcb1bd369a3ad9c940726149622327808816015";

/** Price per MCP query, human readable. */
export const PRICE_PER_QUERY_USD = "$0.50";

/** Price per MCP query in minimal token units (0.5 USDT = 500_000 µ). */
export const PRICE_PER_QUERY_ATOMIC = "500000";

/** USDT on X Layer mainnet (chainId 196). */
export const USDT_XLAYER = "0x3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e";

/** x402 payment scheme — `exact` (single-shot, one price per call). */
export const PAYMENT_SCHEME = "exact" as const;

/** Bucket size for mention sampling. */
export const BUCKET_HOURS = 1;
export const BUCKET_MS = BUCKET_HOURS * 3_600_000;

/** How many historical buckets the tracker retains per narrative. */
export const HISTORY_BUCKETS = 72; // ~3 days of hourly data

/** Smoothing factor for the exponential moving average over velocity. */
export const EMA_ALPHA = 0.35;

/** Top-N emerging narratives returned by default. */
export const DEFAULT_EMERGING_LIMIT = 10;
