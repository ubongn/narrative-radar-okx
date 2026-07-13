/**
 * NarrativeRadar — Landing Page
 * Server component, pulls live data from the tracker.
 */

import { tracker } from "@/lib/tracker";
import { PHASE_ORDER } from "@/lib/config";
import type { NarrativeMetrics } from "@/lib/types";

// ─── helpers ────────────────────────────────────────────────────────────────

const PHASE_STYLES: Record<string, { bg: string; text: string; emoji: string }> = {
  dormant:      { bg: "var(--gray-100)",  text: "var(--gray-600)", emoji: "⚫" },
  emerging:    { bg: "var(--green-50)",   text: "var(--green-600)", emoji: "🟢" },
  accelerating:{ bg: "var(--orange-50)",  text: "var(--orange-600)", emoji: "🟠" },
  viral:       { bg: "var(--red-50)",     text: "var(--red-500)", emoji: "🔴" },
  exhausting:  { bg: "var(--gray-100)",   text: "var(--gray-500)", emoji: "⚫" },
};

function PhaseBadge({ phase }: { phase: string }) {
  const s = PHASE_STYLES[phase] ?? PHASE_STYLES.dormant;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        background: s.bg,
        color: s.text,
        padding: "2px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 600,
      }}
    >
      {s.emoji} {phase}
    </span>
  );
}

function VelocityBar({ velocity, max }: { velocity: number; max: number }) {
  const pct = max > 0 ? Math.min((velocity / max) * 100, 100) : 0;
  return (
    <div style={{ width: "80px", height: "6px", background: "var(--gray-100)", borderRadius: "3px", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: "var(--blue-500)", borderRadius: "3px" }} />
    </div>
  );
}

// ─── page ───────────────────────────────────────────────────────────────────

