import { timingSafeEqual } from "node:crypto";

// Vercel serverless function (Node runtime, Web-standard handler).
// Keeps your Anthropic API key on the server and streams the answer back to the browser.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const MAX_PROMPT_CHARS = 80000;

const SYSTEM =
  "You are an expert recruiter and resume writer. Reply with a single valid JSON value only. " +
  "No markdown fences, no commentary before or after the JSON.";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function sameCode(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(request) {
  const expected = process.env.ACCESS_CODE;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!expected || !apiKey) {
    return json(500, { error: "Server is missing ANTHROPIC_API_KEY or ACCESS_CODE environment variables." });
  }

  const provided = request.headers.get("x-access-code") || "";
  if (!sameCode(provided, expected)) {
    return json(401, { error: "Wrong access code." });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Invalid request body." });
  }
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt || prompt.length > MAX_PROMPT_CHARS) {
    return json(400, { error: "Prompt is empty or too long." });
  }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      stream: true,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    let msg = "Anthropic API error (" + upstream.status + ").";
    try {
      const e = await upstream.json();
      if (e && e.error && e.error.message) msg = e.error.message;
    } catch {}
    return json(502, { error: msg });
  }

  // Pass the event stream straight through to the browser.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
