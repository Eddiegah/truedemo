import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Called once by the GitHub Actions worker, guarded by the same shared
// webhook secret as the progress endpoint - not workflow_dispatch inputs,
// which are visible in this public repo's Actions run logs to anyone.
// Credentials are nulled out immediately after being read, so a job's
// stored demo login never outlives the single fetch that needs it, and
// re-requesting after the first fetch returns nothing rather than stale
// (or leaked-via-retry) credentials.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const secret = req.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    select: { demoUsername: true, demoPassword: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  if (job.demoUsername || job.demoPassword) {
    await prisma.job.update({
      where: { id },
      data: { demoUsername: null, demoPassword: null },
    });
  }

  return NextResponse.json({ demoUsername: job.demoUsername, demoPassword: job.demoPassword });
}
