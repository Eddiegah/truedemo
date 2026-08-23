import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mocked at the real module boundary - no real DB, no real GitHub API call.
// These tests cover the actual request-handling logic: auth gating, rate
// limiting, validation, and how a dispatch failure is recorded - not
// Prisma or next-auth's own behavior, which are trusted dependencies.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    job: {
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("@/lib/github", () => ({ dispatchJob: vi.fn() }));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dispatchJob } from "@/lib/github";
import { POST } from "./route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("https://truedemo.test/api/jobs", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.mocked(auth).mockReset();
  vi.mocked(prisma.job.count).mockReset();
  vi.mocked(prisma.job.create).mockReset();
  vi.mocked(prisma.job.update).mockReset();
  vi.mocked(dispatchJob).mockReset();
});

describe("POST /api/jobs", () => {
  it("returns 401 without a session, and never touches the database", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const res = await POST(makeRequest({ url: "https://example.com" }));

    expect(res.status).toBe(401);
    expect(prisma.job.count).not.toHaveBeenCalled();
    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it("returns 429 at the rate limit, before creating a job row", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(prisma.job.count).mockResolvedValue(5); // at RATE_LIMIT_MAX_JOBS

    const res = await POST(makeRequest({ url: "https://example.com" }));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toMatch(/limit/i);
    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it("allows a request just under the rate limit", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(prisma.job.count).mockResolvedValue(4); // one under the cap
    vi.mocked(prisma.job.create).mockResolvedValue({ id: "job-1" } as never);
    vi.mocked(dispatchJob).mockResolvedValue(undefined);

    const res = await POST(makeRequest({ url: "https://example.com" }));

    expect(res.status).toBe(201);
  });

  it("rejects a non-http(s) URL", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(prisma.job.count).mockResolvedValue(0);

    const res = await POST(makeRequest({ url: "javascript:alert(1)" }));

    expect(res.status).toBe(400);
    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it("rejects a missing URL", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(prisma.job.count).mockResolvedValue(0);

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
  });

  it("creates the job with the session's userId, then dispatches it", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-42" } } as never);
    vi.mocked(prisma.job.count).mockResolvedValue(0);
    vi.mocked(prisma.job.create).mockResolvedValue({ id: "job-99" } as never);
    vi.mocked(dispatchJob).mockResolvedValue(undefined);

    const res = await POST(makeRequest({ url: "https://example.com", repoUrl: "https://github.com/x/y" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.jobId).toBe("job-99");
    expect(prisma.job.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-42", url: "https://example.com" }) })
    );
    expect(dispatchJob).toHaveBeenCalledWith("job-99", "https://example.com", "https://github.com/x/y");
  });

  it("marks the job failed (not stuck in queued) when dispatch throws", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(prisma.job.count).mockResolvedValue(0);
    vi.mocked(prisma.job.create).mockResolvedValue({ id: "job-1" } as never);
    vi.mocked(dispatchJob).mockRejectedValue(new Error("GitHub API unreachable"));

    const res = await POST(makeRequest({ url: "https://example.com" }));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.jobId).toBe("job-1");
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "failed", errorMessage: "GitHub API unreachable" },
    });
  });
});
