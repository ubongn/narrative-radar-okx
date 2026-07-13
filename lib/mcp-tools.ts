/**
 * MCP tool surface for NarrativeRadar.
 *
 * Defines the five tools an OKX.AI agent can call, plus a JSON-RPC 2.0
 * dispatcher that implements the Model Context Protocol server flow:
 *
 *   - initialize    → protocol handshake
 *   - tools/list    → advertise available tools
 *   - tools/call    → execute a tool (gated by x402 payment in the route)
 *
 * The route layer (`app/api/mcp/route.ts`) wraps `handleJsonRpc` with x402 so
 * that every `tools/call` costs 0.5 USDT.
 */

import { DEFAULT_EMERGING_LIMIT } from "./config";
import { buildVelocitySeries } from "./physics";
import { mapNarrativeToTokens } from "./tokens";
import { tracker } from "./tracker";
import { phaseDescription } from "./phase";
import type { NarrativeMetrics, Phase } from "./types";

/** JSON Schema for a tool's arguments. */
type JsonSchema = Record<string, unknown>;

/** A callable MCP tool. */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

/** Canonical list advertised via `tools/list`. */
export const MCP_TOOLS: McpTool[] = [
  {
    name: "get_narrative_velocity",
    description:
      "Get the current mention velocity (mentions/hour) and acceleration (mentions/hour²) for a specific crypto narrative, plus its lifecycle phase. Pass a narrative id, slug, or name (e.g. 'ai-agents', 'Memecoins', 'nar_001').",
    inputSchema: {
      type: "object",
      properties: {
        narrative: {
          type: "string",
          description: "Narrative id, slug, or name.",
        },
      },
      required: ["narrative"],
    },
  },
  {
    name: "get_emerging_narratives",
    description:
      "List narratives currently in the 'emerging' or 'accelerating' phase — the earliest actionable signals before a narrative goes viral. Sorted by trend score.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Max number of narratives to return (default 10).",
          minimum: 1,
          maximum: 50,
        },
        phase: {
          type: "string",
          enum: ["emerging", "accelerating"],
          description:
            "Restrict to a single early phase. Omit to include both.",
        },
      },
    },
  },
  {
    name: "map_narrative_to_tokens",
    description:
      "Map a narrative to the tokens most exposed to it. Pass a narrative id, slug, name, or keyword.",
    inputSchema: {
      type: "object",
      properties: {
        narrative: {
          type: "string",
          description: "Narrative id, slug, name, or keyword.",
        },
      },
      required: ["narrative"],
    },
  },
  {
    name: "get_narrative_phase",
    description:
      "Classify a narrative's lifecycle phase (dormant → emerging → accelerating → viral → exhausting) with a confidence score and human-readable rationale.",
    inputSchema: {
      type: "object",
      properties: {
        narrative: {
          type: "string",
          description: "Narrative id, slug, or name.",
        },
      },
      required: ["narrative"],
    },
  },
  {
    name: "get_narrative_history",
    description:
      "Get the recent hourly mention history and derived velocity/acceleration time series for a narrative (last ~72 hours).",
    inputSchema: {
      type: "object",
      properties: {
        narrative: {
          type: "string",
          description: "Narrative id, slug, or name.",
        },
        buckets: {
          type: "integer",
          description: "Number of most-recent hourly buckets to return.",
          minimum: 1,
          maximum: 72,
        },
      },
      required: ["narrative"],
    },
  },
];

// --- Tool implementations ---------------------------------------------------

function requireNarrative(query: string) {
  const n = tracker.get(query);
  if (!n) {
    throw new McpError(
      -32602,
      `Narrative not found: '${query}'. Try a slug like 'ai-agents' or a name like 'Memecoins'.`,
    );
  }
  return n;
}

function tool_getNarrativeVelocity(args: { narrative: string }) {
  const n = requireNarrative(args.narrative);
  const m = tracker.metrics(n);
  return {
    narrative: n.name,
    id: n.id,
    velocityMentionsPerHour: m.velocity,
    accelerationMentionsPerHourSquared: m.acceleration,
    phase: m.phase,
    trendScore: m.trendScore,
  };
}

function tool_getEmergingNarratives(args: {
  limit?: number;
  phase?: Phase;
}) {
  const limit = clamp(args.limit ?? DEFAULT_EMERGING_LIMIT, 1, 50);
  const allowed: Phase[] = args.phase ? [args.phase] : ["emerging", "accelerating"];
  const rows = tracker
    .allMetrics()
    .filter((m) => allowed.includes(m.phase))
    .slice(0, limit)
    .map(serializeSummary);
  return {
    count: rows.length,
    phases: allowed,
    narratives: rows,
  };
}

