<div align="center">

<img src="https://frontend-dun-chi-56.vercel.app/opengraph-image" alt="TrueDemo" width="100%" />

# TrueDemo

**The only demo video tool that actually understands your code.**

Every other tool guesses what your product does from its UI.
TrueDemo reads your actual source and gets it right.

[![Live demo](https://img.shields.io/badge/▶_Launch_TrueDemo-10b981?style=for-the-badge)](https://frontend-dun-chi-56.vercel.app)

[![Process Job](https://github.com/Eddiegah/truedemo/actions/workflows/process-job.yml/badge.svg)](https://github.com/Eddiegah/truedemo/actions/workflows/process-job.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org)
[![Playwright](https://img.shields.io/badge/Playwright-automation-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev)
[![Gemini](https://img.shields.io/badge/Gemini-narration-8E75B2?logo=googlegemini&logoColor=white)](https://ai.google.dev)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel&logoColor=white)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

</div>

---

## What it does

Paste a live app URL and, optionally, its GitHub repo. An autonomous agent:

1. **Explores** your app in a real headless browser - clicking through it like a person would, not just screenshotting the homepage.
2. **Reads your actual code** - clones the repo, parses dependency manifests, README, and file structure.
3. **Writes narration grounded in what it found** - via Gemini, referencing your real stack instead of generic "streamline your workflow" copy.
4. **Voices, assembles, and publishes** a captioned demo video - fully autonomously, with zero manual editing.

The result is a demo video that sounds like someone who actually read your code made it - because something did.

## Everything below is real, not aspirational

This isn't a landing page for a product that half-exists. The pipeline, the UI, and accounts have all been run end to end against the live, deployed production URL - not localhost, not a demo recording. See **[Verification](#verification)** for the actual runs, including the real bugs that came up and how they were fixed.

## Features

- 🧭 **Autonomous exploration** - Playwright drives a real browser, same-origin only, loop-safe, bounded steps. Recovers to the last known-good page if a link turns out broken, instead of silently cutting the rest of the exploration short.
- ⌨️ **Real feature interaction, not just navigation** - the agent types into real search/text inputs and tries submitting them, prioritized over plain link-clicking, so the video shows a feature actually working.
- 📖 **Code-grounded narration** - your repo's README, manifests, and file tree feed directly into the script.
- 🗣️ **Local TTS** - Piper synthesizes narration with zero API cost (and the voice-quality tradeoff is stated plainly, not hidden).
- 🎬 **Smooth, scored video assembly** - ffmpeg crossfades between clips instead of hard-cutting, burns in captions, and mixes in a soft procedurally-generated ambient music bed underneath - audible on its own during the brief pause after each line, not just a backing track.
- 🔐 **GitHub sign-in** - real OAuth via next-auth, gating generation both client- and server-side.
- 📼 **Video library** - every video you generate is saved to your account.
- 🔗 **Shareable public links** - `/v/[id]` gives every finished video its own no-login-required watch page with real OG previews, a copy-link button, and a download link.
- ✅ **CI on every push** - lints/tests/type-checks/builds the frontend (27 vitest tests: all three API routes including the rate limit and the ownership-check regression, plus the GitHub dispatch client) and runs a 43-test suite against the worker (every module with mockable logic - exploration, repo grounding, narration, TTS, video publishing - each mocked at its real external boundary). 70 tests total across the project, so regressions get caught automatically instead of waiting for the next manual retest.
- ⚡ **Fast, animated UI** - shadcn/ui + Framer Motion, dark-mode-first, optimistic updates, live status polling.
- 💸 **Genuinely free to run** - the entire stack (see [Architecture](#architecture)) runs on free tiers, no card required anywhere, with per-user rate limiting (5 videos/hour) so one account can't exhaust the shared free-tier Gemini quota for everyone else.

## Architecture

Two real, separately-deployed services - built under a hard no-paid-services constraint, with the reasoning behind each substitution stated plainly:

| Piece | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router), Vercel | Free hobby tier, no card, fast edge delivery. |
| Worker / job execution | **GitHub Actions**, not Fly.io | Fly.io no longer has a meaningful free tier. GitHub Actions runs unlimited minutes on a public repo and can genuinely run Playwright and ffmpeg. Tradeoff: ~10-30s startup delay vs. a warm process - a reasonable trade for zero cost on a demo-generation tool. |
| Job queue | GitHub Actions' own dispatch/scheduling | No Redis/Upstash - the "worker" *is* a GitHub Actions run, so a separate queue would be redundant infrastructure. |
| Database | **Neon Postgres** | Free tier, no card, doesn't expire. |
| Real-time updates | Polling (2.5s interval) | Vercel serverless can't hold WebSockets open without a paid real-time service; at this job frequency, polling is indistinguishable from push. |
| Narration TTS | Piper (runs locally in the Actions runner) | Zero cost. Voice quality is noticeably more robotic than a paid API like ElevenLabs - stated here, not glossed over. |
| LLM | Gemini free tier | Model selection tries `gemini-flash-latest` first with pinned fallbacks and retry-on-503, since the free-tier model lineup moved mid-build. |
| Video hosting | GitHub Releases | Free, no card, sufficient for demo-scale video files. |
| Auth | next-auth + GitHub OAuth | Free, no card, and every likely user already has a GitHub account. |

### How a job actually flows

```
Browser → POST /api/jobs → Job row in Postgres + workflow_dispatch triggered
                                          │
                                          ▼
                    GitHub Actions runner picks up the job
                                          │
        ┌──────────────┬──────────────┼──────────────┬──────────────┬──────────────┐
        ▼              ▼              ▼              ▼              ▼              ▼
    agent.py     repo_context.py script_writer.py narration.py  music.py    video_assembly.py
  (explore + fill)  (git clone)      (Gemini)         (Piper)   (ambient bed)  (crossfade + mix)
        │              │              │              │              │              │
        └──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
                                          │
                                          ▼
                           video_release.py → GitHub Release asset
                                          │
                                          ▼
              Every stage POSTs progress → dashboard polls every 2.5s
```

## Verification

Real runs against the live production deploy, not localhost - screenshots, logs, and exact evidence in the commit history:

- ✅ **Architecture**: job submission → GitHub Actions dispatch → webhook progress → Postgres → live dashboard polling.
- ✅ **Full pipeline**: a real 47.6s, 1280×800 h264/aac video, generated end to end from a real job, downloaded and verified with `ffprobe` - not just an HTTP 200 check. Published as a real GitHub Release: [`demo-cmt3d2ofo0000ji04ouwcrcth`](https://github.com/Eddiegah/truedemo/releases/tag/demo-cmt3d2ofo0000ji04ouwcrcth).
- ✅ **Auth**: `GET /api/auth/providers` confirms GitHub OAuth is live; `POST /api/jobs` returns `401` without a session, confirming the *server-side* gate actually blocks anonymous requests, not just a hidden UI element. `GET /api/jobs/[id]` (the status-polling endpoint) had no ownership check at all until caught in this pass - verified against real production data: an owned job now returns `404` to an unauthenticated request, while an unowned legacy job (from before auth existed) is still visible, unchanged.
- ✅ **Crossfade + music + feature interaction**: a real production run against `playwright.dev`, dispatched directly via `workflow_dispatch` - 8 real exploration steps (including recovering from one intentionally-broken navigation), a real narrated/crossfaded/scored 46.6s video, confirmed non-silent with `ffmpeg`'s `volumedetect` (mean -23.3dB, max -6.3dB - real signal, not a silent track), not just checked for existing.
- ✅ **Shareable links**: `/v/[id]` tested against a real job in production (a real video of `gapforge-self.vercel.app`, generated by actually using the deployed app) - confirms `200` with the real video embedded, and `404` for a nonexistent id. That 404 was fixed twice the same day: first for returning `200` with a "not found" message instead of a real status, then again after a `loading.tsx` added later silently regressed the same fix - Next.js starts streaming a `200` response the moment a route's Suspense boundary activates, before an async `notFound()` call can resolve, and can't retroactively change the status once headers are sent. Caught both times by checking the actual HTTP status code directly, not just the rendered content.
- ✅ **CI**: the first real run failed twice before actually passing - once from a wrong first hypothesis (a Node version mismatch, which turned out not to be the cause at all), then again from the real one (a Windows-only lockfile gap). Not smoothed over: see the bugs list below for the full debugging trail, including how the eventual fix was verified on both platforms before being trusted.

<details>
<summary><b>Real bugs found and fixed by testing against real infrastructure (click to expand)</b></summary>

<br>

- **ffmpeg's `pad` filter doesn't take `scale`'s `WxH` shorthand.** `pad=1280x800:...` parsed `"1280x800"` as a single width expression and failed - silently at first, because `subprocess.run(capture_output=True)` was dropping ffmpeg's actual stderr. Fixed both the logging and the filter syntax; only caught by reproducing the exact failing command locally with a real ffmpeg binary.
- **Gemini's free-tier model lineup moved mid-build.** The initial model 404'd for new users, and even the "stable" alias hit a transient `503 high demand`. Fixed with a smarter fallback chain and a retry specifically for capacity errors.
- **`piper-tts` 1.7.0's API differs from older docs.** `synthesize()` now returns a generator of audio chunks, not a direct wave-file writer. Fixed by reading the installed package's actual source.
- **shadcn's own `init` scaffolds a self-referencing `--font-sans` CSS variable** that never resolves, silently falling back to Arial instead of the intended Geist font.
- **Base UI's `Button` expects a real `<button>`** unless told otherwise - using it to render a `next/link` needed `nativeButton={false}`.
- One earlier hiccup: the first `prisma db push` against Neon failed with `P1001` - a TCP check confirmed the port was reachable, so this was Neon's compute waking from idle, not a real connectivity problem. Retrying immediately succeeded.
- **A failed `page.goto()` silently empties the page's DOM**, even though `page.url` still reports the old address unchanged. Confirmed directly: 2 real elements found before a deliberately-broken navigation, 0 found after, `page.url` identical both times. Before this was caught, one bad link would silently truncate the rest of an exploration run - every later candidate search on the now-empty page found nothing, and the loop just ended early with far fewer steps than the app actually offered. Fixed by tracking the last known-good URL and reloading it after any failed action.
- **`agent.py` re-derived element labels by parsing its own formatted description string** (`"Clicked \"X\""` -> split on `"` -> grab index 1) instead of keeping the raw label - broke silently on any label that itself contained a quote character (`Use "Feature" Now`). Confirmed with a fixture containing exactly that, then fixed by returning the raw label alongside the description instead of reverse-parsing it.
- **A `loading.tsx` in the same route segment as a `notFound()` call breaks the HTTP status code.** Next.js starts streaming a `200` response the moment a Suspense boundary activates, before the async `notFound()` decision resolves, and can't retroactively change the status once headers are sent - silently regressing the `/v/[id]` 404 fix the same day it was added, just by adding a loading skeleton alongside it. Caught by re-checking the actual HTTP status after every deploy, not just the rendered content; fixed by keeping the skeleton only on routes that never call `notFound()`.
- **`package-lock.json` had only ever been generated on Windows** (this project's whole dev environment) and was missing Linux-only WASM-fallback entries for platform-specific native binaries. `npm install` silently tolerates the gap on every local build and every Vercel deploy; only CI's deliberately-stricter `npm ci` surfaces it. Fixed the same way twice, because it's a recurring risk, not a one-time bug: any `npm install` run on Windows (e.g. adding `vitest` as a dependency for the frontend test suite below) recalculates the tree from Windows's perspective and can silently re-drop the Linux-only entries again, even after they were already correct. Both times fixed by regenerating on the actual Linux runners CI and the real pipeline already use (a temporary one-off GitHub Actions workflow, since Docker Desktop wasn't running locally either time) and verifying twice - once on Linux, once with a full local Windows `npm ci` + build - before trusting the result. The durable fix would be developing (or at least regenerating locks) from Linux/WSL/Docker directly, not re-patching this after each recurrence - noted honestly rather than treated as solved.
- **`GET /api/jobs/[id]` had no ownership check at all.** Any request with a valid job id got back the full record - app URL, repo URL, error messages - regardless of who owned it. Job ids are cuid()s and not practically guessable, but that's a mitigating factor, not a reason the endpoint was correct. Fixed to check the requester's session against the job's `userId`, returning `404` (not `403`) on a mismatch so an unauthorized request can't even confirm the job exists - verified against real production jobs, both the now-protected and the still-open (pre-auth, ownerless) cases. The fix has its own regression test now (see below).
- **Mocking next-auth's `auth` export with a plain `null` broke the frontend's own type-check.** `auth` is overloaded - a session-getter when called directly, a middleware-wrapper when passed a handler - and `vi.mocked(auth).mockResolvedValue(null)` confused TypeScript about which overload applied, failing `next build`'s type-check even though the test itself was correct. Fixed with an explicit `as never` cast, the same pattern already used for mocked Prisma results, not by loosening tsconfig.
- **`lib/github.ts`'s `GITHUB_REPO` is read once into a module-level `const` at import, not re-read per call.** A first test version set `process.env.GITHUB_REPO` in `beforeEach` and asserted on it - failed immediately, because by then the module had already captured whatever the env was at its first import in the file. Fixed by actually testing that behavior (`vi.resetModules()` + a dynamic `import()` per test case) instead of routing around it, which also meant the fallback-to-default-repo path got an explicit test it didn't have before.

</details>

## Getting started

```bash
git clone https://github.com/Eddiegah/truedemo.git
cd truedemo/frontend
npm install
cp .env.example .env.local   # see below for what each var needs
npx prisma db push
npm run dev
```

<details>
<summary><b>Environment variables</b></summary>

<br>

**Frontend** (`.env.local`):

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Free Postgres connection string from [neon.tech](https://neon.tech) |
| `GH_DISPATCH_TOKEN` | Fine-grained GitHub PAT with `Actions: write` on this repo |
| `GITHUB_REPO` | `your-username/truedemo` |
| `WEBHOOK_SECRET` | Any long random string - must match the GitHub Actions secret below |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | From a [GitHub OAuth App](https://github.com/settings/developers) |

**GitHub Actions secrets** (repo Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `WEBHOOK_URL` | Your deployed frontend's base URL |
| `WEBHOOK_SECRET` | Same value as the frontend's |
| `GEMINI_API_KEY` | Free tier from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

`GITHUB_TOKEN` and `GITHUB_REPO` inside the workflow need no setup - GitHub Actions provides them automatically.

</details>

<details>
<summary><b>Running the worker locally</b></summary>

<br>

The worker normally only runs inside GitHub Actions. To test it standalone:

```bash
cd worker
python -m venv venv && venv/Scripts/activate   # source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
python src/main.py --job-id test --url https://example.com \
  --webhook-url http://localhost:3000 --webhook-secret <your WEBHOOK_SECRET>
```

Requires the frontend running locally so the webhook calls land somewhere.

</details>

## Roadmap

Everything from the original spec is built and verified: the real generation pipeline (including crossfade transitions, background music, and real feature interaction), the shadcn/ui + Framer Motion design system, GitHub OAuth accounts, the video library, and shareable public video links. What's left is incremental, not structural: further landing-page visual polish, and broader browser/device testing beyond what's been checked so far.

## License

MIT © Edmund Eric Gah
