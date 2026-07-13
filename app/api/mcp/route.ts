/**
 * MCP endpoint — the paid agent surface for NarrativeRadar.
 *
 *   GET  /api/mcp   → free discovery (server info + tool list)
 *   POST /api/mcp   → JSON-RPC 2.0 over HTTP, gated by x402 payment
 *
 * Each POST costs 0.5 USDT (exact scheme) settled to the revenue wallet on
 * OKX X Layer via the OKX Agent Payments Protocol.
 *
 * Payment enforcement has two modes:
 *   1. Full facilitator mode — when OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE
 *      are present, uses withX402 for verify + settle via OKX backend.
 *   2. Standalone mode — when facilitator creds are absent, returns a proper
 *      x402 v2 402 challenge. Payment proofs are accepted without verification.
 *      This makes the endpoint a valid x402 service for OKX marketplace listing.
 */

import { NextResponse, type NextRequest } from "next/server";
import { withX402, x402ResourceServer } from "@okxweb3/x402-next";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";

import {
  PAYMENT_NETWORK,
  PAYMENT_SCHEME,
  PRICE_PER_QUERY_USD,
  PRICE_PER_QUERY_ATOMIC,
  REVENUE_WALLET,
  USDT_XLAYER,
} from "@/lib/config";
import { handleJsonRpc, MCP_TOOLS, type JsonRpcRequest } from "@/lib/mcp-tools";

export const runtime = "nodejs";
export const maxDuration = 60;

// --- x402 payment server ----------------------------------------------------
const okxApiKey = process.env.OKX_API_KEY ?? "";
const okxSecretKey = process.env.OKX_SECRET_KEY ?? "";
const okxPassphrase = process.env.OKX_PASSPHRASE ?? "";

/** Payment is only enforced when OKX facilitator credentials are configured. */
export const PAYMENT_ENABLED = Boolean(
  okxApiKey && okxSecretKey && okxPassphrase,
);

const facilitator = new OKXFacilitatorClient({
  apiKey: okxApiKey,
  secretKey: okxSecretKey,
  passphrase: okxPassphrase,
  syncSettle: true,
});

const resourceServer = new x402ResourceServer(facilitator);
resourceServer.register(PAYMENT_NETWORK, new ExactEvmScheme());

/** x402 route config — 0.5 USDT per call, exact scheme, X Layer. */
const ROUTE_CONFIG = {
  accepts: {
    scheme: PAYMENT_SCHEME,
    payTo: REVENUE_WALLET,
    price: PRICE_PER_QUERY_USD,
    network: PAYMENT_NETWORK as `${string}:${string}`,
  },
  description:
    "NarrativeRadar MCP — one paid query returns crypto narrative velocity, lifecycle phase, and token mapping.",
  mimeType: "application/json",
};

const MAX_TIMEOUT = 60;

// --- Standalone x402 402 challenge builder ----------------------------------
function buildPaymentRequired(requestUrl: string) {
  return {
    x402Version: 2 as const,
    error: "Payment required",
    resource: {
      url: requestUrl,
      description: ROUTE_CONFIG.description,
      mimeType: ROUTE_CONFIG.mimeType,
    },
    accepts: [
      {
        scheme: PAYMENT_SCHEME,
        network: PAYMENT_NETWORK,
        asset: USDT_XLAYER,
        amount: PRICE_PER_QUERY_ATOMIC,
        payTo: REVENUE_WALLET,
        maxTimeoutSeconds: MAX_TIMEOUT,
        extra: {
          name: "USD₮0",
          version: "1",
        },
      },
    ],
  };
}

function safeBase64Encode(data: string): string {
  const bytes = new TextEncoder().encode(data);
  const binaryString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  if (typeof globalThis !== "undefined" && typeof globalThis.btoa === "function") {
    return globalThis.btoa(binaryString);
  }
  return Buffer.from(data, "utf8").toString("base64");
}

// --- the protected resource: JSON-RPC dispatch ------------------------------
async function mcpHandler(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: invalid JSON" },
      },
      { status: 400 },
    );
  }

  // JSON-RPC batch request → respond to each.
  if (Array.isArray(body)) {
    const responses = body
      .map((entry) =>
        handleJsonRpc(entry as JsonRpcRequest),
      )
      // drop notifications that produced a null-ish id-less no-op
      .filter((r) => r.result !== undefined || r.error !== undefined);
    return NextResponse.json(responses);
  }

  const response = handleJsonRpc(body as JsonRpcRequest);
  return NextResponse.json(response);
}

// Wrap with x402 only when credentials are present; syncFacilitatorOnStart
// disabled so construction never makes a network call.
const paidHandler = PAYMENT_ENABLED
  ? withX402(
      mcpHandler,
      ROUTE_CONFIG,
      resourceServer,
      undefined,
      undefined,
      false,
    )
  : null;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (paidHandler) {
    return paidHandler(request);
  }

  // ─── Standalone x402 mode ────────────────────────────────────────────────
  // No facilitator creds → enforce 402 challenge manually.
  // If client provides a PAYMENT-SIGNATURE header, accept without verification
  // (demo/trust mode). Otherwise return a proper x402 v2 402 challenge.
  const paymentSignature = request.headers.get("PAYMENT-SIGNATURE");

  if (!paymentSignature) {
    const paymentRequired = buildPaymentRequired(request.url);
    const encoded = safeBase64Encode(JSON.stringify(paymentRequired));

    const response = NextResponse.json(paymentRequired, { status: 402 });
    response.headers.set("PAYMENT-REQUIRED", encoded);
    response.headers.set("Content-Type", "application/json");
    return response;
  }

  // Payment proof present → process the request (trust mode)
  const response = await mcpHandler(request);
  response.headers.set("X-NarrativeRadar-Payment", "standalone-trust-mode");
  return response;
}

// --- free discovery ---------------------------------------------------------
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: "NarrativeRadar",
    description:
      "Catch the crypto narrative before it explodes. MCP server with x402 pay-per-query.",
    protocolVersion: "2025-06-18",
    pricing: {
      scheme: PAYMENT_SCHEME,
      price: PRICE_PER_QUERY_USD,
      network: PAYMENT_NETWORK,
      payTo: REVENUE_WALLET,
      paymentEnabled: PAYMENT_ENABLED,
    },
    endpoint: {
      jsonrpc: "POST /api/mcp",
      discovery: "GET /api/mcp",
    },
    tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
  });
}
