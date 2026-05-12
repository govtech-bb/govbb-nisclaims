// Vercel serverless function — NIS help chatbot.
// Body: { history: [{role, content}, ...], userMessage, context?: object }
// Reply: { type: "reply", text } | { type: "fallback" } | { error }
//
// Env vars:
//   ANTHROPIC_API_KEY  — required for AI flow; missing → fallback response
//   ANTHROPIC_MODEL    — defaults to claude-haiku-4-5

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const config = { api: { bodyParser: true } };

const DEFAULT_MODEL = "claude-haiku-4-5";

// Resolve the NIS knowledge file relative to this file.
const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_PATH = join(__dirname, "..", "nis-knowledge.txt");
let _knowledge = null;
function loadKnowledge() {
  if (_knowledge !== null) return _knowledge;
  _knowledge = readFileSync(KNOWLEDGE_PATH, "utf8");
  return _knowledge;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(200).json({ type: "fallback" });

  try {
    const body = req.body || {};
    const out = await runChat(body, apiKey, process.env.ANTHROPIC_MODEL || DEFAULT_MODEL);
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function runChat({ history = [], userMessage = "", context = null }, apiKey, model) {
  const knowledge = loadKnowledge();

  const messages = [];
  for (const m of history) {
    if (m && m.role && m.content) messages.push({ role: m.role, content: String(m.content) });
  }
  if (userMessage) messages.push({ role: "user", content: String(userMessage) });
  if (!messages.length) throw new Error("userMessage or history required");

  const systemBlocks = [
    {
      type: "text",
      text: knowledge,
      cache_control: { type: "ephemeral" },
    },
  ];
  if (context && typeof context === "object") {
    systemBlocks.push({
      type: "text",
      text:
        "================ THIS USER'S CURRENT CLAIM ================\n" +
        JSON.stringify(context, null, 2) +
        "\n\nWhen the user asks about their own claim, use these specifics. " +
        "Reference actual numbers (estimated payout, stage, days behind, outstanding items) when relevant. " +
        "If they ask a general question, you don't have to mention their claim.",
    });
  }

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      system: systemBlocks,
      messages,
    }),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok || !data) {
    const err = data?.error?.message || r.statusText;
    throw new Error("Anthropic error: " + String(err).slice(0, 300));
  }

  const text = (data.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();

  return { type: "reply", text: text || "I don't have an answer for that. Please contact the NIS office directly." };
}
