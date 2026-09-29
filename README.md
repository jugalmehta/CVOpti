# Resume Tailor

Upload a .docx resume, paste a job description, and get a tailored ATS-friendly
resume and cover letter as Word files. Works on any device with a browser.

## Files

- `index.html` — the whole front end (single static file, no build step).
- `api/claude.js` — a Vercel Serverless Function that calls the Anthropic API,
  keeping your API key on the server instead of the browser.
- `package.json` — minimal, no dependencies needed at build time.

## Deploy on Vercel

1. Push this folder to a GitHub repo (the three items above must be at the
   **root** of the repo, not inside a subfolder — that mismatch is what
   caused the "pattern doesn't match any Serverless Functions" error).
2. In Vercel: **Add New → Project**, import the repo.
   Framework preset: **Other**. Leave build/output settings empty.
3. Under **Settings → Environment Variables** add:
   - `ANTHROPIC_API_KEY` — your key from console.anthropic.com
   - `ANTHROPIC_MODEL` — optional, defaults to `claude-sonnet-5`
4. Deploy. Open the resulting URL on any device — phone, laptop, tablet —
   and use it straight away, no sign-in step.

## Notes

- Each run makes 4 API calls to Claude and streams the reply so long answers
  don't time out.
- The resume and job description are sent once as a cacheable block
  (`cache_control`), and the instructions live once in the server's system
  prompt, also cached. After the first call, the other three reuse both at a
  fraction of the token cost instead of re-billing the same resume and
  instructions on every step -- same prompts, same results, lower cost.
- Anyone who has your deployed URL can use it and will spend your API
  credit — there's no login. If you want to restrict that, the simplest
  option is Vercel's own **Password Protection** (Project → Settings →
  Deployment Protection), which sits in front of the whole site.
- Your resume text and the job description are sent to Anthropic's API to
  generate the results and are not stored by this app.
