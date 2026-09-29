// Vercel Serverless Function (Node.js runtime).
// Keeps your Anthropic API key on the server and streams the answer back to the browser.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const MAX_PROMPT_CHARS = 80000;

const SYSTEM =
  "You are an expert recruiter and resume writer. Reply with a single valid JSON value only. " +
  "No markdown fences, no commentary before or after the JSON.";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server is missing the ANTHROPIC_API_KEY environment variable." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const prompt = body && typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt || prompt.length > MAX_PROMPT_CHARS) {
    res.status(400).json({ error: "Prompt is empty or too long." });
    return;
  }

  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
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
  } catch (e) {
    res.status(502).json({ error: "Could not reach Anthropic's API." });
    return;
  }

  if (!upstream.ok || !upstream.body) {
    let msg = "Anthropic API error (" + upstream.status + ").";
    try {
      const e = await upstream.json();
      if (e && e.error && e.error.message) msg = e.error.message;
    } catch {}
    res.status(502).json({ error: msg });
    return;
  }

  // Stream the server-sent events straight through to the browser.
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store",
  });

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } catch (e) {
    // client disconnected or upstream dropped; nothing more to do
  } finally {
    res.end();
  }
};

module.exports.config = {
  api: { bodyParser: true },
};
