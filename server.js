// Local dev server. Serves static files from ./public/ and proxies
// /api/chat to the Anthropic API. Mirrors the Vercel layout — api/chat.mjs
// is the production handler; this file is the local-only equivalent.
//
// Run with an API key in .env:
//   ANTHROPIC_API_KEY=sk-ant-...
//   ANTHROPIC_MODEL=claude-haiku-4-5     (optional)
//
// Without an API key, /api/chat returns { type: "fallback" } so the client
// can show a polite stub instead of crashing.

const http = require("http");
const fs = require("fs");
const path = require("path");

// Tiny .env loader — no deps. Skips if file missing.
(() => {
  try {
    const raw = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  } catch {}
})();

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
};

// Shared NIS knowledge base, also used by api/chat.mjs in production.
const NIS_KNOWLEDGE = fs.readFileSync(path.join(ROOT, "nis-knowledge.txt"), "utf8");

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJSON(res, status, obj) {
  send(res, status, JSON.stringify(obj), { "Content-Type": "application/json" });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// ---- /api/chat ----
async function handleChat(req, res) {
  if (!ANTHROPIC_API_KEY) return sendJSON(res, 200, { type: "fallback" });

  try {
    const buf = await readBody(req);
    let body = {};
    try { body = JSON.parse(buf.toString("utf8")); } catch {}

    const messages = [];
    for (const m of (body.history || [])) {
      if (m && m.role && m.content) messages.push({ role: m.role, content: String(m.content) });
    }
    if (body.userMessage) messages.push({ role: "user", content: String(body.userMessage) });
    if (!messages.length) {
      return sendJSON(res, 400, { error: "userMessage or history required" });
    }

    const systemBlocks = [
      {
        type: "text",
        text: NIS_KNOWLEDGE,
        cache_control: { type: "ephemeral" },
      },
    ];
    if (body.context && typeof body.context === "object") {
      systemBlocks.push({
        type: "text",
        text:
          "================ THIS USER'S CURRENT CLAIM ================\n" +
          JSON.stringify(body.context, null, 2) +
          "\n\nWhen the user asks about their own claim, use these specifics. " +
          "Reference actual numbers (estimated payout, stage, days behind, outstanding items) when relevant. " +
          "If they ask a general question, you don't have to mention their claim.",
      });
    }

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 600,
        system: systemBlocks,
        messages,
      }),
    });

    const data = await r.json().catch(() => null);
    if (!r.ok || !data) {
      const err = data?.error?.message || r.statusText;
      return sendJSON(res, r.status || 500, { error: "Anthropic error: " + String(err).slice(0, 300) });
    }

    const text = (data.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();

    return sendJSON(res, 200, { type: "reply", text: text || "I don't have an answer for that. Please contact the NIS office directly." });
  } catch (e) {
    return sendJSON(res, 500, { error: e.message });
  }
}

// ---- static files (serve from ./public/) ----
function safeJoin(rel) {
  const p = path.normalize(path.join(PUBLIC, rel));
  if (!p.startsWith(PUBLIC)) return null;
  return p;
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/" || rel === "") rel = "/index.html";

  let abs = safeJoin(rel);
  if (!abs) return send(res, 403, "forbidden");

  // Clean URLs: try .html if path has no extension and bare file missing.
  if (!fs.existsSync(abs) && !path.extname(abs)) {
    const withHtml = abs + ".html";
    if (fs.existsSync(withHtml)) abs = withHtml;
  }

  if (!fs.existsSync(abs)) return send(res, 404, "not found");
  if (fs.statSync(abs).isDirectory()) {
    const idx = path.join(abs, "index.html");
    if (fs.existsSync(idx)) abs = idx;
    else return send(res, 404, "not found");
  }

  const ext = path.extname(abs);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(abs).pipe(res);
}

// ---- server ----
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/api/chat" && req.method === "POST") {
    return handleChat(req, res);
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD, POST");
    return send(res, 405, "method not allowed");
  }
  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`govbb-nisclaims running on http://localhost:${PORT}/`);
  console.log(`  chat: ${ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY set — using " + ANTHROPIC_MODEL : "no key — fallback responses only"}`);
});
