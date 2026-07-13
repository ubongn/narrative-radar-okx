# NarrativeRadar 📡

> **Catch the crypto narrative before it explodes.**

NarrativeRadar is an **Agent Service Provider (ASP)** for the [OKX.AI](https://okx.ai) marketplace. It tracks crypto narrative mention velocity and acceleration across social data sources, then fires alerts on narratives that are **emerging** or **accelerating** — before they go viral.

Other AI agents query NarrativeRadar via the MCP (Model Context Protocol) and pay per-call using the x402 payment protocol on OKX X Layer.

---

## Why NarrativeRadar?

Most "trending" tools tell you what's *already* viral. That's too late — the alpha is gone. NarrativeRadar detects **acceleration**: narratives whose mention velocity is increasing exponentially but haven't peaked yet. Think of it as a radar for narrative motion physics.

| What others do | What NarrativeRadar does |
|---|---|
| "X is trending now" 🔥 | "X is accelerating 3.2× — 2 days from peak" 📈 |

---

## How It Works

### Narrative Motion Physics

NarrativeRadar treats mention counts as a physics problem:

- **Position** = raw mention count per time bucket
- **Velocity** = first derivative (mentions/hour) — how fast mentions are growing
- **Acceleration** = second derivative (mentions/hour²) — is growth speeding up or slowing down?
- **Jerk** = third derivative — detecting momentum shifts

All metrics are smoothed with an **exponential moving average (EMA)** to filter noise and reveal true signal.

### Lifecycle Phase Classification

Each narrative is classified into one of five lifecycle phases:

```
dormant → emerging → accelerating → viral → exhausting
```

| Phase | Condition | Action |
|---|---|---|
| **Dormant** | Velocity below baseline | No signal — not interesting yet |
| **Emerging** | Velocity > baseline, acceleration > 0 | 🟡 Watch — momentum building |
| **Accelerating** | Acceleration > 2× recent average | 🟠 Alert — window closing fast |
| **Viral** | Velocity > 90th percentile historical | 🔴 Peak — alpha mostly captured |
| **Exhausting** | Velocity declining after viral phase | ⚫ Late — avoid FOMO entry |

NarrativeRadar fires alerts **only** on `emerging` and `accelerating` phases — that's where the alpha lives.

### Narrative-to-Token Mapping

Each narrative is mapped to its associated tokens, so when a narrative accelerates you know exactly which tokens to watch:

| Narrative | Example Tokens |
|---|---|
| AI Agents | FET, AUTOMATA, OLAS, VIRTUAL |
| RWA | ONDO, RIO, TOKEN, PROP |
| DePIN | DEPIN, FIL, AR, IOTX |
| Restaking | ETHFI, EIGEN, PUFFER |
| Memecoins | PEPE, WIF, BONK, FLOKI |
| ... | *(extensible)* |

---

## MCP Tools

NarrativeRadar exposes 5 MCP tools, callable via `POST /api/mcp`:

### `get_narrative_velocity`
Returns all tracked narratives ranked by acceleration (highest first).

```json
{
  "tool": "get_narrative_velocity",
  "arguments": {}
}
```

### `get_emerging_narratives`
Returns only narratives currently in `emerging` or `accelerating` phase.

```json
{
  "tool": "get_emerging_narratives",
  "arguments": { "limit": 10 }
}
```

### `map_narrative_to_tokens`
Maps a narrative topic to its associated tokens.

```json
{
  "tool": "map_narrative_to_tokens",
  "arguments": { "topic": "AI Agents" }
}
```

### `get_narrative_phase`
Returns the current lifecycle phase + time-to-peak estimate for a narrative.

```json
{
  "tool": "get_narrative_phase",
  "arguments": { "topic": "RWA" }
}
```

### `get_narrative_history`
Returns historical velocity/acceleration chart data for a narrative.

```json
{
  "tool": "get_narrative_history",
  "arguments": { "topic": "DePIN", "days": 3 }
}
```

---

## x402 Payment

Each MCP query costs **0.5 USDT** settled on **OKX X Layer** (chain ID 196) via the x402 Agent Payments Protocol.

| Property | Value |
|---|---|
| Payment scheme | `exact` (single-shot per call) |
| Price | $0.50 USDT0 |
| Network | `eip155:196` (X Layer) |
| Settlement token | USDT0 (`0x779ded0c9e1022225f8e0630b35a9b54be713736`) |
| Revenue wallet | `0xedcb1bd369a3ad9c940726149622327808816015` |

**Open mode:** When `OKX_API_KEY` / `OKX_SECRET_KEY` / `OKX_PASSPHRASE` are not set, the server runs in open mode (no payment enforcement) — useful for local development and testing. Set these env vars in production to enable x402 payment gating.

### Self-check

```bash
# Free discovery (no payment needed)
curl -i https://narrative-radar-okx.vercel.app/api/mcp

# Paid query — returns HTTP 402 without payment
curl -i -X POST https://narrative-radar-okx.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool": "get_emerging_narratives", "arguments": {}}'
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   NarrativeRadar                      │
│                                                       │
│  ┌─────────────┐   ┌──────────────┐   ┌───────────┐ │
│  │  Tracker     │──▶│   Physics    │──▶│  Phase    │ │
│  │  (mentions)  │   │  (velocity,  │   │ Classifier│ │
│  │              │   │   accel,     │   │           │ │
│  │  cron-based  │   │   jerk, EMA) │   │           │ │
│  └─────────────┘   └──────────────┘   └─────┬─────┘ │
│                                               │       │
│  ┌───────────────────────────────────────────▼─────┐ │
│  │              MCP Tool Layer                      │ │
│  │  get_narrative_velocity · get_emerging_narratives│ │
│  │  map_narrative_to_tokens · get_narrative_phase   │ │
│  │  get_narrative_history                           │ │
│  └───────────────────────┬─────────────────────────┘ │
│                          │                            │
│  ┌───────────────────────▼─────────────────────────┐ │
│  │           x402 Payment Gateway                   │ │
│  │  0.5 USDT per query · X Layer · exact scheme     │ │
│  └───────────────────────┬─────────────────────────┘ │
│                          │                            │
│                    POST /api/mcp                      │
└──────────────────────────┼────────────────────────────┘
                           │
                    AI Agent Client
                    (pays & queries)
```

### Tech Stack

- **Next.js 16** (App Router) — dashboard + API routes
- **TypeScript** — end-to-end type safety
- **OKX x402 SDK** (`@okxweb3/x402-next`, `x402-evm`, `x402-core`) — pay-per-call billing
- **node-cron** — scheduled data collection
- **Recharts / Chart.js** — velocity visualization
- **Vercel** — deployment platform

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
git clone https://github.com/ubongn/narrative-radar-okx.git
cd narrative-radar-okx
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

### Environment Variables

```env
# Optional: Enable x402 payment enforcement (leave empty for open/dev mode)
OKX_API_KEY=your_okx_api_key
OKX_SECRET_KEY=your_okx_secret_key
OKX_PASSPHRASE=your_okx_passphrase

# Optional: LLM-enhanced narrative summaries (falls back to raw metrics)
LLM_API_KEY=your_llm_api_key
```

---

## Deployment

NarrativeRadar is deployed on **Vercel**:

- Dashboard: [https://narrative-radar-okx.vercel.app](https://narrative-radar-okx.vercel.app)
- MCP endpoint: `https://narrative-radar-okx.vercel.app/api/mcp`

---

## Project Structure

```
narrative-radar-okx/
├── app/
│   ├── api/mcp/route.ts    # x402-gated MCP endpoint
│   ├── page.tsx            # Landing page
│   ├── globals.css         # Light theme styles
│   └── layout.tsx          # Root layout
├── lib/
│   ├── config.ts           # Payment terms, chain, constants
│   ├── physics.ts          # Velocity / acceleration / EMA engine
│   ├── phase.ts            # Lifecycle phase classifier
│   ├── tracker.ts          # Narrative mention tracker + cron
│   ├── tokens.ts           # Narrative → token mapping
│   ├── mcp-tools.ts        # MCP tool definitions + JSON-RPC dispatch
│   └── types.ts            # TypeScript interfaces
├── package.json
└── README.md
```

---

## License

MIT © 2026 [ubongn](https://github.com/ubongn)
