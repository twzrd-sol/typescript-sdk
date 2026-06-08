/**
 * TWZRD Agent Intel — TypeScript MCP client example.
 *
 * Demonstrates how to connect to the TWZRD Agent Intel MCP server using
 * the official TypeScript MCP SDK (streamable-http transport).
 *
 * The server exposes two free tools:
 *   - score_agent(wallet)      — returns 0-100 trust score + risk flags
 *   - preflight_check(wallet)  — PASS/FAIL gate for x402 payment flows
 *
 * And one paid tool (HTTP 402):
 *   - get_trust_receipt(wallet) — cryptographically signed trust receipt
 *
 * MCP endpoint: https://intel.twzrd.xyz/mcp  (streamable-http, no auth required)
 * Website: https://intel.twzrd.xyz
 *
 * Install:
 *   npm install @modelcontextprotocol/sdk
 *
 * Run:
 *   npx tsx examples/client/src/twzrdAgentIntel.ts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const TWZRD_MCP_URL = "https://intel.twzrd.xyz/mcp";

interface TrustScore {
  score: number;
  risk_flags: string[];
  trust_level?: "HIGH" | "MEDIUM" | "LOW";
}

interface PreflightResult {
  passed: boolean;
  message: string;
}

async function createTWZRDClient(): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(
    new URL(TWZRD_MCP_URL)
  );

  const client = new Client(
    {
      name: "twzrd-agent-intel-example",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);
  return client;
}

/**
 * Get the trust score for a Solana agent wallet.
 *
 * @param wallet - Solana wallet address (base58 encoded)
 * @returns Trust score (0-100) and behavioral risk flags
 */
async function scoreAgent(wallet: string): Promise<TrustScore> {
  const client = await createTWZRDClient();

  try {
    const result = await client.callTool({
      name: "score_agent",
      arguments: { wallet },
    });

    const text =
      result.content?.[0]?.type === "text" ? result.content[0].text : "{}";

    const data = JSON.parse(text) as TrustScore;
    const score = data.score ?? 0;

    return {
      score,
      risk_flags: data.risk_flags ?? [],
      trust_level: score >= 80 ? "HIGH" : score >= 60 ? "MEDIUM" : "LOW",
    };
  } finally {
    await client.close();
  }
}

/**
 * Run a preflight check — PASS/FAIL gate for x402 payment authorization.
 *
 * @param wallet - Solana wallet address (base58 encoded)
 * @returns Whether the agent passes the x402 payment preflight check
 */
async function preflightCheck(wallet: string): Promise<PreflightResult> {
  const client = await createTWZRDClient();

  try {
    const result = await client.callTool({
      name: "preflight_check",
      arguments: { wallet },
    });

    const text =
      result.content?.[0]?.type === "text" ? result.content[0].text : "";
    const passed = text.toUpperCase().includes("PASS");

    return { passed, message: text };
  } finally {
    await client.close();
  }
}

/**
 * List all tools available from the TWZRD Agent Intel MCP server.
 */
async function listTools(): Promise<void> {
  const client = await createTWZRDClient();

  try {
    const { tools } = await client.listTools();
    console.log("Available TWZRD Agent Intel tools:");
    for (const tool of tools) {
      console.log(`  - ${tool.name}: ${tool.description}`);
    }
  } finally {
    await client.close();
  }
}

// --- Main example ---

async function main(): Promise<void> {
  const exampleWallet = "4LkEFjHsF2ubC8K4oF2r3rCFqPZQVGBjL9mV6xkNPZdf";

  console.log("=== TWZRD Agent Intel MCP Example (TypeScript) ===\n");

  // List available tools
  await listTools();

  console.log(`\nChecking trust for wallet: ${exampleWallet.slice(0, 8)}...\n`);

  // Score the agent
  const trust = await scoreAgent(exampleWallet);
  console.log("Trust Score Result:");
  console.log(`  Score: ${trust.score}/100 (${trust.trust_level})`);
  console.log(`  Risk flags: ${trust.risk_flags.length > 0 ? trust.risk_flags.join(", ") : "none"}`);

  // Run preflight check
  const preflight = await preflightCheck(exampleWallet);
  console.log("\nPreflight Check Result:");
  console.log(`  Status: ${preflight.passed ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`  Message: ${preflight.message}`);

  // Decision logic
  const TRUST_THRESHOLD = 60;
  const authorized = trust.score >= TRUST_THRESHOLD && preflight.passed;
  console.log(
    `\nAuthorization decision: ${authorized ? "AUTHORIZED for x402 payments" : "REJECTED"}`
  );
}

main().catch(console.error);
