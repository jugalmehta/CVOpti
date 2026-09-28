# Resume Tailor

Upload a .docx resume, paste a job description, and get a tailored ATS-friendly
resume and cover letter as Word files. Works on any device with a browser.

## Deploy to Vercel

1. Put this folder in a GitHub repo (or use `npx vercel` from this folder).
2. In Vercel: **Add New > Project**, import the repo. Framework preset: **Other**. No build command.
3. Under **Settings > Environment Variables** add:
   - `ANTHROPIC_API_KEY`  your key from console.anthropic.com
   - `ACCESS_CODE`        a passcode you choose (anyone opening your URL needs it, so nobody else spends your API credit)
   - `ANTHROPIC_MODEL`    optional, defaults to `claude-sonnet-5`
4. Deploy. Open the URL on any device, enter your access code once, and go.

## Notes

- Each run makes 4 API calls, and streams so long answers do not time out.
- `vercel.json` sets `maxDuration` to 300 seconds. If Vercel rejects that on your plan, change it to 60.
- Your resume is sent to Anthropic's API for processing and is not stored by this app.
