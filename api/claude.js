// Vercel Serverless Function (Node.js runtime).
// Keeps your Anthropic API key on the server and streams the answer back to the browser.
//
// Token/cost note: the resume + job description are identical across the app's 4
// sequential calls, so they're sent as their own cacheable block (cache_control),
// and the ground rules live once in this static system prompt (also cached). After
// the first call, the other three reuse both at a fraction of the token cost instead
// of re-billing the same resume and instructions every time. Nothing about the
// wording or the results changes -- only what gets billed as fresh input.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const MAX_CONTEXT_CHARS = 40000;
const MAX_INSTRUCTION_CHARS = 20000;

const SYSTEM = `You are an expert recruiter and resume writer helping a candidate tailor a resume and cover letter to a specific job description.

Ground rules that apply to everything you write:
- Use only facts found in the candidate's resume. Never invent employers, titles, dates, tools, or numbers.
- If a bullet would benefit from a metric that the resume does not provide, write a short bracketed placeholder such as [X%] or [N users] so the candidate can fill it in. Do not guess a figure.
- Write like a real person: plain verbs, short sentences, no buzzwords such as "spearheaded", "leveraged", "synergy", "results-driven", "dynamic". No first-person pronouns in bullets.
- Work keywords in only where they honestly describe the candidate's work.
- Bullet style, when you write resume bullets: Google's XYZ formula, "Accomplished [X] as measured by [Y] by doing [Z]". Do not copy that wording literally -- each bullet should read as one natural sentence that makes the result, the measure, and the method clear.

Reply with a single valid JSON value only. No markdown fences, no commentary before or after the JSON. The exact JSON shape is given in each request.`;

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
  const context = body && typeof body.context === "string" ? body.context : "";
  const instruction = body && typeof body.instruction === "string" ? body.instruction : "";
  if (!context || !instruction || context.length > MAX_CONTEXT_CHARS || instruction.length > MAX_INSTRUCTION_CHARS) {
    res.status(400).json({ error: "Request is missing context/instruction, or one of them is too long." });
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
        system: [
          { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        ],
        messages: [
          {
            role: "user",
            content: [
              // Resume + job description: identical across this app's 4 calls, so
              // it's marked as its own cache breakpoint.
              { type: "text", text: context, cache_control: { type: "ephemeral" } },
              // The per-step ask, which changes call to call and stays uncached.
              { type: "text", text: instruction },
            ],
          },
        ],
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
