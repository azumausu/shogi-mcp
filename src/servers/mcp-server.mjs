// mcp-server.mjs
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Bridge API のベースURL（必要に応じて環境変数で上書き）
const REST_BASE = process.env.REST_BASE || "http://localhost:8787";

// MCP サーバー作成
const server = new McpServer({
  name: "shogi-mcp",
  version: "0.1.0",
});

/**
 * 1) 疎通確認用 ping
 * - Inspector が inputSchema=null を嫌うため、空オブジェクトを必ず渡す
 */
server.registerTool(
  "ping",
  {
    title: "Ping",
    description: "ヘルスチェック（常に pong を返す）",
    inputSchema: {}, // ← 重要: null/undefined にしない
  },
  async () => {
    return { content: [{ type: "text", text: "pong" }] };
  }
);

/**
 * 2) Engine解析: analyze
 * - SDKの期待どおり、キーごとにZod型を並べた“プレーンオブジェクト”を指定
 * - 返却は Inspector 互換の text（JSON文字列）で返す
 */
server.registerTool(
  "analyze",
  {
    title: "Engine 解析",
    description: "SFENを解析して候補手(MultiPV)・評価値・PVを返す",
    inputSchema: {
      sfen: z.string(),
      depth: z.number().int().min(4).max(30).default(18),
      multipv: z.number().int().min(1).max(10).default(10),
      threads: z.number().int().min(1).max(8).default(1),
      forceMove: z.string().optional(),
    },
  },
  async ({ sfen, depth, multipv, threads, forceMove }) => {
    const url = new URL(REST_BASE + "/analyze");
    url.searchParams.set("sfen", sfen);
    url.searchParams.set("depth", String(depth));
    url.searchParams.set("multipv", String(multipv));
    url.searchParams.set("threads", String(threads));
    if (forceMove) url.searchParams.set("forceMove", forceMove);

    const r = await fetch(url);
    if (!r.ok) throw new Error(`Bridge API error ${r.status}`);
    const json = await r.json();

    // Inspector互換のため text で返却（見やすいように整形）
    return { content: [{ type: "text", text: JSON.stringify(json, null, 2) }] };
  }
);

/**
 * 3) 一手進めて評価: eval_at
 */
server.registerTool(
  "eval_at",
  {
    title: "特定手の直後を評価",
    description: "現局面で特定の一手を指した先を解析して返す",
    inputSchema: {
      sfen: z.string(),
      move: z.string(), // 例 "7g7f"
      depth: z.number().int().min(4).max(30).default(18),
      multipv: z.number().int().min(1).max(10).default(5),
      threads: z.number().int().min(1).max(8).default(1),
    },
  },
  async ({ sfen, move, depth, multipv, threads }) => {
    const url = new URL(REST_BASE + "/analyze");
    url.searchParams.set("sfen", sfen);
    url.searchParams.set("depth", String(depth));
    url.searchParams.set("multipv", String(multipv));
    url.searchParams.set("threads", String(threads));
    url.searchParams.set("forceMove", move);

    const r = await fetch(url);
    if (!r.ok) throw new Error(`Bridge API error ${r.status}`);
    const json = await r.json();

    return { content: [{ type: "text", text: JSON.stringify(json, null, 2) }] };
  }
);

// stdio で待受（※ stdout はプロトコル用なので、ログは stderr へ）
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("shogi-mcp: ready on stdio");

