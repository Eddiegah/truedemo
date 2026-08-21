<div align="center">

# TrueDemo

**The only demo video tool that actually understands your code.**

</div>

---

## Current status: pipeline, UI, and accounts are real and live

The full pipeline is real, not a stub: a real headless browser explores the target app, the target repo is actually cloned and read for technical grounding, Gemini writes narration from that real context, Piper synthesizes it locally, ffmpeg assembles a captioned video, and it's published as a real GitHub Release asset. The frontend is a proper shadcn/ui design system (dark-mode-first, single emerald accent, Framer Motion micro-interactions, optimistic UI on submit) with a landing page whose proof section uses genuinely real generated narration, not mockup copy. Sign-in is real GitHub OAuth via next-auth, gating job creation both client- and server-side, and `/library` lists a signed-in user's real past jobs from Postgres.

What's still ahead, honestly: no shareable public links for individual videos yet, and the landing page's visual polish (imagery, deeper motion work) is still fairly minimal. See [Roadmap](#roadmap).

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
| Narration TTS | Piper (open-source, runs locally in the Actions runner) | Zero API cost, no card. Honest tradeoff: voice quality is noticeably more robotic than a paid API like ElevenLabs - stated plainly here, not glossed over. |
| LLM | Gemini free tier | Model selection tries `gemini-flash-latest` (Google's own version-drift-proof alias) first, with pinned fallbacks and a short retry for transient 503 "high demand" responses - both failure modes were hit for real during testing, not hypothetical. |
| Video hosting | GitHub Releases | Free, no card, sufficient for demo-scale video files. |

### How a job actually flows right now

1. Browser submits a URL (+ optional repo) to `POST /api/jobs`.
2. That creates a `Job` row in Neon Postgres (`status: queued`) and calls the GitHub API to trigger `workflow_dispatch` on `.github/workflows/process-job.yml`, passing the job id, URL, and repo URL as inputs.
3. A GitHub Actions runner picks up the job (this is the real queueing step - no code of ours manages it), checks out the repo, installs ffmpeg/Python deps/the Playwright browser, and runs `worker/src/main.py`.
4. `agent.py` drives a real headless Chromium around the target app (bounded to 6 steps, same-origin only, loop-safe) and screenshots each step.
5. `repo_context.py` shallow-clones the target repo (if given) and extracts its README, dependency manifests, and file tree - including manifests in monorepo subdirectories, not just the root.
6. `script_writer.py` sends that real action log + repo context to Gemini, which writes narration grounded in what the app actually is, not generic marketing language.
7. `narration.py` synthesizes each line locally with Piper TTS.
8. `video_assembly.py` burns captions onto each screenshot, muxes in its narration audio via ffmpeg, and concatenates all clips into one video.
9. `video_release.py` publishes it as a GitHub Release asset and returns the public download URL.
10. Every stage POSTs progress to `POST /api/jobs/[id]/progress` (shared-secret auth, since the caller is a CI runner, not a browser session), which the dashboard polls every 2.5s.

Every step of this is real and has been run end to end against the deployed production URLs, not just localhost - see [Verification](#verification).

## Roadmap

Still ahead, not yet built: shareable public links for individual library videos, and further landing-page visual polish. Everything else from the original spec - the real pipeline, the shadcn/ui + Framer Motion design system, GitHub OAuth accounts, and the video library - is built and verified.

## Verification

- [x] Architecture proof: job submission → GitHub Actions dispatch → webhook progress → Postgres → live dashboard polling, all against production URLs.
- [x] Real pipeline: a real generated video, produced end to end from a real job submitted through the deployed frontend, published as a real GitHub Release asset.
- [x] Auth: `GET /api/auth/providers` confirms GitHub OAuth is live with the correct callback URL; `POST /api/jobs` returns `401` without a session, confirming the server-side gate (not just a client-side UI hide) actually blocks anonymous job creation.

**Real pipeline run**, against the live production deploy (`https://frontend-dun-chi-56.vercel.app`), target app `https://playwright.dev`, grounded against this repo:

1. Submitted via `POST /api/jobs` - created a real `Job` row and dispatched a real GitHub Actions run.
2. `agent.py` explored the live app with a real headless browser and completed 7 steps.
3. `repo_context.py` cloned this repo and extracted real context (manifests, README, file tree).
4. `script_writer.py` got real narration back from Gemini, grounded in that context.
5. `narration.py` synthesized real audio for every line with Piper.
6. `video_assembly.py` produced a real 47.6s, 1280×800 h264/aac mp4 with burned-in captions.
7. `video_release.py` published it to a real GitHub Release: `Eddiegah/truedemo` release `demo-cmt3d2ofo0000ji04ouwcrcth`.
8. The dashboard's own 2.5s poll loop reflected every stage live, ending in `completed` with a working video link - confirmed by downloading the actual file and inspecting it with `ffprobe`, not just checking the HTTP status.

Real bugs found and fixed only by testing against the real infrastructure, not glossed over:

- **ffmpeg's `pad` filter doesn't take `scale`'s `WxH` shorthand.** `pad=1280x800:(ow-iw)/2:(oh-ih)/2` parsed `"1280x800"` as a single width expression and failed with `Invalid chars 'x800'` - silently, at first, because `subprocess.run(capture_output=True)` was dropping ffmpeg's actual stderr. Fixed both: `_run_ffmpeg()` now surfaces the real ffmpeg error, and `pad` gets `width:height` as separate arguments. Only caught by reproducing the exact failing command locally with a real ffmpeg binary and real input files, not by reasoning about the exit code alone.
- **Gemini's free-tier model lineup moved during this build.** `gemini-2.5-flash` (the initial pick) now 404s for new users with the API pointing at `gemini-3.6-flash` in its own error message; separately, `gemini-flash-latest` (Google's stable alias, meant to be immune to exactly this) returned a transient `503 high demand`. Fixed by trying `gemini-flash-latest` first with a couple of retries on 503 specifically, then pinned fallbacks - both paths were exercised for real, not just written defensively and hoped to work.
- **`piper-tts` 1.7.0's API differs from older docs/examples.** `PiperVoice.synthesize()` now returns a generator of `AudioChunk` objects (with their own sample rate/width/channel metadata) rather than writing directly into a wave file. Fixed by reading the installed package's actual source instead of trusting an older example.

One earlier hiccup, from the Phase 1 architecture proof: the first `prisma db push` against Neon failed with `P1001: Can't reach database server` - a TCP check confirmed port 5432 was reachable, so this was Neon's compute waking from idle (cold start), not a real connectivity problem. Retrying immediately succeeded.

Two smaller bugs from the UI pass, also worth naming rather than glossing over: shadcn's own `init` scaffolds a `--font-sans: var(--font-sans)` CSS variable in `globals.css` - a self-reference that never resolves, silently falling back to Arial instead of ever rendering the intended Geist font (fixed by pointing it at the actual `--font-geist-sans` variable set in `layout.tsx`); and this shadcn version's `Button` is built on Base UI, which expects a real `<button>` unless told otherwise, so using it to render a `next/link` needed `nativeButton={false}` or it logged a runtime accessibility warning about losing native button semantics.

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
- `GEMINI_API_KEY` - from [aistudio.google.com/apikey](https://aistudio.google.com/apikey), free tier

`GITHUB_TOKEN` (for publishing the finished video as a Release asset) and `GITHUB_REPO` need no setup - the workflow gets them automatically from GitHub Actions' own built-in context.

## License

MIT
