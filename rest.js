// rest.js
const express = require("express");
const { AIEngine } = require("./engine");

const ENGINE_PATH = process.env.ENGINE_PATH || "./engine/engine";
const DEFAULT_MULTIPV = 10;  // ご要望どおり
const MAX_DEPTH = 30;        // ご要望どおり

const app = express();
const engine = new AIEngine(ENGINE_PATH, { defaultThreads: 1, defaultHashMB: 256 });

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/analyze", async (req, res) => {
  try {
    const sfen = String(req.query.sfen || "");
    if (!sfen) return res.status(400).json({ error: "sfen required" });

    const depth = Math.min(Number(req.query.depth || MAX_DEPTH), MAX_DEPTH);
    const multipv = Math.min(Number(req.query.multipv || DEFAULT_MULTIPV), 10);
    const threads = Math.max(1, Math.min(Number(req.query.threads || 1), 8));
    const forceMove = req.query.forceMove ? String(req.query.forceMove) : undefined;

    const result = await engine.analyze({ sfen, depth, multipv, threads, forceMove });
    res.json({
      engine: "AI Engine",
      depth,
      multipv,
      threads,
      ...result,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`REST up on http://localhost:${port}`);
  console.log(`Engine: ${ENGINE_PATH}`);
});

