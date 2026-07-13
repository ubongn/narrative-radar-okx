import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NarrativeRadar — Catch the Narrative Before It Explodes",
  description:
    "Track crypto narrative mention velocity and acceleration. Get alerted on emerging narratives before they go viral. MCP server with x402 pay-per-query.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <nav className="nav" id="main-nav">
          <a href="/" className="nav-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="NarrativeRadar" height="24" />
          </a>
          <div className="nav-links">
            <a href="/#how" className="nav-link">How it works</a>
            <a href="/#tools" className="nav-link">MCP Tools</a>
            <a href="/#pricing" className="nav-link">Pricing</a>
            <a href="/api/mcp" className="nav-cta">API →</a>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
