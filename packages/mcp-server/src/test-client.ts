/**
 * Integration test client for @junkyard/mcp-server.
 * Spawns the server via StdioClientTransport, exercises several tool calls,
 * and validates the results. Run with:
 *   bun run src/test-client.ts
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverScript = join(__dirname, "index.ts");

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}${detail ? ` -- ${detail}` : ""}`);
    failed++;
  }
}

function getText(result: { content?: Array<{ type: string; text?: string }> }): string {
  return result.content?.find((c) => c.type === "text")?.text ?? "";
}

async function run() {
  const transport = new StdioClientTransport({
    command: "/home/planky/.bun/bin/bun",
    args: ["run", serverScript],
    stderr: "pipe",
  });

  const client = new Client({ name: "junkyard-test-client", version: "0.1.0" });

  await client.connect(transport);
  console.log("Connected to server.\n");

  // ── 1. listTools ────────────────────────────────────────────────────────────
  console.log("=== listTools ===");
  const { tools } = await client.listTools();
  console.log(`  Tool count: ${tools.length}`);
  assert("tool count == 25", tools.length === 25, `got ${tools.length}`);
  const toolNames = tools.map((t) => t.name);
  assert("junkyard_hash_hash present", toolNames.includes("junkyard_hash_hash"));
  assert("junkyard_qr_generate present", toolNames.includes("junkyard_qr_generate"));
  console.log();

  // ── 2. junkyard_hash_hash ────────────────────────────────────────────────────
  console.log("=== junkyard_hash_hash ===");
  const hashResult = await client.callTool({
    name: "junkyard_hash_hash",
    arguments: { text: "abc", algo: "sha256" },
  });
  const hashText = getText(hashResult as Parameters<typeof getText>[0]);
  const parsed = JSON.parse(hashText);
  console.log(`  result: ${hashText}`);
  assert(
    "sha256('abc') == ba7816...",
    parsed.hash === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    parsed.hash,
  );
  console.log();

  // ── 3. junkyard_base64_encode ───────────────────────────────────────────────
  console.log("=== junkyard_base64_encode ===");
  const b64Result = await client.callTool({
    name: "junkyard_base64_encode",
    arguments: { text: "hello world", urlSafe: false },
  });
  const b64Text = getText(b64Result as Parameters<typeof getText>[0]);
  const b64Parsed = JSON.parse(b64Text);
  console.log(`  result: ${b64Text}`);
  assert("base64 encode 'hello world'", b64Parsed.encoded === "aGVsbG8gd29ybGQ=", b64Parsed.encoded);
  console.log();

  // ── 4. junkyard_json_format ──────────────────────────────────────────────────
  console.log("=== junkyard_json_format ===");
  const jsonResult = await client.callTool({
    name: "junkyard_json_format",
    arguments: { json: '{"a":1}', indent: 2 },
  });
  const jsonText = getText(jsonResult as Parameters<typeof getText>[0]);
  const jsonParsed = JSON.parse(jsonText);
  console.log(`  result: ${JSON.stringify(jsonParsed)}`);
  assert("json format contains newline", (jsonParsed.formatted ?? jsonParsed.output ?? jsonText).includes("\n"));
  assert("json format contains 'a'", JSON.stringify(jsonParsed).includes("\"a\""));
  console.log();

  // ── 5. junkyard_qr_generate ─────────────────────────────────────────────────
  console.log("=== junkyard_qr_generate ===");
  const qrResult = await client.callTool({
    name: "junkyard_qr_generate",
    arguments: { text: "hi" },
  });
  const qrText = getText(qrResult as Parameters<typeof getText>[0]);
  // qr op returns { svg: "<svg ...>" }; getText gives JSON-stringified object
  const qrParsed = JSON.parse(qrText);
  console.log(`  svg length: ${qrParsed.svg?.length ?? 0}`);
  assert("qr result contains <svg", qrParsed.svg?.includes("<svg"));
  console.log();

  // ── 6. junkyard_uuid_generate ───────────────────────────────────────────────
  console.log("=== junkyard_uuid_generate ===");
  const uuidResult = await client.callTool({
    name: "junkyard_uuid_generate",
    arguments: { version: "v4", count: 1 },
  });
  const uuidText = getText(uuidResult as Parameters<typeof getText>[0]);
  const uuidParsed = JSON.parse(uuidText);
  const uuid = uuidParsed.uuids?.[0] ?? "";
  console.log(`  uuid: ${uuid}`);
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert("valid uuid v4", uuidRe.test(uuid), uuid);
  console.log();

  // ── 7. Invalid input -> clean tool error ────────────────────────────────────
  console.log("=== invalid input -> tool error ===");
  const errResult = await client.callTool({
    name: "junkyard_hash_hash",
    arguments: { text: "abc", algo: "md99" }, // "md99" is not in the enum
  });
  console.log(`  isError: ${(errResult as { isError?: boolean }).isError}`);
  console.log(`  content: ${getText(errResult as Parameters<typeof getText>[0]).slice(0, 120)}`);
  assert("invalid input returns isError", (errResult as { isError?: boolean }).isError === true);
  console.log();

  await client.close();

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`=== Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Test client error:", err);
  process.exit(1);
});
