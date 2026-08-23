import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// This is the ownership-check bug found and fixed this session (see the
// README's Verification section): the endpoint originally had no auth
// check at all. These tests exist specifically to keep that regression
// from silently coming back.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { job: { findUnique: vi.fn() } },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

function makeRequest(): NextRequest {
  return new NextRequest("https://truedemo.test/api/jobs/some-id");
}

beforeEach(() => {
  vi.mocked(auth).mockReset();
  vi.mocked(prisma.job.findUnique).mockReset();
});

describe("GET /api/jobs/[id]", () => {
  it("returns 404 when the job doesn't exist", async () => {
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "missing" }) });

    expect(res.status).toBe(404);
  });

  it("returns the job with no auth check when it has no owner (pre-auth jobs)", async () => {
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: "job-1", userId: null, url: "https://example.com" } as never);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "job-1" }) });

    expect(res.status).toBe(200);
    expect(auth).not.toHaveBeenCalled();
  });

  it("returns 404 (not 401/403) for an owned job when the requester isn't signed in", async () => {
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: "job-1", userId: "owner-1", url: "https://example.com" } as never);
    vi.mocked(auth).mockResolvedValue(null as never);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "job-1" }) });

    // 404, not 401/403 - an unauthorized request shouldn't even be able to
    // confirm the job exists.
    expect(res.status).toBe(404);
  });

  it("returns 404 for an owned job when a DIFFERENT user is signed in", async () => {
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: "job-1", userId: "owner-1", url: "https://example.com" } as never);
    vi.mocked(auth).mockResolvedValue({ user: { id: "someone-else" } } as never);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "job-1" }) });

    expect(res.status).toBe(404);
  });

  it("returns 200 with the full job for its actual owner", async () => {
    const job = { id: "job-1", userId: "owner-1", url: "https://example.com", status: "completed" };
    vi.mocked(prisma.job.findUnique).mockResolvedValue(job as never);
    vi.mocked(auth).mockResolvedValue({ user: { id: "owner-1" } } as never);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "job-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("job-1");
    expect(body.status).toBe("completed");
  });
});
