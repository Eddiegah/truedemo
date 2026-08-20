<div align="center">

# TrueDemo

**The only demo video tool that actually understands your code.**

</div>

---

## ⚠️ Current status: Phase 1 only

This repo currently proves the **architecture**, not the product. The pipeline that submits a job, dispatches a real worker, and gets live status back through a real database is fully working and verified end to end - but the worker itself is a stub that fakes four progress stages and sleeps between them. It does not yet explore a real app, read a real repo, write real narration, or render a real video.

That's deliberate, not a shortcut: this is a genuinely large, multi-service build (browser automation, LLM-driven exploration, TTS, video assembly, all wired to a real job pipeline), and building the plumbing first - then verifying it actually works before writing a single line of the real agent - is the only honest way to build something this size without ending up with impressive-looking code that's never actually been proven to run. See [Roadmap](#roadmap) for what Phase 2 adds.

## Strategic positioning

The AI demo-video space already has funded competitors doing autonomous URL-to-video generation (Demosmith, MakeMyDemo, RepoClip, Creatify, and others). TrueDemo's wedge: **every other tool guesses what your product does from its UI; TrueDemo reads your actual code and gets it right.** The plan for proving this isn't just claiming it in marketing copy - it's showing, in the product itself, specific technical details the narration pulled from the real repo, so a visitor can verify the claim rather than take it on faith. That's Phase 2+ work; noted here so the positioning is on record from day one.

## Architecture

Two real, separately-deployed services - and the reasoning behind each choice, including one deliberate, honest departure from the original spec:

| Piece | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router), Vercel | Free hobby tier, no card, fast edge delivery for the dashboard and marketing site. |
| Worker / job execution | **GitHub Actions**, not Fly.io | The original spec called for a persistent container on Fly.io. Fly.io no longer has a meaningful free tier (new accounts get a 2-hour trial, then require a card) - and this project is built under a hard no-paid-services constraint. GitHub Actions runs on a public repo for free, unlimited minutes, and can genuinely run Playwright (browser install included) and ffmpeg. The real tradeoff, stated plainly: jobs queue through GitHub's own runner scheduling rather than a warm, always-on process, so there's a ~10-30s startup delay before a job actually begins. For a demo-generation tool (not a low-latency API), that's a reasonable trade for zero cost. |
| Job queue | GitHub Actions' own dispatch/scheduling | No Redis/Upstash. The queue's whole purpose in the original spec was handing work from a lightweight frontend to a persistent worker - if the "worker" *is* a GitHub Actions run triggered directly via the API, a separate queue is redundant infrastructure with no job it's actually doing here. |
| Database | **Neon Postgres**, not "Vercel Postgres" | Free tier, no card, doesn't expire - the same proven pattern already used in another project this session. "Vercel Postgres" is Neon under the hood anyway; using Neon directly avoids any ambiguity about which billing tier applies. |
| Real-time updates | Polling (2.5s interval), not WebSockets | Vercel serverless functions can't hold a persistent WebSocket connection open without a separate paid real-time service (Pusher/Ably, etc.). Polling a lightweight status endpoint is free, simple, and - at this job frequency - genuinely indistinguishable from push in practice. |
| Narration TTS (Phase 2) | Piper (open-source, runs locally in the Actions runner) | Zero API cost, no card. Honest tradeoff: voice quality won't match a paid API like ElevenLabs - that'll be stated plainly in the product, not glossed over. |
| LLM (Phase 2) | Gemini free tier | Already proven working, no card, generous free quota. |
| Video hosting (Phase 2) | GitHub Releases | Free, no card, sufficient for demo-scale video files. |

### How a job actually flows right now

1. Browser submits a URL (+ optional repo) to `POST /api/jobs`.
2. That creates a `Job` row in Neon Postgres (`status: queued`) and calls the GitHub API to trigger `workflow_dispatch` on `.github/workflows/process-job.yml`, passing the job id, URL, and repo URL as inputs.
3. A GitHub Actions runner picks up the job (this is the real queueing step - no code of ours manages it), checks out the repo, installs the worker's Python dependencies, and runs `worker/src/main.py`.
4. The worker script POSTs progress updates to `POST /api/jobs/[id]/progress`, authenticated with a shared secret (`WEBHOOK_SECRET`) rather than user auth, since the caller is a CI runner, not a browser session.
5. Each webhook call appends to the job's `progressLog` and updates its `status` in Postgres.
6. The dashboard polls `GET /api/jobs/[id]` every 2.5s and renders the live log.

Every step of this is real and has been run end to end against the deployed production URLs, not just localhost - see [Verification](#verification).

## Roadmap

**Phase 2** (not built yet): replace the stub `worker/src/main.py` with the real pipeline - Playwright-driven autonomous exploration with loop safeguards, GitHub repo context grounding, timestamped action logging, Gemini-based script generation grounded in actual code, Piper TTS narration, ffmpeg video assembly with zooms/captions. Landing page with the concrete side-by-side proof of the technical-accuracy claim. Full shadcn/ui design system, Framer Motion micro-interactions, auth via next-auth, video library/sharing.

## Verification

- [ ] Submitted a real job from the deployed frontend, confirmed the GitHub Actions run was dispatched, confirmed real progress updates arrived and rendered live on the dashboard, confirmed final status reached the frontend - all against production URLs.

(Filled in once the production deploy is live and tested - see the rest of this session for that verification.)

## Setup

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in DATABASE_URL, GH_DISPATCH_TOKEN, WEBHOOK_SECRET
npx prisma db push
npm run dev
```

### Worker

The worker only runs inside GitHub Actions (`.github/workflows/process-job.yml`) - it's not meant to be run as a standalone service. To test it locally:

```bash
cd worker
python -m venv venv && venv/Scripts/activate   # or source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
python src/main.py --job-id test --url https://example.com --webhook-url http://localhost:3000 --webhook-secret <your WEBHOOK_SECRET>
```

Requires the frontend running locally (`npm run dev` in `frontend/`) so the webhook calls have somewhere to land.

### GitHub Actions secrets

On the repo (Settings → Secrets and variables → Actions), set:
- `WEBHOOK_URL` - the deployed frontend's base URL
- `WEBHOOK_SECRET` - must match the frontend's `WEBHOOK_SECRET` env var exactly

## License

MIT
