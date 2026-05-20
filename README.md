# CodeMap

Visualize and explore GitHub repositories as interactive dependency graphs, powered by AI-generated summaries.

## Features

- Ingest any public GitHub repository via URL
- Builds a file/module dependency graph
- AI-powered summaries for each node (Anthropic, OpenAI, or Ollama)
- Interactive graph explorer with node detail panel

## Local Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL and API keys

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev

# Start the dev server
npm run dev
```

## Deployment (Vercel + Neon)

1. Create a Neon project at https://neon.tech (free tier)
2. Copy the connection string (includes `?sslmode=require`)
3. Import repo at https://vercel.com/new
4. Add environment variables:
   - `DATABASE_URL` — Neon connection string
   - `GITHUB_TOKEN` — GitHub personal access token (optional but recommended to avoid rate limits)
   - `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` — for AI summaries (optional)
   - `AI_PROVIDER` — `anthropic`, `openai`, or `ollama`
   - `AI_MODEL` — model name (e.g. `claude-3-5-haiku-20241022`, `gpt-4o-mini`)
5. Deploy — Vercel auto-runs `prisma generate && node scripts/copy-wasm.js && next build`
6. After first deploy, run migrations: `npx prisma migrate deploy` with the Neon `DATABASE_URL`

> **Note:** The ingest API uses Next.js `after()` to run the pipeline after the response is sent, keeping background work alive on Vercel serverless.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Neon or local) |
| `GITHUB_TOKEN` | No | GitHub PAT for higher API rate limits |
| `AI_PROVIDER` | No | `anthropic`, `openai`, or `ollama` (default: none) |
| `AI_MODEL` | No | Model identifier for the chosen provider |
| `ANTHROPIC_API_KEY` | No | Required if `AI_PROVIDER=anthropic` |
| `OPENAI_API_KEY` | No | Required if `AI_PROVIDER=openai` |
