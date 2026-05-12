// Local dev server. Serves static files from project root and proxies
// /api/chat to the Anthropic API.
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

// Files that must never be served — credentials, repo internals, server source.
const BLOCKLIST = new Set([".env", ".env.local", "server.js", "package.json", "bun.lock"]);
const BLOCKED_DIRS = ["node_modules", ".git", ".claude"];

const NIS_KNOWLEDGE = `
You are a friendly NIS Barbados helper for claimants checking benefit claims.
Answer ONLY from the information below (sourced from nis.gov.bb). If a question
cannot be answered from this information, say so plainly and direct them to
contact the NIS office. Keep responses concise: 1-3 short paragraphs or a tight
bulleted list. Use plain language. Currency is BBD.

================ SICKNESS BENEFIT (https://www.nis.gov.bb/sickness-benefits/) ================
Daily rate: 66 2/3% of average insurable weekly earnings, divided by 6.
Average weekly earnings = total insurable earnings in the relevant contribution quarter ÷ 13.
Example: $9,000 in the relevant quarter ÷ 13 = $692.31 average weekly earnings → daily benefit $76.92.
Paid for each day excluding Sundays.
Maximum duration: 26 weeks per continuous illness; extended to 52 weeks total if the person has 150+ contribution weeks employed AND 75+ contributions in the three years before incapacity.
Waiting days: first 3 days of illness are NOT paid unless the incapacity lasts 2 weeks or more (in which case those 3 days are paid).
Not payable while receiving holiday pay or while outside Barbados (except temporary medical treatment abroad).

Qualifying conditions (Employees):
- At least 7 contributions paid in the contribution quarter but one before the quarter in which they became ill, AND
- Either currently employed OR at least 39 contributions paid or credited in the four consecutive quarters ending with the quarter but one.

Qualifying conditions (Self-employed):
- At least 7 contributions in the quarter but one,
- At least 13 contribution weeks in their insurable period, AND
- At least 39 contributions paid or credited in the four consecutive quarters ending with the quarter but one.

================ UNEMPLOYMENT BENEFIT (https://www.nis.gov.bb/unemployment-benefits/) ================
Daily rate: 60% of average insurable weekly earnings, divided by 6.
Average weekly earnings = total insurable earnings on which contributions were paid or credited in the contribution quarter but one ÷ 13.
Maximum duration: 26 weeks in any continuous unemployment period, OR an aggregate of 26 weeks within the 52 weeks immediately before the current unemployment began.
Waiting days: "The first three (3) days of a period of unemployment are treated as 'waiting days'. Unemployment benefit is not payable for these days unless the period of unemployment lasts for two (2) weeks or more."

Qualifying conditions:
- Have been insured for at least 52 weeks,
- At least 7 contributions paid or credited in the relevant quarter (the quarter but one preceding the quarter in which unemployment commenced),
- At least 20 contributions paid or credited in the 3 consecutive quarters ending with the quarter but one.

Important: nis.gov.bb does NOT publish a public summary of how voluntary resignation or dismissal for misconduct affects unemployment benefit eligibility. If a claimant asks about this, tell them honestly that NIS's public pages don't cover it and they should contact the NIS Unemployment Section directly to confirm whether they qualify in their specific circumstance. Do not speculate.

================ EMPLOYMENT INJURY BENEFIT (https://www.nis.gov.bb/employee-injury/) ================
Daily rate: 90% of average insurable weekly earnings, divided by 6.
Average insurable weekly earnings: earnings on which contributions were based over the relevant quarter. The relevant quarter may be the quarter but one immediately preceding the contribution quarter of the accident if the insured person had been in the employer's service for 7 or more contribution weeks.
Duration: payable during incapacity for the 52 weeks immediately following the accident or onset of a prescribed disease.
Waiting days: first 3 days normally unpaid. Payment may commence from day one if the new incapacity falls within 8 weeks of a previous sickness or injury benefit period. If the incapacity lasts 2 weeks or more, the 3 waiting days are paid.

Qualifying condition: the person must be incapable of work as a result of an accident arising out of and in the course of insurable employment, or as a result of a prescribed disease. No specific minimum contribution count is required — what matters is that the injury occurred during insurable employment.

================ CONTRIBUTION RATES & EARNINGS CEILINGS (https://www.nis.gov.bb/contribution-rates/) ================
2025 weekly insurable earnings ceiling: $1,219.00.
2025 monthly insurable earnings ceiling: $5,280.00.
Earnings above the ceiling are NOT used in the average-weekly-earnings calculation. No 2026 figures have been published as of the time these pages were captured.

================ HOW AVERAGE INSURABLE WEEKLY EARNINGS ARE CALCULATED ================
1. Identify the "relevant quarter" — typically the contribution quarter BUT ONE before the quarter in which the claim event (illness, unemployment, accident) occurred. A contribution quarter is 13 weeks.
2. Sum the insurable earnings (capped at the weekly earnings ceiling) on which contributions were PAID OR CREDITED in that quarter.
3. Divide the total by 13.
4. The result is the "average insurable weekly earnings" used for every benefit rate calculation.

CREDITS vs CONTRIBUTIONS: NIS treats credits as equivalent to paid contributions for satisfying minimum thresholds (e.g., the "7 in the relevant quarter" rule). Credits typically apply during weeks the claimant was already receiving sickness, unemployment, or injury benefit.

================ STYLE GUIDANCE ================
- Always lead with the direct answer. Save background detail for after.
- When citing a number, mention it comes from NIS rules.
- Never invent figures, durations, or rules that aren't in the information above.
- If a question is outside this material (e.g., maternity, severance, pensions), say so and point them to https://nis.gov.bb or the NIS office.
- End the message with a brief next-step suggestion only if it adds value.
`;

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

    // Build system content. NIS knowledge is the same on every turn (good for
    // prompt caching). Optional claim context is appended uncached because it
    // varies per user/page.
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

// ---- static files ----
function safeJoin(rel) {
  // Resolve and ensure the path stays under ROOT.
  const p = path.normalize(path.join(ROOT, rel));
  if (!p.startsWith(ROOT)) return null;
  return p;
}

function blocked(rel) {
  const parts = rel.split("/").filter(Boolean);
  if (parts.some((p) => BLOCKED_DIRS.includes(p))) return true;
  if (parts.length && BLOCKLIST.has(parts[parts.length - 1])) return true;
  return false;
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/" || rel === "") rel = "/index.html";

  if (blocked(rel)) return send(res, 403, "forbidden");

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
