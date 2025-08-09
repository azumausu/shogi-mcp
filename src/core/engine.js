// engine.js
const { spawn } = require("node:child_process");

const DEBUG = process.env.DEBUG === "1";

class LineReader {
  constructor(onLine) { this.buf = ""; this.onLine = onLine; }
  push(chunk) {
    this.buf += chunk.toString();
    let idx;
    while ((idx = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (line) this.onLine(line);
    }
  }
}

class Mutex {
  constructor() { this.p = Promise.resolve(); }
  async run(fn) {
    let release;
    const wait = new Promise((r) => (release = r));
    const prev = this.p;
    this.p = this.p.then(() => wait);
    await prev;
    try { return await fn(); } finally { release(); }
  }
}

function parseInfo(line) {
  const g = {};
  const mDepth = /(?:^| )depth (\d+)/.exec(line);
  const mMPV  = /(?:^| )multipv (\d+)/.exec(line);
  const mCp   = / score cp (-?\d+)/.exec(line);
  const mMate = / score mate (-?\d+)/.exec(line);
  const mNodes= / nodes (\d+)/.exec(line);
  const mNps  = / nps (\d+)/.exec(line);
  const mPv   = / pv (.+)$/.exec(line);
  if (mDepth) g.depth = Number(mDepth[1]);
  if (mMPV)   g.multipv = Number(mMPV[1]);
  if (mCp)    g.scoreCp = Number(mCp[1]);
  if (mMate)  g.mate    = Number(mate = mMate[1]);
  if (mNodes) g.nodes   = Number(mNodes[1]);
  if (mNps)   g.nps     = Number(mNps[1]);
  if (mPv)    g.pv      = mPv[1].trim().split(/\s+/);
  return g;
}

class AIEngine {
  constructor(enginePath, opts = {}) {
    this.enginePath = enginePath;
    this.defaultThreads = opts.defaultThreads ?? 1;
    this.defaultHashMB = opts.defaultHashMB ?? 256;
    this.proc = null;
    this.ready = false;
    this.mutex = new Mutex();
    this.pending = null;
    this._start();
  }

  _log(...a){ if (DEBUG) console.log("[engine]", ...a); }

  _start() {
    this.proc = spawn(this.enginePath, [], { cwd: process.cwd() });
    this.proc.on("exit", (c, s) => console.error(`[engine] exited code=${c} sig=${s}`));
    this.proc.on("error", (e) => console.error(`[engine] failed to start: ${e.message}`));

    const out = new LineReader((line) => this._onLine(line));
    this.proc.stdout.on("data", (d) => out.push(d));
    this.proc.stderr.on("data", (d) => process.stderr.write(d.toString()));
    this.ready = false;

    this._write("usi");
  }

  _write(s) { this._log(">>", s); this.proc.stdin.write(s + "\n"); }

  _onLine(line) {
    this._log("<<", line);
    if (line === "usiok") { this._write("isready"); return; }
    if (line === "readyok") {
      this.ready = true;
      this._write(`setoption name Threads value ${this.defaultThreads}`);
      this._write(`setoption name Hash value ${this.defaultHashMB}`);
      if (process.env.EVAL_FILE) this._write(`setoption name EvalFile value ${process.env.EVAL_FILE}`);
      if (process.env.EVAL_DIR)  this._write(`setoption name EvalDir value ${process.env.EVAL_DIR}`);
      return;
    }
    if (this.pending && line.startsWith("info ")) {
      const parsed = parseInfo(line);
      if (parsed.multipv) {
        const idx = parsed.multipv;
        this.pending.results[idx] = { ...(this.pending.results[idx] || {}), ...parsed };
      }
      return;
    }
    if (this.pending && line.startsWith("bestmove ")) {
      const bestmove = line.split(" ")[1];
      const infos = Object.values(this.pending.results)
        .sort((a, b) => (a.multipv || 999) - (b.multipv || 999));
      const resolve = this.pending.resolve;
      this.pending = null;
      resolve({ bestmove, infos });
    }
  }

  async _waitReady(timeoutMs = 4000) {
    const start = Date.now();
    while (!this.ready) {
      await new Promise((r) => setTimeout(r, 50));
      if (Date.now() - start > timeoutMs) throw new Error("engine not ready (usi/readyok not received)");
    }
  }

  // sfen: "startpos" も OK / "startpos moves ..." もそのまま渡せる
  _writePosition(sfen, forceMove) {
    const isStartpos = /^startpos(\s|$)/.test(sfen);
    if (isStartpos) {
      // すでに moves を含むならそのまま、無ければ forceMove を付加
      if (forceMove) {
        if (/(\s|^)moves(\s|$)/.test(sfen)) this._write(`position ${sfen}`);
        else this._write(`position ${sfen} moves ${forceMove}`);
      } else {
        this._write(`position ${sfen}`);
      }
    } else {
      // こちらは SFEN 形式
      if (forceMove) this._write(`position sfen ${sfen} moves ${forceMove}`);
      else this._write(`position sfen ${sfen}`);
    }
  }

  /**
   * @param {{sfen:string, depth:number, multipv:number, threads?:number, forceMove?:string}} params
   */
  async analyze({ sfen, depth, multipv, threads = this.defaultThreads, forceMove }) {
    return this.mutex.run(async () => {
      await this._waitReady();
      this._write(`setoption name MultiPV value ${multipv}`);
      if (threads && threads !== this.defaultThreads) this._write(`setoption name Threads value ${threads}`);

      this._writePosition(sfen, forceMove);

      const timeoutMs = Math.max(8000, 400 * depth);
      const results = {};
      const prom = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (this.pending) { this.pending = null; reject(new Error("engine timeout (no bestmove)")); }
        }, timeoutMs);
        this.pending = { results, resolve: (v) => { clearTimeout(timer); resolve(v); } };
      });
      this._write(`go depth ${depth}`);
      return prom;
    });
  }
}

module.exports = { AIEngine };