export default function Home() {
  const allMetrics = tracker.allMetrics();
  const emerging = allMetrics
    .filter((m) => m.phase === "emerging" || m.phase === "accelerating")
    .sort((a, b) => b.trendScore - a.trendScore);

  const topByVelocity = [...allMetrics].sort((a, b) => b.velocity - a.velocity).slice(0, 8);
  const maxVelocity = Math.max(...allMetrics.map((m) => m.velocity), 1);

  const tools = [
    { name: "get_narrative_velocity", desc: "All narratives ranked by acceleration" },
    { name: "get_emerging_narratives", desc: "Only narratives in emerging or accelerating phase" },
    { name: "map_narrative_to_tokens", desc: "Tokens associated with a narrative" },
    { name: "get_narrative_phase", desc: "Lifecycle phase + time-to-peak estimate" },
    { name: "get_narrative_history", desc: "Historical velocity chart data" },
  ];

  const lifecycle = [
    { phase: "Dormant", desc: "Below baseline — not interesting yet", color: "var(--gray-400)" },
    { phase: "Emerging", desc: "Velocity rising — momentum building", color: "var(--green-500)" },
    { phase: "Accelerating", desc: "Growth speeding up — window closing fast", color: "var(--orange-500)" },
    { phase: "Viral", desc: "Peak velocity — alpha mostly captured", color: "var(--red-500)" },
    { phase: "Exhausting", desc: "Declining — avoid FOMO entry", color: "var(--gray-400)" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* ─── Hero ─── */}
      <section style={{
        textAlign: "center", padding: "80px 32px 60px",
        background: "linear-gradient(180deg, var(--blue-50) 0%, var(--background) 100%)",
      }}>
        <div style={{
          display: "inline-block", background: "var(--blue-100)", color: "var(--blue-700)",
          padding: "4px 14px", borderRadius: "999px", fontSize: "13px", fontWeight: 600, marginBottom: "20px",
        }}>
          ⚡ OKX.AI Agent Service Provider
        </div>
        <h1 style={{ fontSize: "48px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "16px", lineHeight: 1.1 }}>
          Catch the narrative<br />before it <span style={{ color: "var(--blue-600)" }}>explodes</span>.
        </h1>
        <p style={{ fontSize: "18px", color: "var(--gray-600)", maxWidth: "560px", margin: "0 auto 32px", lineHeight: 1.6 }}>
          Most tools tell you what&apos;s trending <em>now</em> — that&apos;s too late. NarrativeRadar
          detects <strong>acceleration</strong>: narratives whose mention velocity is rising exponentially
          but haven&apos;t peaked yet.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <a
            href="#tools"
            style={{
              background: "var(--blue-600)", color: "#fff", padding: "12px 28px",
              borderRadius: "var(--radius-sm)", fontSize: "15px", fontWeight: 600,
            }}
          >
            Explore MCP Tools
          </a>
          <a
            href="/api/mcp"
            style={{
              border: "1px solid var(--gray-300)", color: "var(--gray-700)",
              padding: "12px 28px", borderRadius: "var(--radius-sm)", fontSize: "15px", fontWeight: 600,
            }}
          >
            View API Discovery
          </a>
        </div>
      </section>

      {/* ─── Live Emerging Narratives ─── */}
      <section style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700 }}>🔥 Emerging Narratives</h2>
          <span style={{ fontSize: "13px", color: "var(--gray-400)" }}>
            Live data · {allMetrics.length} narratives tracked
          </span>
        </div>

        {emerging.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {emerging.slice(0, 6).map((m: NarrativeMetrics) => (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 18px", background: "var(--gray-50)",
                borderRadius: "var(--radius-md)", border: "1px solid var(--gray-200)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <PhaseBadge phase={m.phase} />
                  <span style={{ fontWeight: 600, fontSize: "15px" }}>{m.name}</span>
                  <span style={{ fontSize: "13px", color: "var(--gray-400)" }}>
                    {m.tokens.slice(0, 3).join(", ")}
                    {m.tokens.length > 3 ? ` +${m.tokens.length - 3}` : ""}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span style={{ fontSize: "12px", color: "var(--gray-400)" }}>Trend Score</span>
                    <span style={{ fontWeight: 700, fontSize: "15px", color: "var(--blue-600)" }}>
                      {m.trendScore.toFixed(1)}
                    </span>
                  </div>
                  <VelocityBar velocity={m.velocity} max={maxVelocity} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: "40px", textAlign: "center", background: "var(--gray-50)",
            borderRadius: "var(--radius-md)", border: "1px solid var(--gray-200)",
          }}>
            <p style={{ color: "var(--gray-500)", fontSize: "14px" }}>
              No narratives currently in emerging or accelerating phase.
            </p>
            <p style={{ color: "var(--gray-400)", fontSize: "13px", marginTop: "6px" }}>
              Top narratives by velocity below — some may be entering emerging phase soon.
            </p>
          </div>
        )}

        {/* Top by velocity regardless of phase */}
        <div style={{ marginTop: "24px" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--gray-700)", marginBottom: "12px" }}>
            📊 Top Narratives by Velocity
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {topByVelocity.map((m: NarrativeMetrics) => (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", background: "var(--gray-50)",
                borderRadius: "var(--radius-sm)", border: "1px solid var(--gray-200)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <PhaseBadge phase={m.phase} />
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>{m.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "13px", color: "var(--gray-500)" }}>
                    {m.velocity.toFixed(1)} mentions/hr
                  </span>
                  <VelocityBar velocity={m.velocity} max={maxVelocity} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how" style={{ background: "var(--gray-50)", padding: "60px 32px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "28px", fontWeight: 800, textAlign: "center", marginBottom: "8px" }}>
            Narrative Motion Physics
          </h2>
          <p style={{ textAlign: "center", color: "var(--gray-600)", fontSize: "16px", marginBottom: "40px" }}>
            We treat mention counts as a physics problem — position, velocity, acceleration.
          </p>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px", marginBottom: "40px",
          }}>
            {[
              { label: "Position", value: "Mentions", desc: "Raw count per time bucket", symbol: "x" },
              { label: "Velocity", value: "1st Derivative", desc: "Mentions/hour — growth rate", symbol: "v = dx/dt" },
              { label: "Acceleration", value: "2nd Derivative", desc: "Is growth speeding up?", symbol: "a = dv/dt" },
              { label: "Jerk", value: "3rd Derivative", desc: "Detecting momentum shifts", symbol: "j = da/dt" },
            ].map((item) => (
              <div key={item.label} style={{
                background: "#fff", borderRadius: "var(--radius-md)",
                padding: "20px", border: "1px solid var(--gray-200)",
              }}>
                <div style={{ fontSize: "13px", color: "var(--gray-400)", fontWeight: 600, marginBottom: "4px" }}>
                  {item.label}
                </div>
                <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "6px" }}>{item.value}</div>
                <div style={{ fontSize: "13px", color: "var(--gray-500)" }}>{item.desc}</div>
                <code style={{ display: "inline-block", marginTop: "8px", fontSize: "12px" }}>{item.symbol}</code>
              </div>
            ))}
          </div>

          {/* Lifecycle */}
          <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px" }}>Lifecycle Phase Classification</h3>
          <div style={{ display: "flex", overflowX: "auto", gap: "8px", paddingBottom: "8px" }}>
            {lifecycle.map((l, i) => (
              <div key={l.phase} style={{
                minWidth: "160px", background: "#fff",
                borderRadius: "var(--radius-md)", padding: "16px",
                border: "1px solid var(--gray-200)", position: "relative",
              }}>
                <div style={{
                  width: "24px", height: "24px", borderRadius: "50%",
                  background: l.color, marginBottom: "10px",
                }} />
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>{l.phase}</div>
                <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>{l.desc}</div>
                {i < lifecycle.length - 1 && (
                  <span style={{ position: "absolute", right: "-6px", top: "50%", color: "var(--gray-300)", fontSize: "16px" }}>→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MCP Tools ─── */}
      <section id="tools" style={{ maxWidth: "900px", margin: "0 auto", padding: "60px 32px" }}>
        <h2 style={{ fontSize: "28px", fontWeight: 800, marginBottom: "8px" }}>MCP Tools</h2>
        <p style={{ color: "var(--gray-600)", fontSize: "16px", marginBottom: "28px" }}>
          Query NarrativeRadar via <code>POST /api/mcp</code> with JSON-RPC 2.0.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {tools.map((tool) => (
            <div key={tool.name} style={{
              display: "flex", alignItems: "center", gap: "16px",
              padding: "16px 20px", background: "var(--gray-50)",
              borderRadius: "var(--radius-md)", border: "1px solid var(--gray-200)",
            }}>
              <code style={{ background: "var(--blue-50)", color: "var(--blue-700)", padding: "4px 10px", borderRadius: "var(--radius-sm)", fontSize: "13px", fontWeight: 600 }}>
                {tool.name}
              </code>
              <span style={{ fontSize: "14px", color: "var(--gray-600)" }}>{tool.desc}</span>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: "24px", padding: "20px", background: "var(--gray-900)",
          borderRadius: "var(--radius-md)", overflow: "auto",
        }}>
          <pre style={{ color: "#e5e7eb", fontSize: "13px", lineHeight: 1.6 }}>
{`# Query emerging narratives
curl -X POST https://narrative-radar-okx.vercel.app/api/mcp \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_emerging_narratives",
      "arguments": { "limit": 10 }
    }
  }'`}
          </pre>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" style={{ background: "var(--gray-50)", padding: "60px 32px" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "28px", fontWeight: 800, marginBottom: "16px" }}>Simple Pricing</h2>
          <p style={{ color: "var(--gray-600)", fontSize: "16px", marginBottom: "32px" }}>
            Pay per query via the x402 Agent Payments Protocol. No subscriptions, no API keys to manage.
          </p>

          <div style={{
            background: "#fff", borderRadius: "var(--radius-lg)", padding: "40px",
            border: "1px solid var(--gray-200)", boxShadow: "var(--shadow-md)",
          }}>
            <div style={{ fontSize: "14px", color: "var(--gray-400)", fontWeight: 600, marginBottom: "8px" }}>
              PER MCP QUERY
            </div>
            <div style={{ fontSize: "48px", fontWeight: 800, marginBottom: "8px" }}>
              $0.50<span style={{ fontSize: "18px", color: "var(--gray-400)", fontWeight: 500 }}> USDT</span>
            </div>
            <div style={{ fontSize: "14px", color: "var(--gray-500)", marginBottom: "24px" }}>
              Settled on OKX X Layer · exact scheme
            </div>
            <div style={{
              display: "flex", flexDirection: "column", gap: "8px", textAlign: "left",
              padding: "20px", background: "var(--gray-50)", borderRadius: "var(--radius-md)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                <span style={{ color: "var(--gray-500)" }}>Network</span>
                <code>eip155:196 (X Layer)</code>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                <span style={{ color: "var(--gray-500)" }}>Token</span>
                <code>USDT0</code>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                <span style={{ color: "var(--gray-500)" }}>Scheme</span>
                <code>exact (single-shot)</code>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer style={{
        padding: "32px", textAlign: "center",
        borderTop: "1px solid var(--gray-200)", fontSize: "14px", color: "var(--gray-400)",
      }}>
        <p>NarrativeRadar · Built for OKX.AI Genesis Hackathon</p>
        <p style={{ marginTop: "4px" }}>
          <a href="https://github.com/ubongn/narrative-radar-okx">GitHub</a>
          {" · "}
          <a href="/api/mcp">API</a>
        </p>
      </footer>
    </div>
  );
}
