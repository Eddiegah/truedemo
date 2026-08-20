import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchJob } from "@/lib/github";

export async function POST(req: NextRequest) {
  let body: { url?: string; repoUrl?: string };
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

  const job = await prisma.job.create({
    data: { url, repoUrl, status: "queued", progressLog: [{ stage: "Job created, dispatching worker...", at: new Date().toISOString() }] },
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
