import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// Used by the submitting user's own polling loop right after they create a
// job - not a public endpoint. Without an ownership check, anyone who knew
// or guessed a job id (cuid()s aren't guessable, but could still leak via
// logs, referrers, or being shared) could read another user's full job
// details - the app URL they demoed, their repo URL, error messages.
// Jobs with no owner (userId null - created before auth existed) stay
// visible to anyone, matching how they always behaved.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  if (job.userId) {
    const session = await auth();
    if (session?.user?.id !== job.userId) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
  }

  return NextResponse.json(job);
}
