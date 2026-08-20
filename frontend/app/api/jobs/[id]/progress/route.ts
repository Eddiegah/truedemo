import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

interface ProgressPayload {
  stage: string;
  status?: "running" | "completed" | "failed";
  videoUrl?: string;
  errorMessage?: string;
}

// Called only by the GitHub Actions runner processing this job - not a
// public endpoint, guarded by a shared secret rather than user auth since
// the caller is a CI runner, not a logged-in browser session.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const secret = req.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  let body: ProgressPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.stage) {
    return NextResponse.json({ error: "'stage' is required." }, { status: 400 });
  }

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const existingLog = Array.isArray(job.progressLog) ? job.progressLog : [];
  const newLog = [...existingLog, { stage: body.stage, at: new Date().toISOString() }] as Prisma.InputJsonValue;

  const job2 = await prisma.job.update({
    where: { id },
    data: {
      progressLog: newLog,
      status: body.status ?? "running",
      videoUrl: body.videoUrl ?? job.videoUrl,
      errorMessage: body.errorMessage ?? null,
    },
  });

  return NextResponse.json(job2);
}
