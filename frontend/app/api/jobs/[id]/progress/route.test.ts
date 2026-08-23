import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: { job: { findUnique: vi.fn(), update: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const TEST_SECRET = "test-webhook-secret";

function makeRequest(body: unknown, secret: string | null = TEST_SECRET): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== null) headers["x-webhook-secret"] = secret;
  return new NextRequest("https://truedemo.test/api/jobs/job-1/progress", {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });
}

beforeEach(() => {
  process.env.WEBHOOK_SECRET = TEST_SECRET;
  vi.mocked(prisma.job.findUnique).mockReset();
  vi.mocked(prisma.job.update).mockReset();
});

describe("POST /api/jobs/[id]/progress", () => {
  it("returns 401 with no secret header, and never touches the database", async () => {
    const res = await POST(makeRequest({ stage: "x" }, null), { params: Promise.resolve({ id: "job-1" }) });

    expect(res.status).toBe(401);
    expect(prisma.job.findUnique).not.toHaveBeenCalled();
  });

  it("returns 401 with the wrong secret", async () => {
    const res = await POST(makeRequest({ stage: "x" }, "wrong-secret"), { params: Promise.resolve({ id: "job-1" }) });

    expect(res.status).toBe(401);
  });

  it("returns 400 when 'stage' is missing", async () => {
    const res = await POST(makeRequest({}), { params: Promise.resolve({ id: "job-1" }) });

    expect(res.status).toBe(400);
  });

  it("returns 404 when the job doesn't exist", async () => {
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

    const res = await POST(makeRequest({ stage: "Exploring..." }), { params: Promise.resolve({ id: "missing" }) });

    expect(res.status).toBe(404);
  });

  it("appends to the existing progress log rather than replacing it", async () => {
    vi.mocked(prisma.job.findUnique).mockResolvedValue({
      id: "job-1",
      progressLog: [{ stage: "Job created", at: "2026-01-01T00:00:00Z" }],
      videoUrl: null,
      status: "queued",
    } as never);
    vi.mocked(prisma.job.update).mockResolvedValue({} as never);

    await POST(makeRequest({ stage: "Exploring the app..." }), { params: Promise.resolve({ id: "job-1" }) });

    const updateCall = vi.mocked(prisma.job.update).mock.calls[0][0];
    const log = updateCall.data.progressLog as Array<{ stage: string }>;
    expect(log).toHaveLength(2);
    expect(log[0].stage).toBe("Job created");
    expect(log[1].stage).toBe("Exploring the app...");
  });

  it("defaults status to 'running' when not provided", async () => {
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: "job-1", progressLog: [], videoUrl: null } as never);
    vi.mocked(prisma.job.update).mockResolvedValue({} as never);

    await POST(makeRequest({ stage: "Still going..." }), { params: Promise.resolve({ id: "job-1" }) });

    const updateCall = vi.mocked(prisma.job.update).mock.calls[0][0];
    expect(updateCall.data.status).toBe("running");
  });

  it("preserves the job's existing videoUrl when this call doesn't provide one", async () => {
    vi.mocked(prisma.job.findUnique).mockResolvedValue({
      id: "job-1",
      progressLog: [],
      videoUrl: "https://github.com/x/y/releases/download/demo-1/final.mp4",
    } as never);
    vi.mocked(prisma.job.update).mockResolvedValue({} as never);

    await POST(makeRequest({ stage: "Assembling video..." }), { params: Promise.resolve({ id: "job-1" }) });

    const updateCall = vi.mocked(prisma.job.update).mock.calls[0][0];
    expect(updateCall.data.videoUrl).toBe("https://github.com/x/y/releases/download/demo-1/final.mp4");
  });

  it("resets errorMessage to null when this call doesn't provide one, even if the job had one before", async () => {
    // Each call reflects current truth - a prior error shouldn't linger
    // once the job is reporting progress again.
    vi.mocked(prisma.job.findUnique).mockResolvedValue({
      id: "job-1",
      progressLog: [],
      videoUrl: null,
      errorMessage: "a stale previous error",
    } as never);
    vi.mocked(prisma.job.update).mockResolvedValue({} as never);

    await POST(makeRequest({ stage: "Retrying..." }), { params: Promise.resolve({ id: "job-1" }) });

    const updateCall = vi.mocked(prisma.job.update).mock.calls[0][0];
    expect(updateCall.data.errorMessage).toBeNull();
  });

  it("sets status to failed and records the error message when the worker reports failure", async () => {
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: "job-1", progressLog: [], videoUrl: null } as never);
    vi.mocked(prisma.job.update).mockResolvedValue({} as never);

    await POST(
      makeRequest({ stage: "Job failed: ffmpeg error", status: "failed", errorMessage: "ffmpeg error" }),
      { params: Promise.resolve({ id: "job-1" }) }
    );

    const updateCall = vi.mocked(prisma.job.update).mock.calls[0][0];
    expect(updateCall.data.status).toBe("failed");
    expect(updateCall.data.errorMessage).toBe("ffmpeg error");
  });
});
