/**
 * Narrative catalog & narrative-to-token mapping.
 *
 * This is the curated knowledge base NarrativeRadar reasons over. Each entry
 * defines a narrative, the keywords used to detect mentions, and the tokens
 * most exposed to it. Phase 2 will refresh this from on-chain / feed data; the
 * static catalog keeps the product fully functional for the scaffold and demo.
 */

import type { Narrative } from "./types";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

interface NarrativeSeed {
  name: string;
  category: string;
  description: string;
  tokens: string[];
  keywords: string[];
  /**
   * Shape of synthetic history so demo charts look realistic:
   *  - "dormant"    flat low
   *  - "emerging"   slow ramp
   *  - "accelerating" sharp ramp into a climb
   *  - "viral"      explosive then plateau
   *  - "exhausting" peak then decay
   */
  shape: "dormant" | "emerging" | "accelerating" | "viral" | "exhausting";
  base: number; // baseline mentions/hr
  amplitude: number; // peak additional mentions/hr
}

const SEEDS: NarrativeSeed[] = [
  {
    name: "AI Agents",
    category: "AI",
    description:
      "Autonomous on-chain agents that trade, post, and manage treasuries without human prompting.",
    tokens: ["VIRTUAL", "AI16Z", "GOAT", "GRIFT"],
    keywords: ["ai agent", "ai16z", "virtual", "autonomous agent", "agent protocol"],
    shape: "accelerating",
    base: 300,
    amplitude: 2200,
  },
  {
    name: "DePIN",
    category: "Infrastructure",
    description:
      "Decentralized physical infrastructure networks — storage, compute, wireless, sensors.",
    tokens: ["FIL", "AR", "HNT", "RNDR"],
    keywords: ["depin", "decentralized infrastructure", "helium", "render network"],
    shape: "emerging",
    base: 120,
    amplitude: 700,
  },
  {
    name: "Real World Assets",
    category: "DeFi",
    description:
      "Tokenized treasuries, credit, and private equity bringing off-chain yield on-chain.",
    tokens: ["ONDO", "PENDLE", "RIO"],
    keywords: ["rwa", "real world asset", "tokenized treasury", "ondo"],
    shape: "emerging",
    base: 180,
    amplitude: 900,
  },
  {
    name: "Memecoins",
    category: "Culture",
    description:
      "Community-driven tokens with no fundamental cash flows, moving purely on attention.",
    tokens: ["WIF", "BONK", "PEPE", "POPCAT"],
    keywords: ["memecoin", "pepe", "wif", "bonk", "dogwifhat"],
    shape: "viral",
    base: 800,
    amplitude: 4000,
  },
  {
    name: "Restaking",
    category: "DeFi",
    description:
      "Re-hypothecating staked ETH to secure additional Actively Validated Services.",
    tokens: ["EIGEN", "ETHFI", "RETH"],
    keywords: ["restaking", "eigenlayer", "avs", "ether.fi"],
    shape: "exhausting",
    base: 400,
    amplitude: 1600,
  },
  {
    name: "Bitcoin L2 & Runes",
    category: "Bitcoin",
    description:
      "Rollups, sidechains, and the Runes fungible protocol extending Bitcoin's utility.",
    tokens: ["ORDI", "SATS", "STX"],
    keywords: ["runes", "bitcoin l2", "ordi", "brc20", "stacks"],
    shape: "dormant",
    base: 80,
    amplitude: 300,
  },
  {
    name: "Solana DeFi",
    category: "Layer 1",
    description:
      "High-throughput DeFi and perp venues built on Solana.",
    tokens: ["JUP", "JTO", "PYTH"],
    keywords: ["solana defi", "jupiter", "jito", "pyth"],
    shape: "accelerating",
    base: 250,
    amplitude: 1300,
  },
  {
    name: "Modular Blockchains",
    category: "Infrastructure",
    description:
      "Separating execution, settlement, consensus, and data availability into composable layers.",
    tokens: ["TIA", "DYM", "MANTA"],
    keywords: ["modular", "celestia", "data availability", "dymension"],
    shape: "dormant",
    base: 100,
    amplitude: 400,
  },
  {
    name: "ZK & Privacy",
    category: "Infrastructure",
    description:
      "Zero-knowledge proofs for scaling and privacy-preserving applications.",
    tokens: ["POL", "ZK", "MINA"],
    keywords: ["zk", "zero knowledge", "polygon zk", "mina"],
    shape: "emerging",
    base: 140,
    amplitude: 600,
  },
  {
    name: "PayFi & Stablecoins",
    category: "Payments",
    description:
      "On-chain payment financing and stablecoin-based settlement rails.",
    tokens: ["USDC", "USDT", "PYUSD"],
    keywords: ["payfi", "stablecoin payments", "usdc", "pyusd"],
    shape: "accelerating",
    base: 220,
    amplitude: 1100,
  },
];

/** Build the full Narrative catalog (history is filled in by the tracker). */
export function buildCatalog(): Narrative[] {
  return SEEDS.map((s, i) => ({
    id: `nar_${(i + 1).toString().padStart(3, "0")}`,
    name: s.name,
    slug: slugify(s.name),
    category: s.category,
    description: s.description,
    tokens: s.tokens,
    keywords: s.keywords,
    history: [],
  }));
}

/** Expose the raw seed shapes so the synthetic-history generator can use them. */
export function seedShapes(): Record<string, NarrativeSeed> {
  const map: Record<string, NarrativeSeed> = {};
  SEEDS.forEach((s, i) => {
    map[`nar_${(i + 1).toString().padStart(3, "0")}`] = s;
  });
  return map;
}

/**
 * Map a narrative (by id, slug, or name) to its representative tokens.
 * Tolerant matching so MCP callers can pass any reasonable identifier.
 */
export function mapNarrativeToTokens(
  query: string,
  catalog: Narrative[],
): { narrative: string; tokens: string[] } | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const match =
    catalog.find((n) => n.id.toLowerCase() === q) ??
    catalog.find((n) => n.slug === q) ??
    catalog.find((n) => n.name.toLowerCase() === q) ??
    catalog.find((n) => n.keywords.some((k) => k.includes(q))) ??
    catalog.find((n) => n.name.toLowerCase().includes(q));
  if (!match) return null;
  return { narrative: match.name, tokens: match.tokens };
}