function tool_mapNarrativeToTokens(args: { narrative: string }) {
  const result = mapNarrativeToTokens(args.narrative, tracker.getAll());
  if (!result) {
    throw new McpError(
      -32602,
      `No token mapping found for '${args.narrative}'.`,
    );
  }
  return result;
}

function tool_getNarrativePhase(args: { narrative: string }) {
  const n = requireNarrative(args.narrative);
  const m = tracker.metrics(n);
  return {
    narrative: n.name,
    id: n.id,
    phase: m.phase,
    confidence: m.confidence,
    description: phaseDescription(m.phase),
    velocityMentionsPerHour: m.velocity,
    accelerationMentionsPerHourSquared: m.acceleration,
  };
}

function tool_getNarrativeHistory(args: {
  narrative: string;
  buckets?: number;
}) {
  const n = requireNarrative(args.narrative);
  const buckets = clamp(args.buckets ?? 72, 1, 72);
  const recent = n.history.slice(-buckets);
  const series = buildVelocitySeries(recent);
  return {
    narrative: n.name,
    id: n.id,
    bucketHours: 1,
    mentions: recent.map((s) => ({ t: s.timestamp, count: s.count })),
    motion: series.map((p) => ({
      t: p.timestamp,
      velocity: p.velocity,
      acceleration: p.acceleration,
    })),
  };
}

// --- JSON-RPC plumbing ------------------------------------------------------

/** Minimal JSON-RPC error with a code + message. */
export class McpError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.name = "McpError";
  }
}

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown> | unknown[];
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = {
  name: "narrativeradar",
  version: "0.1.0",
};
const CAPABILITIES = { tools: { listChanged: false } };

/** Dispatch a single JSON-RPC request to the right handler. */
export function handleJsonRpc(req: JsonRpcRequest): JsonRpcResponse {
  const id = req.id ?? null;

  try {
    switch (req.method) {
      case "initialize":
        return ok(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: CAPABILITIES,
          serverInfo: SERVER_INFO,
        });

      case "initialized":
      case "notifications/initialized":
        return ok(id, {}); // notification — no response expected, but safe

      case "tools/list":
        return ok(id, { tools: MCP_TOOLS });

      case "tools/call": {
        const params = (req.params ?? {}) as {
          name?: string;
          arguments?: Record<string, unknown>;
        };
        const name = params.name;
        const args = (params.arguments ?? {}) as Record<string, unknown>;
        const result = dispatchTool(name, args);
        // MCP returns tool results wrapped in a content array.
        return ok(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
          isError: false,
        });
      }

      default:
        return error(id, -32601, `Method not found: ${req.method}`);
    }
  } catch (e) {
    if (e instanceof McpError) {
      return error(id, e.code, e.message);
    }
    return error(
      id,
      -32603,
      e instanceof Error ? e.message : "Internal error",
    );
  }
}

/** Run a named tool with validated args. */
function dispatchTool(
  name: string | undefined,
  args: Record<string, unknown>,
): unknown {
  switch (name) {
    case "get_narrative_velocity":
      return tool_getNarrativeVelocity({
        narrative: String(args.narrative ?? ""),
      });
    case "get_emerging_narratives":
      return tool_getEmergingNarratives({
        limit: toInt(args.limit),
        phase: args.phase as Phase | undefined,
      });
    case "map_narrative_to_tokens":
      return tool_mapNarrativeToTokens({
        narrative: String(args.narrative ?? ""),
      });
    case "get_narrative_phase":
      return tool_getNarrativePhase({
        narrative: String(args.narrative ?? ""),
      });
    case "get_narrative_history":
      return tool_getNarrativeHistory({
        narrative: String(args.narrative ?? ""),
        buckets: toInt(args.buckets),
      });
    default:
      throw new McpError(-32601, `Unknown tool: ${name ?? "(none)"}`);
  }
}

// --- helpers ----------------------------------------------------------------

function serializeSummary(m: NarrativeMetrics) {
  return {
    name: m.name,
    id: m.id,
    phase: m.phase,
    velocityMentionsPerHour: m.velocity,
    accelerationMentionsPerHourSquared: m.acceleration,
    confidence: m.confidence,
    trendScore: m.trendScore,
    tokens: m.tokens,
  };
}

const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));

function toInt(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

const ok = (id: string | number | null, result: unknown): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  result,
});

const error = (
  id: string | number | null,
  code: number,
  message: string,
): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});
