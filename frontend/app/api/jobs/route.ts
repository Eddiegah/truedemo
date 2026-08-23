import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchJob } from "@/lib/github";
import { auth } from "@/auth";

// Every job burns real, shared, free-tier quota that every signed-in user
// draws from - one GEMINI_API_KEY for the whole deployment, and GitHub
// Actions minutes on this repo. Without a cap, one account submitting in a
// loop could starve everyone else's free tier, not just their own. Kept
// generous enough for genuine testing.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_JOBS = 5;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to generate a demo video." }, { status: 401 });
  }

  const recentJobCount = await prisma.job.count({
    where: { userId: session.user.id, createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) } },
  });
  if (recentJobCount >= RATE_LIMIT_MAX_JOBS) {
    return NextResponse.json(
      {
        error: `You've hit the limit of ${RATE_LIMIT_MAX_JOBS} videos per hour - this keeps the free pipeline available for everyone. Try again in a bit.`,
      },
      { status: 429 }
    );
  }

  let body: { url?: string; repoUrl?: string; demoUsername?: string; demoPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "A valid http(s) URL is required." }, { status: 400 });
  }
  const repoUrl = body.repoUrl?.trim() || null;
  const demoUsername = body.demoUsername?.trim() || null;
  const demoPassword = body.demoPassword || null;

  const job = await prisma.job.create({
    data: {
      url,
      repoUrl,
      demoUsername,
      demoPassword,
      userId: session.user.id,
      status: "queued",
      // Never mention credentials were provided, even just "yes/no" - the
      // progressLog is public (rendered on the dashboard, and readable via
      // the /v/[id] share page's underlying data) and demo login use is
      // reported generically by the worker as "Logging in..." instead.
      progressLog: [{ stage: "Job created, dispatching worker...", at: new Date().toISOString() }],
    },
  });

  try {
    await dispatchJob(job.id, url, repoUrl);
  } catch (err) {
    // The job row already exists - record the dispatch failure rather than
    // leaving it silently stuck in "queued" forever.
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "failed", errorMessage: err instanceof Error ? err.message : "Failed to dispatch the worker." },
    });
    return NextResponse.json({ error: "Failed to start the job - see job status for details.", jobId: job.id }, { status: 502 });
  }

  return NextResponse.json({ jobId: job.id }, { status: 201 });
}
